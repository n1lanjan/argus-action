/**
 * Logic Agent
 *
 * Specialized AI agent that focuses on code logic analysis using Claude Code.
 * This agent leverages Claude's deep understanding of code to identify:
 * - Logic errors and edge cases
 * - Business rule violations
 * - Complex algorithmic issues
 * - Code flow problems
 * - Integration and dependency issues
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
} from '../types'
import { buildLogicAnalysisPrompt } from '@/prompts'
import { parseAgentResponse } from '@/utils'

export class LogicAgent implements ReviewAgent {
  name: AgentType = 'logic'
  capabilities = [
    'Logic error detection',
    'Edge case identification',
    'Business rule validation',
    'Algorithm analysis',
    'Code flow verification',
    'Integration issue detection',
  ]
  priority = 1

  private anthropic: Anthropic
  private model: string

  constructor(private config: ReviewConfiguration) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Logic Agent')
    }

    this.anthropic = new Anthropic({ apiKey })
    this.model = config.models.anthropic
  }

  /**
   * Execute logic analysis on the code changes
   */
  async execute(context: ReviewContext): Promise<AgentResult> {
    const startTime = Date.now()
    core.info('🧠 Logic Agent: Starting code logic analysis...')

    try {
      const issues: ReviewIssue[] = []

      // Analyze each changed file for logic issues
      for (const file of context.changedFiles) {
        if (this.shouldAnalyzeFile(file.filename)) {
          const fileIssues = await this.analyzeFileLogic(file, context)
          issues.push(...fileIssues)
        }
      }

      // Generate overall summary
      const summary = this.generateSummary(issues, context)

      const result: AgentResult = {
        agent: 'logic',
        confidence: this.calculateConfidence(issues, context),
        issues,
        summary,
        executionTime: Date.now() - startTime,
      }

      core.info(`🧠 Logic Agent: Found ${issues.length} logic issues`)
      return result
    } catch (error) {
      core.error(`Logic Agent failed: ${error}`)
      throw error
    }
  }

  /**
   * Analyze a single file for logic issues
   */
  private async analyzeFileLogic(file: any, context: ReviewContext): Promise<ReviewIssue[]> {
    if (!file.patch || !file.content) {
      return []
    }

    const prompt = buildLogicAnalysisPrompt(file, context)

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

      return this.parseLogicIssues(response.content[0] as any, file.filename)
    } catch (error) {
      core.warning(`Failed to analyze ${file.filename}: ${error}`)
      return []
    }
  }

  /**
   * Build the analysis prompt for Claude
   */
  private buildAnalysisPrompt(file: any, context: ReviewContext): string {
    const { pullRequest, projectContext } = context

    return `You are an expert code reviewer specializing in logic analysis. Analyze the following code changes for potential logic issues, edge cases, and business rule violations.

## Project Context
- **Architecture**: ${projectContext.architecture.pattern}
- **Frameworks**: ${projectContext.frameworks.map(f => f.name).join(', ')}
- **Testing Strategy**: ${projectContext.testStrategy.framework}

## Pull Request Context
- **Title**: ${pullRequest.title}
- **Description**: ${pullRequest.description}

## File Analysis: ${file.filename}

### Current File Content (for context):
\`\`\`
${file.content?.substring(0, 8000) || 'Content not available'}
\`\`\`

### Changes Made:
\`\`\`diff
${file.patch}
\`\`\`

## Analysis Instructions

Please analyze the code changes for the following types of logic issues:

1. **Logic Errors**: Incorrect conditions, operators, or control flow
2. **Edge Cases**: Missing handling of boundary conditions, null values, empty arrays, etc.
3. **Business Logic**: Violations of domain rules or business requirements
4. **Algorithm Issues**: Inefficient or incorrect algorithmic approaches
5. **State Management**: Improper state transitions or mutations
6. **Error Handling**: Missing or inadequate error handling for edge cases
7. **Integration Issues**: Problems with external dependencies or APIs
8. **Data Consistency**: Issues that could lead to data corruption or inconsistency

## Response Format

For each issue found, provide:

\`\`\`json
{
  "severity": "critical|error|warning|info",
  "category": "logic-error|edge-case|business-rule|algorithm|state-management|error-handling|integration|data-consistency",
  "title": "Brief issue title",
  "description": "Detailed explanation of the issue",
  "line": line_number_or_null,
  "endLine": end_line_number_or_null,
  "snippet": "relevant code snippet",
  "suggestion": "specific fix suggestion",
  "rationale": "why this is important and what could go wrong",
  "bestPractice": "relevant best practice explanation"
}
\`\`\`

Focus on substantive issues that could affect correctness, reliability, or maintainability. Avoid style issues or minor optimizations unless they significantly impact logic.

If no significant logic issues are found, respond with an empty array: []`
  }

  /**
   * Parse Claude's response into ReviewIssue objects
   */
  private parseLogicIssues(response: any, filename: string): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const text = response.text || ''
    const parsedIssues = parseAgentResponse(text, filename, 'logic')

    for (const issue of parsedIssues) {
      issues.push({
        severity: issue.severity || 'warning',
        category: issue.category ? `logic-${issue.category}` : 'logic-general',
        title: `🧠 ${issue.title}`,
        description: issue.description,
        file: filename,
        line: issue.line,
        endLine: issue.endLine,
        snippet: issue.snippet,
        suggestion:
          typeof issue.suggestion === 'string' ? { comment: issue.suggestion } : issue.suggestion,
        coaching: {
          rationale: issue.rationale || '',
          resources: this.getLogicResources(issue.category),
          bestPractice: issue.bestPractice || '',
          level: this.determineComplexityLevel(issue.category),
        },
      })
    }

    return issues
  }

  /**
   * Determine if a file should be analyzed for logic issues
   */
  private shouldAnalyzeFile(filename: string): boolean {
    // Skip non-code files
    const codeExtensions = [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.c',
      '.cpp',
      '.cs',
      '.rb',
      '.go',
      '.php',
      '.swift',
      '.kt',
    ]
    const hasCodeExtension = codeExtensions.some(ext => filename.endsWith(ext))

    // Skip test files for logic analysis (they have different patterns)
    const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filename) || filename.includes('__tests__')

    // Skip generated files
    const isGenerated =
      filename.includes('.generated.') ||
      filename.includes('.min.') ||
      filename.includes('.bundle.')

    return hasCodeExtension && !isTestFile && !isGenerated
  }

  /**
   * Calculate confidence score based on analysis quality
   */
  private calculateConfidence(issues: ReviewIssue[], context: ReviewContext): number {
    let baseConfidence = 0.8

    // Increase confidence if we found issues (indicates good analysis)
    if (issues.length > 0) {
      baseConfidence += 0.1
    }

    // Adjust based on file types analyzed
    const analyzedFiles = context.changedFiles.filter(f => this.shouldAnalyzeFile(f.filename))
    if (analyzedFiles.length > 0) {
      baseConfidence += 0.05
    }

    // Reduce confidence if many files were skipped
    const skippedRatio =
      (context.changedFiles.length - analyzedFiles.length) / context.changedFiles.length
    if (skippedRatio > 0.5) {
      baseConfidence -= 0.2
    }

    return Math.max(0.1, Math.min(1.0, baseConfidence))
  }

  /**
   * Generate summary of logic analysis
   */
  private generateSummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'No significant logic issues detected in the code changes.'
    }

    const severityCounts = issues.reduce(
      (acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const categoryCounts = issues.reduce(
      (acc, issue) => {
        acc[issue.category] = (acc[issue.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    let summary = `Found ${issues.length} logic issues: `

    // Add severity breakdown
    const severityParts = Object.entries(severityCounts).map(
      ([severity, count]) => `${count} ${severity}`
    )
    summary += severityParts.join(', ')

    // Add most common categories
    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => `${category} (${count})`)

    if (topCategories.length > 0) {
      summary += `. Main areas: ${topCategories.join(', ')}`
    }

    // Add critical issue warning
    const criticalIssues = issues.filter(i => i.severity === 'critical')
    if (criticalIssues.length > 0) {
      summary += `. ⚠️ ${criticalIssues.length} critical issue(s) require immediate attention.`
    }

    return summary
  }

  /**
   * Get logic-specific learning resources based on category
   */
  private getLogicResources(category: string): string[] {
    const resourceMap: Record<string, string[]> = {
      'logic-error': ['Clean Code', 'Code Complete', 'Debugging Best Practices'],
      'edge-case': ['Defensive Programming', 'Testing Edge Cases', 'Error Handling Patterns'],
      'business-rule': ['Domain-Driven Design', 'Business Logic Patterns'],
      algorithm: ['Algorithm Design Manual', 'Introduction to Algorithms'],
      'state-management': ['State Patterns', 'Redux Documentation', 'State Machine Design'],
      'error-handling': ['Exception Handling Best Practices', 'Resilience Patterns'],
      integration: ['Integration Patterns', 'API Design Best Practices'],
      'data-consistency': ['ACID Properties', 'Transaction Management', 'Data Integrity'],
    }

    return resourceMap[category] || ['Clean Code', 'Software Engineering Best Practices']
  }

  /**
   * Determine complexity level for coaching
   */
  private determineComplexityLevel(category: string): 'beginner' | 'intermediate' | 'advanced' {
    const complexCategories = ['algorithm', 'state-management', 'integration', 'data-consistency']
    const intermediateCategories = ['business-rule', 'error-handling']

    if (complexCategories.includes(category)) {
      return 'advanced'
    } else if (intermediateCategories.includes(category)) {
      return 'intermediate'
    } else {
      return 'beginner'
    }
  }
}
