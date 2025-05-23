/**
 * Linting Coordinator
 * 
 * Coordinates multiple static analysis tools and linters to provide
 * comprehensive code quality analysis. This component:
 * - Runs configured linters (ESLint, TypeScript, Prettier, etc.)
 * - Aggregates and summarizes findings
 * - Filters out noise and duplicates
 * - Provides actionable summaries instead of individual comments
 */

import * as core from '@actions/core'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { LintResult, LintIssue, ReviewConfiguration } from '../types'

const execAsync = promisify(exec)

export class LintingCoordinator {
  private readonly workspaceRoot: string
  
  constructor(private config: ReviewConfiguration) {
    this.workspaceRoot = process.cwd()
  }

  /**
   * Run all configured linters and aggregate results
   */
  async runAllLinters(files: string[]): Promise<LintResult> {
    core.info('🔧 Running static analysis tools...')
    
    const linterResults: Record<string, LintIssue[]> = {}
    let totalIssues = 0
    let autoFixable = 0

    // Run each enabled linter
    for (const linter of this.config.linting.enabled) {
      try {
        core.info(`Running ${linter}...`)
        const issues = await this.runLinter(linter, files)
        linterResults[linter] = issues
        totalIssues += issues.length
        autoFixable += issues.filter(issue => issue.fixable).length
        
        core.info(`${linter}: Found ${issues.length} issues`)
      } catch (error) {
        core.warning(`Failed to run ${linter}: ${error}`)
        linterResults[linter] = []
      }
    }

    // Calculate severity breakdown
    const severityBreakdown = this.calculateSeverityBreakdown(linterResults)
    
    // Generate summary
    const summary = this.generateLintingSummary(linterResults, totalIssues, autoFixable)

    return {
      totalIssues,
      severityBreakdown,
      byLinter: linterResults,
      summary,
      autoFixable
    }
  }

  /**
   * Run a specific linter on the given files
   */
  private async runLinter(linter: string, files: string[]): Promise<LintIssue[]> {
    switch (linter) {
      case 'eslint':
        return await this.runESLint(files)
      case 'typescript':
        return await this.runTypeScript(files)
      case 'prettier':
        return await this.runPrettier(files)
      case 'sonar':
        return await this.runSonarJS(files)
      default:
        core.warning(`Unknown linter: ${linter}`)
        return []
    }
  }

  /**
   * Run ESLint analysis
   */
  private async runESLint(files: string[]): Promise<LintIssue[]> {
    const issues: LintIssue[] = []
    
    // Filter for JavaScript/TypeScript files
    const jsFiles = files.filter(file => 
      /\.(js|jsx|ts|tsx)$/.test(file) && !file.includes('node_modules')
    )
    
    if (jsFiles.length === 0) {
      return issues
    }

    try {
      // Check if ESLint is available
      await this.checkToolAvailability('eslint', 'npx eslint --version')
      
      // Run ESLint with JSON output
      const filesArg = jsFiles.join(' ')
      const command = `npx eslint ${filesArg} --format json --no-error-on-unmatched-pattern`
      
      const { stdout } = await execAsync(command, { 
        cwd: this.workspaceRoot,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      })

      const eslintResults = JSON.parse(stdout || '[]')
      
      for (const result of eslintResults) {
        for (const message of result.messages || []) {
          issues.push({
            linter: 'eslint',
            file: result.filePath,
            line: message.line || 1,
            column: message.column || 1,
            severity: this.mapESLintSeverity(message.severity),
            message: message.message,
            ruleId: message.ruleId,
            fixable: message.fix !== undefined
          })
        }
      }

    } catch (error) {
      // ESLint exits with code 1 when it finds issues, so check stderr for real errors
      if (error instanceof Error && 'code' in error && error.code === 1) {
        try {
          const eslintResults = JSON.parse((error as any).stdout || '[]')
          // Process results even if ESLint exited with code 1
          for (const result of eslintResults) {
            for (const message of result.messages || []) {
              issues.push({
                linter: 'eslint',
                file: result.filePath,
                line: message.line || 1,
                column: message.column || 1,
                severity: this.mapESLintSeverity(message.severity),
                message: message.message,
                ruleId: message.ruleId,
                fixable: message.fix !== undefined
              })
            }
          }
        } catch (parseError) {
          core.debug(`ESLint error: ${error}`)
        }
      } else {
        core.debug(`ESLint execution failed: ${error}`)
      }
    }

    return issues
  }

