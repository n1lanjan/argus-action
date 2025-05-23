/**
 * Review Synthesizer
 *
 * Combines results from multiple agents into coherent, actionable feedback.
 * This component:
 * - Aggregates findings from all agents
 * - Removes duplicates and conflicts
 * - Prioritizes issues by severity and impact
 * - Generates coaching recommendations
 * - Creates final review summary
 */

import * as core from '@actions/core'
import {
  AgentResult,
  LintResult,
  ReviewContext,
  FinalReview,
  ReviewIssue,
  ReviewConfiguration,
  CoachingInfo,
  ReviewMetrics,
} from '../types'

export class ReviewSynthesizer {
  constructor(private config: ReviewConfiguration) {}

  /**
   * Synthesize all agent results and linting into final review
   */
  async synthesize(
    agentResults: AgentResult[],
    lintResults: LintResult,
    context: ReviewContext
  ): Promise<FinalReview> {
    core.info('⚡ Synthesizing review from all agents...')

    const startTime = Date.now()

    // Aggregate all issues from agents
    const allIssues = this.aggregateIssues(agentResults)

    // Remove duplicates and resolve conflicts
    const deduplicatedIssues = this.deduplicateIssues(allIssues)

    // Categorize issues by severity and blocking status
    const { blockingIssues, recommendations } = this.categorizeIssues(deduplicatedIssues)

    // Generate coaching recommendations
    const coaching = this.generateCoaching(deduplicatedIssues)

    // Create overall summary
    const summary = this.generateSummary(agentResults, blockingIssues, recommendations, context)

    // Calculate metrics
    const metrics = this.calculateMetrics(agentResults, deduplicatedIssues, startTime)

    const finalReview: FinalReview = {
      summary,
      blockingIssues,
      recommendations,
      lintingSummary: lintResults,
      coaching,
      metrics,
    }

    core.info(
      `⚡ Synthesis complete: ${blockingIssues.length} blocking, ${recommendations.length} recommendations`
    )

    return finalReview
  }

  /**
   * Aggregate issues from all agent results
   */
  private aggregateIssues(agentResults: AgentResult[]): ReviewIssue[] {
    const allIssues: ReviewIssue[] = []

    for (const result of agentResults) {
      // Weight issues by agent confidence
      const weightedIssues = result.issues.map(issue => ({
        ...issue,
        // Add agent info and adjust severity based on confidence
        metadata: {
          agent: result.agent,
          confidence: result.confidence,
          originalSeverity: issue.severity,
        },
      }))

      allIssues.push(...weightedIssues)
    }

    return allIssues
  }

  /**
   * Remove duplicate issues and resolve conflicts
   */
  private deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const deduplicatedMap = new Map<string, ReviewIssue>()

    for (const issue of issues) {
      // Create a key based on file, line, and issue type
      const key = `${issue.file}:${issue.line}:${issue.category}`

      const existing = deduplicatedMap.get(key)
      if (!existing) {
        deduplicatedMap.set(key, issue)
      } else {
        // Keep the issue with higher severity or confidence
        const shouldReplace = this.shouldReplaceIssue(existing, issue)
        if (shouldReplace) {
          deduplicatedMap.set(key, issue)
        }
      }
    }

