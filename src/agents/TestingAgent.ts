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
import { parseAgentResponse } from '@/utils'

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

    const prompt = buildTestingAnalysisPrompt(file, context)

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      return this.parseTestingIssues(response.content[0] as any, file.filename)
    } catch (error) {
      core.warning(`Failed to analyze ${file.filename} for testing: ${error}`)
      return []
    }
  }

  /**
   * Parse Claude's response into testing issues
   */
  private parseTestingIssues(response: any, filename: string): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const text = response.text || ''
    const parsedIssues = parseAgentResponse(text, filename, 'testing')

    for (const issue of parsedIssues) {
      issues.push({
        severity: issue.severity || 'warning',
        category: issue.category ? `testing-${issue.category}` : 'testing-general',
        title: `🧪 ${issue.title}`,
        description: this.formatTestingDescription(issue),
        file: filename,
        line: issue.line,
        endLine: issue.endLine,
        snippet: issue.snippet,
        suggestion:
          typeof issue.suggestion === 'string' ? { comment: issue.suggestion } : issue.suggestion,
        coaching: {
          rationale: issue.rationale || '',
          resources: this.getTestingResources(issue.category),
          bestPractice: issue.bestPractice || '',
          level: this.determineTestingComplexity(issue.category),
        },
      })
    }

    return issues
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
   * Format testing issue description with additional context
   */
  private formatTestingDescription(issue: any): string {
    let description = issue.description

    if (issue.testType) {
      description += `\n\n**Test Type**: ${issue.testType}`
    }

    if (issue.coverage) {
      description += `\n\n**Coverage Impact**: ${issue.coverage}`
    }

    return description
  }

  /**
   * Get testing learning resources based on category
   */
  private getTestingResources(category: string): string[] {
    const resourceMap: Record<string, string[]> = {
      'test-coverage': ['Testing Strategies', 'Code Coverage Best Practices'],
      'test-quality': ['Effective Unit Testing', 'Test-Driven Development'],
      'missing-tests': ['Testing Pyramid', 'Test Strategy Guide'],
      'test-maintainability': ['Maintainable Test Code', 'Test Refactoring'],
      'integration-testing': ['Integration Testing Patterns', 'API Testing Guide'],
      'performance-testing': ['Performance Testing Best Practices', 'Load Testing Guide'],
    }

    return resourceMap[category] || ['Testing Best Practices', 'Software Testing Guide']
  }

  /**
   * Determine complexity level for testing coaching
   */
  private determineTestingComplexity(category: string): 'beginner' | 'intermediate' | 'advanced' {
    const advancedCategories = ['integration-testing', 'performance-testing']
    const intermediateCategories = ['test-maintainability', 'test-quality']

    if (advancedCategories.includes(category)) {
      return 'advanced'
    } else if (intermediateCategories.includes(category)) {
      return 'intermediate'
    } else {
      return 'beginner'
    }
  }

  /**
   * Generate summary of testing analysis
   */
  private generateSummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'Test coverage and quality appear adequate for the changes made.'
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length

    let summary = `Found ${issues.length} testing issue(s): `

    const severityParts = []
    if (criticalCount > 0) severityParts.push(`${criticalCount} critical`)
    if (errorCount > 0) severityParts.push(`${errorCount} high`)
    if (warningCount > 0) severityParts.push(`${warningCount} medium`)

    summary += severityParts.join(', ')

    if (criticalCount > 0) {
      summary += '. 🧪 Critical testing gaps may compromise code reliability.'
    }

    return summary
  }
}