  /**
   * Run TypeScript compiler analysis
   */
  private async runTypeScript(files: string[]): Promise<LintIssue[]> {
    const issues: LintIssue[] = []
    
    // Filter for TypeScript files
    const tsFiles = files.filter(file => 
      /\.tsx?$/.test(file) && !file.includes('node_modules')
    )
    
    if (tsFiles.length === 0) {
      return issues
    }

    try {
      await this.checkToolAvailability('typescript', 'npx tsc --version')
      
      // Run TypeScript compiler with no emit, just type checking
      const command = 'npx tsc --noEmit --pretty false --incremental false'
      
      const { stderr } = await execAsync(command, { 
        cwd: this.workspaceRoot,
        maxBuffer: 1024 * 1024 * 10
      })

      // Parse TypeScript compiler output
      const lines = stderr.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        const match = line.match(/^(.+)\((\d+),(\d+)\):\s*(error|warning)\s*TS(\d+):\s*(.+)$/)
        if (match) {
          const [, filePath, lineStr, columnStr, severity, code, message] = match
          
          // Only include files we're analyzing
          if (tsFiles.some(file => filePath.includes(file))) {
            issues.push({
              linter: 'typescript',
              file: filePath,
              line: parseInt(lineStr, 10),
              column: parseInt(columnStr, 10),
              severity: severity as 'error' | 'warning',
              message: `TS${code}: ${message}`,
              ruleId: `TS${code}`,
              fixable: false // TypeScript errors are rarely auto-fixable
            })
          }
        }
      }

    } catch (error) {
      // TypeScript compiler exits with error code when there are type errors
      if (error instanceof Error && 'stderr' in error) {
        const stderr = (error as any).stderr
        const lines = stderr.split('\n').filter((line: string) => line.trim())
        
        for (const line of lines) {
          const match = line.match(/^(.+)\((\d+),(\d+)\):\s*(error|warning)\s*TS(\d+):\s*(.+)$/)
          if (match) {
            const [, filePath, lineStr, columnStr, severity, code, message] = match
            
            if (tsFiles.some(file => filePath.includes(file))) {
              issues.push({
                linter: 'typescript',
                file: filePath,
                line: parseInt(lineStr, 10),
                column: parseInt(columnStr, 10),
                severity: severity as 'error' | 'warning',
                message: `TS${code}: ${message}`,
                ruleId: `TS${code}`,
                fixable: false
              })
            }
          }
        }
      }
    }