    return Array.from(deduplicatedMap.values())
  }

  /**
   * Determine if one issue should replace another
   */
  private shouldReplaceIssue(existing: ReviewIssue, candidate: ReviewIssue): boolean {
    const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 }

    const existingSeverity = severityOrder[existing.severity]
    const candidateSeverity = severityOrder[candidate.severity]

    // Higher severity wins
    if (candidateSeverity > existingSeverity) {
      return true
    }

    // If same severity, higher confidence wins
    if (candidateSeverity === existingSeverity) {
      const existingConfidence = (existing as any).metadata?.confidence || 0.5
      const candidateConfidence = (candidate as any).metadata?.confidence || 0.5
      return candidateConfidence > existingConfidence
    }

    return false
  }

  /**
   * Categorize issues into blocking vs recommendations
   */
  private categorizeIssues(issues: ReviewIssue[]): {
    blockingIssues: ReviewIssue[]
    recommendations: ReviewIssue[]
  } {
    const blockingIssues: ReviewIssue[] = []
    const recommendations: ReviewIssue[] = []

    const strictnessSettings = this.getStrictnessSettings()

    for (const issue of issues) {
      if (this.isBlockingIssue(issue, strictnessSettings)) {
        blockingIssues.push(issue)
      } else {
        recommendations.push(issue)
      }
    }

    // Sort by severity
    const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 }
    const sortBySeverity = (a: ReviewIssue, b: ReviewIssue) =>
      severityOrder[b.severity] - severityOrder[a.severity]

    blockingIssues.sort(sortBySeverity)
    recommendations.sort(sortBySeverity)

    return { blockingIssues, recommendations }
  }

  /**
   * Determine if an issue is blocking based on strictness level
   */
  private isBlockingIssue(issue: ReviewIssue, settings: any): boolean {
    if (!settings.blockOnIssues) {
      return false
    }

    const severityOrder: Record<string, number> = { critical: 4, error: 3, warning: 2, info: 1 }
    const thresholdOrder: Record<string, number> = { critical: 4, error: 3, warning: 2, info: 1 }

    return (severityOrder[issue.severity] || 0) >= (thresholdOrder[settings.severityThreshold] || 0)
  }

  /**
   * Generate coaching recommendations
   */
  private generateCoaching(issues: ReviewIssue[]): CoachingInfo[] {
    if (!this.config.enableCoaching) {
      return []
    }

    const coachingMap = new Map<string, CoachingInfo>()

    for (const issue of issues) {
      if (issue.coaching) {
        const key = issue.coaching.bestPractice
        if (!coachingMap.has(key)) {
          coachingMap.set(key, issue.coaching)
        }
      }
    }

    // Return top coaching opportunities
    return Array.from(coachingMap.values()).slice(0, 5)
  }

  /**
   * Generate overall review summary
   */
  private generateSummary(
    agentResults: AgentResult[],
    blockingIssues: ReviewIssue[],
    recommendations: ReviewIssue[],
    context: ReviewContext
  ): string {
    const totalIssues = blockingIssues.length + recommendations.length
    const activeAgents = agentResults.filter(r => r.issues.length > 0)

    let summary = `Argus has completed analysis of ${context.changedFiles.length} changed files using ${agentResults.length} specialized eyes.\n\n`

    if (totalIssues === 0) {
      summary +=
        '✅ **All Clear!** No significant issues detected. The code changes look good to merge.\n\n'
      summary += `**Agent Activity**: ${activeAgents.map(a => `${this.getAgentEmoji(a.agent)} ${a.agent}`).join(', ')}`
    } else {
      if (blockingIssues.length > 0) {
        summary += `🚫 **${blockingIssues.length} Blocking Issue(s)** must be resolved before merging.\n\n`
      }

      if (recommendations.length > 0) {
        summary += `💡 **${recommendations.length} Recommendation(s)** to improve code quality.\n\n`
      }

      // Agent summary
      summary += '**Eyes that found issues**:\n'
      for (const result of activeAgents) {
        const emoji = this.getAgentEmoji(result.agent)
        const issueCount = result.issues.length
        const confidence = Math.round(result.confidence * 100)
        summary += `- ${emoji} **${result.agent}**: ${issueCount} issues (${confidence}% confidence)\n`
      }
    }

    return summary
  }

  /**
   * Calculate performance and quality metrics
   */
  private calculateMetrics(
    agentResults: AgentResult[],
    issues: ReviewIssue[],
    startTime: number
  ): ReviewMetrics {
    const filesReviewed = new Set(issues.map(i => i.file)).size
    const executionTime = Date.now() - startTime

    const agentPerformance: Record<string, any> = {}
    for (const result of agentResults) {
      agentPerformance[result.agent] = {
        issuesFound: result.issues.length,
        executionTime: result.executionTime,
        averageConfidence: result.confidence,
      }
    }

    return {
      filesReviewed,
      issuesFound: issues.length,
      executionTime,
      agentPerformance: agentPerformance as any,
    }
  }

  /**
   * Get strictness settings based on configuration
   */
  private getStrictnessSettings() {
    switch (this.config.strictnessLevel) {
      case 'coaching':
        return {
          blockOnIssues: false,
          severityThreshold: 'info',
          maxIssuesPerFile: 10,
        }
      case 'standard':
        return {
          blockOnIssues: false,
          severityThreshold: 'warning',
          maxIssuesPerFile: 5,
        }
      case 'strict':
        return {
          blockOnIssues: true,
          severityThreshold: 'warning',
          maxIssuesPerFile: 3,
        }
      case 'blocking':
        return {
          blockOnIssues: true,
          severityThreshold: 'error',
          maxIssuesPerFile: 1,
        }
      default:
        return {
          blockOnIssues: false,
          severityThreshold: 'warning',
          maxIssuesPerFile: 5,
        }
    }
  }

  /**
   * Get emoji for agent type
   */
  private getAgentEmoji(agentType: string): string {
    const emojiMap: Record<string, string> = {
      security: '🔒',
      architecture: '🏗️',
      logic: '🧠',
      performance: '⚡',
      testing: '🧪',
    }

    return emojiMap[agentType] || '👁️'
  }
}
