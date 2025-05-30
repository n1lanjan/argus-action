/**
 * Architecture Agent
 *
 * Specialized AI agent focused on software architecture and design patterns.
 * This agent analyzes code changes for:
 * - Design pattern violations
 * - SOLID principle adherence
 * - Code organization and structure
 * - Dependency management
 * - Modularity and coupling issues
 * - Architectural consistency
 */

import * as core from '@actions/core'
import Anthropic from '@anthropic-ai/sdk'
import {
  ReviewAgent,
  ReviewContext,
  AgentResult,
  AgentType,
  ReviewIssue,
  ReviewConfiguration,
} from '@/types'
import { buildArchitectureAnalysisPrompt } from '@/prompts'
import { parseAgentResponse } from '@/utils'

export class ArchitectureAgent implements ReviewAgent {
  name: AgentType = 'architecture'
  capabilities = [
    'Design pattern analysis',
    'SOLID principles validation',
    'Code organization review',
    'Dependency analysis',
    'Modularity assessment',
    'Coupling and cohesion analysis',
  ]
  priority = 2

  private anthropic: Anthropic
  private model: string

  constructor(private config: ReviewConfiguration) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Architecture Agent')
    }

    this.anthropic = new Anthropic({ apiKey })
    this.model = config.models.anthropic
  }

  /**
   * Execute architecture analysis on the code changes
   */
  async execute(context: ReviewContext): Promise<AgentResult> {
    const startTime = Date.now()
    core.info('🏗️ Architecture Agent: Starting architecture analysis...')

    try {
      const issues: ReviewIssue[] = []

      // Analyze each changed file for architecture issues
      for (const file of context.changedFiles) {
        if (this.shouldAnalyzeFile(file.filename)) {
          const fileIssues = await this.analyzeFileArchitecture(file, context)
          issues.push(...fileIssues)
        }
      }

      // Analyze overall architectural changes
      const structuralIssues = await this.analyzeStructuralChanges(context)
      issues.push(...structuralIssues)

      // Generate overall summary
      const summary = this.generateSummary(issues, context)

      const result: AgentResult = {
        agent: 'architecture',
        confidence: this.calculateConfidence(issues, context),
        issues,
        summary,
        executionTime: Date.now() - startTime,
      }

      core.info(`🏗️ Architecture Agent: Found ${issues.length} architecture issues`)
      return result
    } catch (error) {
      core.error(`Architecture Agent failed: ${error}`)
      throw error
    }
  }

  /**
   * Analyze a single file for architecture issues
   */
  private async analyzeFileArchitecture(file: any, context: ReviewContext): Promise<ReviewIssue[]> {
    if (!file.patch || !file.content) {
      return []
    }

    const prompt = buildArchitectureAnalysisPrompt(file, context)

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.config.models.parameters.maxTokens,
        temperature: this.config.models.parameters.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      return this.parseArchitectureIssues(response.content[0] as any, file.filename)
    } catch (error) {
      core.warning(`Failed to analyze ${file.filename} for architecture: ${error}`)
      return []
    }
  }

  /**
   * Parse Claude's response into architecture issues
   */
  private parseArchitectureIssues(response: any, filename: string): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const text = response.text || ''
    const parsedIssues = parseAgentResponse(text, filename, 'architecture')

    for (const issue of parsedIssues) {
      issues.push({
        severity: issue.severity || 'warning',
        category: issue.category ? `architecture-${issue.category}` : 'architecture-general',
        title: `🏗️ ${issue.title}`,
        description: this.formatArchitectureDescription(issue),
        file: filename,
        line: issue.line,
        endLine: issue.endLine,
        snippet: issue.snippet,
        suggestion:
          typeof issue.suggestion === 'string' ? { comment: issue.suggestion } : issue.suggestion,
        coaching: {
          rationale: issue.rationale || '',
          resources: this.getArchitectureResources(issue.category),
          bestPractice: issue.bestPractice || '',
          level: this.determineArchitectureComplexity(issue.category),
        },
      })
    }

    return issues
  }

  /**
   * Analyze structural changes across multiple files
   */
  private async analyzeStructuralChanges(context: ReviewContext): Promise<ReviewIssue[]> {
    const issues: ReviewIssue[] = []

    // Check for new modules or significant structural changes
    const newFiles = context.changedFiles.filter(f => f.status === 'added')
    // const deletedFiles = context.changedFiles.filter(f => f.status === 'deleted')
    const renamedFiles = context.changedFiles.filter(f => f.status === 'renamed')

    // Analyze new module creation
    if (newFiles.length > 0) {
      const moduleIssues = this.analyzeNewModules(newFiles, context)
      issues.push(...moduleIssues)
    }

    // Analyze file movements and renames
    if (renamedFiles.length > 0) {
      const renamingIssues = this.analyzeFileRenames(renamedFiles, context)
      issues.push(...renamingIssues)
    }

    // Check for potential circular dependencies
    const circularDependencyIssues = this.checkCircularDependencies(context)
    issues.push(...circularDependencyIssues)

    return issues
  }

  /**
   * Analyze new modules for architectural consistency
   */
  private analyzeNewModules(newFiles: any[], context: ReviewContext): ReviewIssue[] {
    const issues: ReviewIssue[] = []

    for (const file of newFiles) {
      // Check if new file follows project structure conventions
      const expectedLocation = this.getExpectedLocation(file.filename, context)
      if (expectedLocation && !file.filename.startsWith(expectedLocation)) {
        issues.push({
          severity: 'warning',
          category: 'architecture-code-organization',
          title: '📁 File Location Convention',
          description: `New file may not follow project structure conventions. Expected location: ${expectedLocation}`,
          file: file.filename,
          suggestion: {
            comment: `Consider moving to ${expectedLocation} to maintain consistency`,
          },
          coaching: {
            rationale:
              'Consistent file organization improves maintainability and developer experience',
            resources: ['Clean Architecture', 'Project Structure Best Practices'],
            bestPractice: 'Group related files by feature or layer, not by file type',
            level: 'intermediate',
          },
        })
      }
    }

    return issues
  }

  /**
   * Analyze file renames for architectural impact
   */
  private analyzeFileRenames(renamedFiles: any[], _context: ReviewContext): ReviewIssue[] {
    const issues: ReviewIssue[] = []

    for (const file of renamedFiles) {
      // Check if rename breaks existing patterns
      if (file.previousFilename && this.breaksNamingPattern(file.previousFilename, file.filename)) {
        issues.push({
          severity: 'info',
          category: 'architecture-code-organization',
          title: '🔄 Naming Pattern Change',
          description: `File rename changes established naming pattern: ${file.previousFilename} → ${file.filename}`,
          file: file.filename,
          suggestion: {
            comment: 'Ensure the new name follows project conventions and update related imports',
          },
          coaching: {
            rationale: 'Consistent naming patterns help developers navigate the codebase',
            resources: ['Naming Conventions Guide'],
            bestPractice: "Use descriptive names that clearly indicate the file's purpose",
            level: 'beginner',
          },
        })
      }
    }

    return issues
  }

  /**
   * Check for potential circular dependencies
   */
  private checkCircularDependencies(context: ReviewContext): ReviewIssue[] {
    const issues: ReviewIssue[] = []

    // This is a simplified check - in a full implementation,
    // you'd analyze import statements and build a dependency graph
    for (const file of context.changedFiles) {
      if (file.content && this.hasCircularDependencyRisk(file.content, file.filename)) {
        issues.push({
          severity: 'error',
          category: 'architecture-dependency-management',
          title: '🔄 Circular Dependency Risk',
          description: 'Changes may introduce circular dependency between modules',
          file: file.filename,
          suggestion: {
            comment: 'Consider using dependency injection or extracting shared interfaces',
          },
          coaching: {
            rationale:
              'Circular dependencies make code harder to test and can cause runtime issues',
            resources: ['Dependency Inversion Principle', 'Clean Architecture'],
            bestPractice:
              'Design dependencies to flow in one direction, typically from UI to business logic to data',
            level: 'advanced',
          },
        })
      }
    }

    return issues
  }

  /**
   * Determine if a file should be analyzed for architecture
   */
  private shouldAnalyzeFile(filename: string): boolean {
    // Focus on source code files
    const codeExtensions = [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.cs',
      '.rb',
      '.go',
      '.php',
    ]
    const isCodeFile = codeExtensions.some(ext => filename.endsWith(ext))

    // Skip test files for architecture analysis
    const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filename) || filename.includes('__tests__')

    // Skip generated or build files
    const isGenerated =
      filename.includes('.generated.') ||
      filename.includes('.min.') ||
      filename.includes('.bundle.')

    return isCodeFile && !isTestFile && !isGenerated
  }

  /**
   * Calculate confidence score based on analysis quality
   */
  private calculateConfidence(issues: ReviewIssue[], context: ReviewContext): number {
    let baseConfidence = 0.75

    // Increase confidence if we found architectural issues
    if (issues.length > 0) {
      baseConfidence += 0.15
    }

    // Higher confidence for files that are more architecturally significant
    const architecturalFiles = context.changedFiles.filter(f =>
      /\/(components|services|models|controllers|middleware)\//i.test(f.filename)
    )

    if (architecturalFiles.length > 0) {
      baseConfidence += 0.1
    }

    return Math.max(0.1, Math.min(1.0, baseConfidence))
  }

  /**
   * Generate summary of architecture analysis
   */
  private generateSummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'No significant architectural issues detected in the code changes.'
    }

    const categoryBreakdown = issues.reduce(
      (acc, issue) => {
        const category = issue.category.replace('architecture-', '')
        acc[category] = (acc[category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    let summary = `Found ${issues.length} architectural issue(s): `

    const categoryParts = Object.entries(categoryBreakdown).map(
      ([category, count]) => `${count} ${category}`
    )
    summary += categoryParts.join(', ')

    // Highlight critical architectural issues
    const criticalIssues = issues.filter(i => i.severity === 'critical' || i.severity === 'error')
    if (criticalIssues.length > 0) {
      summary += `. 🏗️ ${criticalIssues.length} issue(s) may impact architectural integrity.`
    }

    return summary
  }

  /**
   * Helper methods for architectural analysis
   */
  private getExpectedLocation(filename: string, _context: ReviewContext): string | null {
    // Simple heuristics for expected locations
    if (filename.includes('component') || filename.includes('Component')) {
      return 'src/components/'
    }
    if (filename.includes('service') || filename.includes('Service')) {
      return 'src/services/'
    }
    if (filename.includes('model') || filename.includes('Model')) {
      return 'src/models/'
    }
    if (filename.includes('controller') || filename.includes('Controller')) {
      return 'src/controllers/'
    }

    return null
  }

  private breaksNamingPattern(oldName: string, newName: string): boolean {
    // Check if the naming convention changed significantly
    const oldPattern = this.extractNamingPattern(oldName)
    const newPattern = this.extractNamingPattern(newName)
    return oldPattern !== newPattern
  }

  private extractNamingPattern(filename: string): string {
    if (/\.component\.[jt]sx?$/.test(filename)) return 'component'
    if (/\.service\.[jt]s$/.test(filename)) return 'service'
    if (/\.model\.[jt]s$/.test(filename)) return 'model'
    if (/\.controller\.[jt]s$/.test(filename)) return 'controller'
    if (/\.test\.[jt]sx?$/.test(filename)) return 'test'
    if (/\.spec\.[jt]sx?$/.test(filename)) return 'spec'
    return 'general'
  }

  private hasCircularDependencyRisk(content: string, filename: string): boolean {
    // Simplified check for potential circular dependencies
    // In practice, you'd want a more sophisticated dependency graph analysis
    const imports = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || []
    const relativePath = filename.replace(/\/[^/]+$/, '')

    return imports.some(imp => {
      const importPath = imp.match(/from\s+['"]([^'"]+)['"]/)?.[1]
      return importPath && importPath.includes(relativePath)
    })
  }

  private formatArchitectureDescription(issue: any): string {
    let description = issue.description

    if (issue.principle) {
      description += `\n\n**Architectural Principle**: ${issue.principle}`
    }

    return description
  }

  private getArchitectureResources(category: string): string[] {
    const resourceMap: Record<string, string[]> = {
      'solid-violation': ['SOLID Principles Explained', 'Clean Code', 'Refactoring Guru'],
      'design-pattern': [
        'Design Patterns: Elements of Reusable Object-Oriented Software',
        'Refactoring Guru Patterns',
      ],
      'code-organization': ['Clean Architecture', 'Hexagonal Architecture'],
      'dependency-management': ['Dependency Inversion Principle', 'Inversion of Control'],
      modularity: ['Module Design Principles', 'Component-Based Architecture'],
    }

    return resourceMap[category] || ['Clean Code', 'Design Patterns', 'Software Architecture Guide']
  }

  private determineArchitectureComplexity(
    category: string
  ): 'beginner' | 'intermediate' | 'advanced' {
    const advancedCategories = ['dependency-management', 'modularity']
    const intermediateCategories = ['solid-violation', 'design-pattern']

    if (advancedCategories.includes(category)) {
      return 'advanced'
    } else if (intermediateCategories.includes(category)) {
      return 'intermediate'
    } else {
      return 'beginner'
    }
  }
}