    return issues
  }

  /**
   * Run Prettier formatting analysis
   */
  private async runPrettier(files: string[]): Promise<LintIssue[]> {
    const issues: LintIssue[] = []
    
    // Filter for files that Prettier can handle
    const prettierFiles = files.filter(file => 
      /\.(js|jsx|ts|tsx|json|css|scss|md|yml|yaml)$/.test(file) && 
      !file.includes('node_modules')
    )
    
    if (prettierFiles.length === 0) {
      return issues
    }

    try {
      await this.checkToolAvailability('prettier', 'npx prettier --version')
      
      // Check each file for formatting issues
      for (const file of prettierFiles) {
        try {
          const command = `npx prettier --check "${file}"`
          await execAsync(command, { cwd: this.workspaceRoot })
        } catch (error) {
          // Prettier exits with code 1 when files are not formatted
          issues.push({
            linter: 'prettier',
            file: file,
            line: 1,
            column: 1,
            severity: 'info',
            message: 'File is not formatted according to Prettier rules',
            ruleId: 'prettier/formatting',
            fixable: true
          })
        }
      }

    } catch (error) {
      core.debug(`Prettier execution failed: ${error}`)
    }

    return issues
  }

  /**
   * Run SonarJS analysis (if available)
   */
  private async runSonarJS(files: string[]): Promise<LintIssue[]> {
    const issues: LintIssue[] = []
    
    try {
      // Check if SonarJS ESLint plugin is available
      await this.checkToolAvailability('sonar', 'npx eslint --print-config . | grep sonarjs')
      
      const jsFiles = files.filter(file => 
        /\.(js|jsx|ts|tsx)$/.test(file) && !file.includes('node_modules')
      )
      
      if (jsFiles.length === 0) {
        return issues
      }

      const filesArg = jsFiles.join(' ')
      const command = `npx eslint ${filesArg} --format json --no-eslintrc --config '{"extends": ["plugin:sonarjs/recommended"]}' --no-error-on-unmatched-pattern`
      
      const { stdout } = await execAsync(command, { 
        cwd: this.workspaceRoot,
        maxBuffer: 1024 * 1024 * 5
      })

      const sonarResults = JSON.parse(stdout || '[]')
      
      for (const result of sonarResults) {
        for (const message of result.messages || []) {
          if (message.ruleId && message.ruleId.startsWith('sonarjs/')) {
            issues.push({
              linter: 'sonar',
              file: result.filePath,
              line: message.line || 1,
              column: message.column || 1,
              severity: this.mapESLintSeverity(message.severity),
              message: message.message,
              ruleId: message.ruleId,
              fixable: false // SonarJS rules are typically not auto-fixable
            })
          }
        }
      }

    } catch (error) {
      core.debug(`SonarJS not available or failed: ${error}`)
    }

    return issues
  }

  /**
   * Check if a tool is available in the environment
   */
  private async checkToolAvailability(tool: string, command: string): Promise<void> {
    try {
      await execAsync(command, { cwd: this.workspaceRoot })
    } catch (error) {
      throw new Error(`${tool} is not available or not properly configured`)
    }
  }

  /**
   * Map ESLint severity numbers to strings
   */
  private mapESLintSeverity(severity: number): 'error' | 'warning' | 'info' {
    switch (severity) {
      case 2: return 'error'
      case 1: return 'warning'
      default: return 'info'
    }
  }

  /**
   * Calculate severity breakdown across all linters
   */
  private calculateSeverityBreakdown(linterResults: Record<string, LintIssue[]>): Record<string, number> {
    const breakdown: Record<string, number> = { error: 0, warning: 0, info: 0 }
    
    for (const issues of Object.values(linterResults)) {
      for (const issue of issues) {
        breakdown[issue.severity] = (breakdown[issue.severity] || 0) + 1
      }
    }
    
    return breakdown
  }

  /**
   * Generate a comprehensive summary of linting results
   */
  private generateLintingSummary(
    linterResults: Record<string, LintIssue[]>, 
    totalIssues: number, 
    autoFixable: number
  ): string {
    if (totalIssues === 0) {
      return '✅ No linting issues found. Code follows all configured quality standards.'
    }

    let summary = `Found ${totalIssues} linting issue(s)`
    
    if (autoFixable > 0) {
      summary += ` (${autoFixable} auto-fixable)`
    }
    
    summary += ':\n\n'

    // Break down by linter
    for (const [linter, issues] of Object.entries(linterResults)) {
      if (issues.length > 0) {
        const errorCount = issues.filter(i => i.severity === 'error').length
        const warningCount = issues.filter(i => i.severity === 'warning').length
        const infoCount = issues.filter(i => i.severity === 'info').length
        
        summary += `**${linter.toUpperCase()}**: ${issues.length} issues`
        
        const severityParts = []
        if (errorCount > 0) severityParts.push(`${errorCount} errors`)
        if (warningCount > 0) severityParts.push(`${warningCount} warnings`)
        if (infoCount > 0) severityParts.push(`${infoCount} info`)
        
        if (severityParts.length > 0) {
          summary += ` (${severityParts.join(', ')})`
        }
        
        summary += '\n'

        // Show most common issues for this linter
        const commonIssues = this.getMostCommonIssues(issues, 3)
        for (const [ruleId, count] of commonIssues) {
          summary += `  - ${ruleId}: ${count} occurrence(s)\n`
        }
        
        summary += '\n'
      }
    }

    // Add fix suggestions
    if (autoFixable > 0) {
      summary += `💡 **Quick Fix**: Run the following commands to auto-fix ${autoFixable} issues:\n`
      
      if (linterResults.eslint?.some(i => i.fixable)) {
        summary += '```bash\nnpx eslint --fix .\n```\n'
      }
      
      if (linterResults.prettier?.length > 0) {
        summary += '```bash\nnpx prettier --write .\n```\n'
      }
    }

    // Add configuration suggestions
    const configSuggestions = this.getConfigurationSuggestions(linterResults)
    if (configSuggestions.length > 0) {
      summary += '\n📋 **Configuration Suggestions**:\n'
      for (const suggestion of configSuggestions) {
        summary += `- ${suggestion}\n`
      }
    }

    return summary.trim()
  }

  /**
   * Get most common issues for a linter
   */
  private getMostCommonIssues(issues: LintIssue[], limit: number): [string, number][] {
    const ruleCounts: Record<string, number> = {}
    
    for (const issue of issues) {
      if (issue.ruleId) {
        ruleCounts[issue.ruleId] = (ruleCounts[issue.ruleId] || 0) + 1
      }
    }
    
    return Object.entries(ruleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
  }

  /**
   * Generate configuration suggestions based on findings
   */
  private getConfigurationSuggestions(linterResults: Record<string, LintIssue[]>): string[] {
    const suggestions: string[] = []
    
    // ESLint suggestions
    if (linterResults.eslint?.length > 10) {
      suggestions.push('Consider tightening ESLint rules to maintain code quality')
    }
    
    // TypeScript suggestions
    const tsErrors = linterResults.typescript?.filter(i => i.severity === 'error').length || 0
    if (tsErrors > 5) {
      suggestions.push('Multiple TypeScript errors detected - consider enabling strict mode gradually')
    }
    
    // Prettier suggestions
    if (linterResults.prettier?.length > 0) {
      suggestions.push('Set up Prettier pre-commit hooks to maintain consistent formatting')
    }
    
    return suggestions
  }

  /**
   * Get linting statistics for metrics
   */
  getLintingStatistics(result: LintResult): Record<string, any> {
    return {
      totalIssues: result.totalIssues,
      autoFixableIssues: result.autoFixable,
      severityBreakdown: result.severityBreakdown,
      linterBreakdown: Object.fromEntries(
        Object.entries(result.byLinter).map(([linter, issues]) => [linter, issues.length])
      ),
      fixabilityRatio: result.totalIssues > 0 ? result.autoFixable / result.totalIssues : 0
    }
  }
}