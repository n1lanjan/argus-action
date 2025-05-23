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

    try {
      const prompt = buildPerformanceAnalysisPrompt(file, context)

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        core.warning('Unexpected response format from Performance Agent')
        return []
      }

      // Parse the response
      let parsed: any
      try {
        parsed = JSON.parse(content.text)
      } catch (parseError) {
        core.warning(`Failed to parse Performance Agent response: ${parseError}`)
        return []
      }

      // Validate and transform issues
      const issues: ReviewIssue[] = []
      if (Array.isArray(parsed.issues)) {
        for (const issue of parsed.issues) {
          if (issue.severity && issue.category && issue.title && issue.description) {
            issues.push({
              ...issue,
              file: file.filename,
              suggestion:
                typeof issue.suggestion === 'string'
                  ? { comment: issue.suggestion }
                  : issue.suggestion,
            })
          }
        }
      }

      return issues
    } catch (error) {
      core.warning(`Performance Agent analysis failed for ${file.filename}: ${error}`)
      return []
    }
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
   * Generate summary of performance analysis
   */
  private generateSummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'No significant performance issues detected in the code changes.'
    }

    return `Found ${issues.length} performance issue(s) that could impact application speed and efficiency.`
  }
}
