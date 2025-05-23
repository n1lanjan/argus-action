/**
 * Testing Agent
 *
 * Specialized AI agent focused on test quality and coverage analysis.
 * This agent analyzes code changes for:
 * - Test coverage adequacy
 * - Test quality and effectiveness
 * - Missing test scenarios
 * - Test maintainability
 * - Testing best practices
 * - Integration test needs
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
import { buildTestingAnalysisPrompt } from '@/prompts'

export class TestingAgent implements ReviewAgent {
  name: AgentType = 'testing'
  capabilities = [
    'Test coverage analysis',
    'Test quality assessment',
    'Missing test detection',
    'Test maintainability review',
    'Testing best practices',
    'Integration test guidance',
  ]
  priority = 1

  private anthropic: Anthropic
  private model: string

  constructor(private config: ReviewConfiguration) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Testing Agent')
    }

    this.anthropic = new Anthropic({ apiKey })
    this.model = config.models.anthropic
  }

  /**
   * Execute testing analysis on the code changes
   */
  async execute(context: ReviewContext): Promise<AgentResult> {
    const startTime = Date.now()
    core.info('🧪 Testing Eye: Starting test quality analysis...')

    try {
      const issues: ReviewIssue[] = []

      // Analyze each changed file for testing issues
      for (const file of context.changedFiles) {
        if (this.shouldAnalyzeFile(file.filename)) {
          const fileIssues = await this.analyzeFileTesting(file, context)
          issues.push(...fileIssues)
        }
      }

      // Generate overall summary
      const summary = this.generateSummary(issues, context)

      const result: AgentResult = {
        agent: 'testing',
        confidence: this.calculateConfidence(issues, context),
        issues,
        summary,
        executionTime: Date.now() - startTime,
      }

      core.info(`🧪 Testing Eye: Found ${issues.length} testing issues`)
      return result
    } catch (error) {
      core.error(`Testing Agent failed: ${error}`)
      throw error
    }
  }

  /**
   * Analyze a single file for testing issues
   */
  private async analyzeFileTesting(file: any, context: ReviewContext): Promise<ReviewIssue[]> {
    if (!file.patch || !file.content) {
      return []
    }

    try {
      const prompt = buildTestingAnalysisPrompt(file, context)

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        core.warning('Unexpected response format from Testing Agent')
        return []
      }

      // Parse the response
      let parsed: any
      try {
        parsed = JSON.parse(content.text)
      } catch (parseError) {
        core.warning(`Failed to parse Testing Agent response: ${parseError}`)
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
      core.warning(`Testing Agent analysis failed for ${file.filename}: ${error}`)
      return []
    }
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filename: string): boolean {
    return /\.(test|spec)\.[jt]sx?$/.test(filename) || filename.includes('__tests__')
  }

  /**
   * Check if file is a source file that should have tests
   */
  private isSourceFile(filename: string): boolean {
    return (
      /\.[jt]sx?$/.test(filename) && !this.isTestFile(filename) && !filename.includes('.config.')
    )
  }

  /**
   * Determine if a file should be analyzed for testing
   */
  private shouldAnalyzeFile(filename: string): boolean {
    return this.isSourceFile(filename) || this.isTestFile(filename)
  }

  /**
   * Calculate confidence score based on analysis quality
   */
  private calculateConfidence(_issues: ReviewIssue[], _context: ReviewContext): number {
    return 0.6 // Placeholder confidence
  }

  /**
   * Generate summary of testing analysis
   */
  private generateSummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'Test coverage and quality appear adequate for the changes made.'
    }

    return `Found ${issues.length} testing-related issue(s) that could improve code reliability.`
  }
}
