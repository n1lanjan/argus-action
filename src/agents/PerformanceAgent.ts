/**
 * Performance Agent
 *
 * Specialized AI agent focused on performance optimization and bottleneck detection.
 * This agent analyzes code changes for:
 * - Performance bottlenecks
 * - Inefficient algorithms
 * - Memory leaks and resource waste
 * - Database query optimization
 * - Bundle size optimization
 * - Runtime performance issues
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
import { buildPerformanceAnalysisPrompt } from '@/prompts'
import { parseAgentResponse } from '@/utils'

export class PerformanceAgent implements ReviewAgent {
  name: AgentType = 'performance'
  capabilities = [
    'Performance bottleneck detection',
    'Algorithm efficiency analysis',
    'Memory leak detection',
    'Database optimization',
    'Bundle size analysis',
    'Runtime performance review',
  ]
  priority = 1

  private anthropic: Anthropic
  private model: string

  constructor(private config: ReviewConfiguration) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Performance Agent')
    }

    this.anthropic = new Anthropic({ apiKey })
    this.model = config.models.anthropic
  }

  /**
   * Execute performance analysis on the code changes
   */
  async execute(context: ReviewContext): Promise<AgentResult> {
    const startTime = Date.now()
    core.info('⚡ Performance Eye: Starting performance analysis...')

    try {
      const issues: ReviewIssue[] = []

      // Analyze each changed file for performance issues
      for (const file of context.changedFiles) {
        if (this.shouldAnalyzeFile(file.filename)) {
          const fileIssues = await this.analyzeFilePerformance(file, context)
          issues.push(...fileIssues)
        }
      }

      // Generate overall summary
      const summary = this.generateSummary(issues, context)

      const result: AgentResult = {
        agent: 'performance',
        confidence: this.calculateConfidence(issues, context),
        issues,
        summary,
        executionTime: Date.now() - startTime,
      }

      core.info(`⚡ Performance Eye: Found ${issues.length} performance issues`)
      return result
    } catch (error) {
      core.error(`Performance Agent failed: ${error}`)
      throw error
    }
  }

  /**
   * Analyze a single file for performance issues
   */
  private async analyzeFilePerformance(file: any, context: ReviewContext): Promise<ReviewIssue[]> {
    if (!file.patch || !file.content) {
      return []
    }

    const prompt = buildPerformanceAnalysisPrompt(file, context)

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    return this.parsePerformanceIssues(response.content[0] as any, file.filename)
  }

  /**
   * Parse Claude's response into performance issues
   */
  private parsePerformanceIssues(response: any, filename: string): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const text = response.text || ''
    const parsedIssues = parseAgentResponse(text, filename, 'performance')

    for (const issue of parsedIssues) {
      issues.push({
        severity: issue.severity || 'warning',
        category: issue.category ? `performance-${issue.category}` : 'performance-general',
        title: `⚡ ${issue.title}`,
        description: this.formatPerformanceDescription(issue),
        file: filename,
        line: issue.line,
        endLine: issue.endLine,
        snippet: issue.snippet,
        suggestion:
          typeof issue.suggestion === 'string' ? { comment: issue.suggestion } : issue.suggestion,
        coaching: {
          rationale: issue.rationale || '',
          resources: this.getPerformanceResources(issue.category),
          bestPractice: issue.bestPractice || '',
          level: this.determinePerformanceComplexity(issue.category),
        },
      })
    }

    return issues
  }

  /**
   * Determine if a file should be analyzed for performance
   */
  private shouldAnalyzeFile(filename: string): boolean {
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
    return codeExtensions.some(ext => filename.endsWith(ext))
  }

  /**
   * Calculate confidence score based on analysis quality
   */
  private calculateConfidence(_issues: ReviewIssue[], _context: ReviewContext): number {
    return 0.7 // Placeholder confidence
  }

  /**
   * Format performance issue description with additional context
   */
  private formatPerformanceDescription(issue: any): string {
    let description = issue.description

    if (issue.impact) {
      description += `\n\n**Performance Impact**: ${issue.impact}`
    }

    if (issue.complexity) {
      description += `\n\n**Time Complexity**: ${issue.complexity}`
    }

    return description
  }

  /**
   * Get performance learning resources based on category
   */
  private getPerformanceResources(category: string): string[] {
    const resourceMap: Record<string, string[]> = {
      'algorithm-efficiency': ['Algorithm Design Manual', 'Introduction to Algorithms'],
      'memory-optimization': ['Memory Management Best Practices', 'Garbage Collection Tuning'],
      'database-optimization': ['Database Performance Tuning', 'SQL Optimization Guide'],
      'bundle-size': ['Web Performance Optimization', 'Bundle Analysis Tools'],
      'runtime-performance': ['JavaScript Performance', 'Runtime Optimization Techniques'],
      caching: ['Caching Strategies', 'Cache Design Patterns'],
    }

    return (
      resourceMap[category] || ['Web Performance Best Practices', 'Performance Optimization Guide']
    )
  }

  /**
   * Determine complexity level for performance coaching
   */
  private determinePerformanceComplexity(
    category: string
  ): 'beginner' | 'intermediate' | 'advanced' {
    const advancedCategories = [
      'algorithm-efficiency',
      'memory-optimization',
      'database-optimization',
    ]
    const intermediateCategories = ['bundle-size', 'caching']

    if (advancedCategories.includes(category)) {
      return 'advanced'
    } else if (intermediateCategories.includes(category)) {
      return 'intermediate'
    } else {
      return 'beginner'
    }
  }

  /**
   * Generate summary of performance analysis
   */
  private generateSummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'No significant performance issues detected in the code changes.'
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length

    let summary = `Found ${issues.length} performance issue(s): `

    const severityParts = []
    if (criticalCount > 0) severityParts.push(`${criticalCount} critical`)
    if (errorCount > 0) severityParts.push(`${errorCount} high`)
    if (warningCount > 0) severityParts.push(`${warningCount} medium`)

    summary += severityParts.join(', ')

    if (criticalCount > 0) {
      summary += '. ⚡ Critical performance issues may significantly impact application speed.'
    }

    return summary
  }
}
