/**
 * GitHub Service
 *
 * Handles all interactions with the GitHub API including:
 * - Pull request information retrieval
 * - File change detection
 * - Comment posting and management
 * - Review submission
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { PullRequestInfo, ChangedFile, FinalReview, ReviewConfiguration } from '../types'

type Octokit = ReturnType<typeof github.getOctokit>

export class GitHubService {
  public readonly octokit: Octokit
  private readonly context = github.context

  constructor(private config: ReviewConfiguration) {
    const token = process.env.GITHUB_TOKEN || core.getInput('github-token')
    if (!token) {
      throw new Error('GitHub token is required')
    }

    this.octokit = github.getOctokit(token)
  }

  /**
   * Get pull request information from the current context
   */
  async getPullRequestInfo(): Promise<PullRequestInfo> {
    if (!this.context.payload.pull_request) {
      throw new Error('No pull request found in context')
    }

    const pr = this.context.payload.pull_request

    return {
      number: pr.number,
      title: pr.title,
      description: pr.body || '',
      base: {
        sha: pr.base.sha,
        ref: pr.base.ref,
      },
      head: {
        sha: pr.head.sha,
        ref: pr.head.ref,
      },
      author: pr.user.login,
      repository: {
        owner: this.context.repo.owner,
        name: this.context.repo.repo,
      },
    }
  }

  /**
   * Get list of changed files in the pull request
   */
  async getChangedFiles(): Promise<ChangedFile[]> {
    const pr = await this.getPullRequestInfo()

    try {
      // Get files changed in the PR
      const response = await this.octokit.rest.pulls.listFiles({
        owner: pr.repository.owner,
        repo: pr.repository.name,
        pull_number: pr.number,
        per_page: 100, // GitHub's maximum
      })

      const changedFiles: ChangedFile[] = []

      for (const file of response.data) {
        // Get file content for context
        let content: string | undefined

        if (file.status !== 'removed') {
          try {
            const contentResponse = await this.octokit.rest.repos.getContent({
              owner: pr.repository.owner,
              repo: pr.repository.name,
              path: file.filename,
              ref: pr.head.sha,
            })

            if ('content' in contentResponse.data) {
              content = Buffer.from(contentResponse.data.content, 'base64').toString('utf8')
            }
          } catch (error) {
            core.debug(`Could not get content for ${file.filename}: ${error}`)
          }
        }

        changedFiles.push({
          filename: file.filename,
          status:
            file.status === 'removed'
              ? 'deleted'
              : (file.status as 'added' | 'modified' | 'deleted' | 'renamed'),
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch,
          previousFilename: file.previous_filename,
          priority: 'medium', // Will be set by FilePrioritizer
          content,
        })
      }

      core.info(`📁 Found ${changedFiles.length} changed files`)
      return changedFiles
    } catch (error) {
      core.error(`Failed to get changed files: ${error}`)
      throw error
    }
  }

  /**
   * Post review results to the pull request
   */
  async postReview(review: FinalReview, context: { pullRequest: PullRequestInfo }): Promise<void> {
    const pr = context.pullRequest

    try {
      // Post main review comment
      await this.postMainReviewComment(review, pr.number)

      // Post individual issue comments
      await this.postIssueComments(review, pr.number, pr.head.sha)

      // Update PR description if enabled
      if (this.config.updatePrDescription !== 'disabled') {
        await this.updatePrDescription(review, pr.number)
      }

      // Submit review if there are blocking issues
      if (review.blockingIssues.length > 0) {
        await this.submitBlockingReview(review, pr.number, pr.head.sha)
      }

      core.info('✅ Review posted successfully')
    } catch (error) {
      core.error(`Failed to post review: ${error}`)
      throw error
    }
  }

  /**
   * Post the main review summary comment
   */
  private async postMainReviewComment(review: FinalReview, prNumber: number): Promise<void> {
    const comment = this.formatMainReviewComment(review)

    // Check if there's an existing review comment to update
    const existingComment = await this.findExistingReviewComment(prNumber)

    if (existingComment) {
      await this.octokit.rest.issues.updateComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        comment_id: existingComment.id,
        body: comment,
      })
      core.info('📝 Updated existing review comment')
    } else {
      await this.octokit.rest.issues.createComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: prNumber,
        body: comment,
      })
      core.info('📝 Created new review comment')
    }
  }

  /**
   * Post individual issue comments on specific lines
   */
  private async postIssueComments(
    review: FinalReview,
    prNumber: number,
    commitSha: string
  ): Promise<void> {
    const allIssues = [...review.blockingIssues, ...review.recommendations]
    const issuesWithLines = allIssues.filter(issue => issue.line !== undefined)

    for (const issue of issuesWithLines) {
      if (issue.line === undefined) continue

      try {
        // Try to map the full file line number to a diff line position
        const diffPosition = await this.mapFileLinesWithDiff(issue.file, issue.line, prNumber)

        if (!diffPosition) {
          // Line is not in the diff - skip line-specific comment
          core.debug(
            `Line ${issue.line} in ${issue.file} is not part of the diff - skipping line comment`
          )
          continue
        }

        const commentParams = {
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          pull_number: prNumber,
          body: this.formatIssueComment(issue),
          commit_id: commitSha,
          path: issue.file,
          side: 'RIGHT' as const, // Default to RIGHT side (new/modified lines)
          ...diffPosition, // This will include line and potentially start_line/start_side
        }

        await this.octokit.rest.pulls.createReviewComment(commentParams)
        core.debug(`Posted comment for ${issue.file}:${issue.line}`)
      } catch (error) {
        core.warning(`Could not post comment for ${issue.file}:${issue.line}: ${error}`)
      }
    }

    core.info(`💬 Posted ${issuesWithLines.length} line-specific comments`)
  }

  /**
   * Update PR description with Argus summary
   */
  private async updatePrDescription(review: FinalReview, prNumber: number): Promise<void> {
    try {
      // Get current PR details
      const prResponse = await this.octokit.rest.pulls.get({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        pull_number: prNumber,
      })

      const currentDescription = prResponse.data.body || ''
      const argusSection = this.generatePrDescriptionSummary(review)

      let newDescription: string

      if (this.config.updatePrDescription === 'overwrite') {
        // Overwrite mode: Replace entire description with Argus content
        newDescription = argusSection
      } else {
        // Append mode: Add Argus section to existing content
        const argusMarkerStart = '<!-- argus-pr-summary-start -->'
        const argusMarkerEnd = '<!-- argus-pr-summary-end -->'

        if (currentDescription.includes(argusMarkerStart)) {
          // Replace existing Argus section while preserving user content
          const beforeArgus = currentDescription.split(argusMarkerStart)[0].trimEnd()
          const afterArgusMatch = currentDescription.split(argusMarkerEnd)
          const afterArgus = afterArgusMatch.length > 1 ? afterArgusMatch[1].trimStart() : ''

          newDescription =
            beforeArgus + '\n\n' + argusSection + (afterArgus ? '\n\n' + afterArgus : '')
        } else {
          // First time: Append Argus section to existing description
          newDescription = currentDescription + (currentDescription ? '\n\n' : '') + argusSection
        }
      }

      // Update PR description
      await this.octokit.rest.pulls.update({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        pull_number: prNumber,
        body: newDescription.trim(),
      })

      const mode = this.config.updatePrDescription
      core.info(`📝 Updated PR description with Argus summary (${mode} mode)`)
    } catch (error) {
      core.warning(`Could not update PR description: ${error}`)
    }
  }

  /**
   * Generate PR description summary section
   */
  private generatePrDescriptionSummary(review: FinalReview): string {
    const criticalIssues = review.blockingIssues.filter(issue => issue.severity === 'critical')
    const highIssues = review.blockingIssues.filter(issue => issue.severity === 'error')
    const warningIssues = [
      ...review.blockingIssues.filter(issue => issue.severity === 'warning'),
      ...review.recommendations.filter(issue => issue.severity === 'warning'),
    ]

    // Determine risk level
    let riskLevel = '🟢 Low'

    if (criticalIssues.length > 0) {
      riskLevel = '🔴 Critical'
    } else if (highIssues.length > 0) {
      riskLevel = '🟠 High'
    } else if (warningIssues.length > 0) {
      riskLevel = '🟡 Medium'
    }

    let summary = '<!-- argus-pr-summary-start -->\n'
    summary += '## 👁️ Argus Code Review Summary\n\n'

    summary += `**Risk Level**: ${riskLevel}  \n`
    summary += `**Files Analyzed**: ${review.metrics.filesReviewed}  \n`
    summary += `**Issues Found**: ${review.metrics.issuesFound}  \n`

    if (review.metrics.issuesFound > 0) {
      summary += '\n**Issue Breakdown**:\n'
      if (criticalIssues.length > 0) summary += `- 🔴 Critical: ${criticalIssues.length}\n`
      if (highIssues.length > 0) summary += `- 🟠 High: ${highIssues.length}\n`
      if (warningIssues.length > 0) summary += `- 🟡 Medium: ${warningIssues.length}\n`

      const infoIssues = review.recommendations.filter(issue => issue.severity === 'info').length
      if (infoIssues > 0) summary += `- 🔵 Info: ${infoIssues}\n`
    }

    // Add quick summary
    summary += '\n'
    if (criticalIssues.length > 0) {
      summary +=
        '⚠️ **Action Required**: Critical issues found that should be addressed before merging.\n\n'
    } else if (highIssues.length > 0) {
      summary += '⚠️ **Review Recommended**: High-priority issues found.\n\n'
    } else if (review.metrics.issuesFound > 0) {
      summary += '💡 **Improvements Available**: Minor issues and recommendations found.\n\n'
    } else {
      summary += '✅ **Clean Code**: No issues detected by Argus review.\n\n'
    }

    summary += `📋 [View Detailed Review](#issuecomment-argus)\n`
    summary += '<!-- argus-pr-summary-end -->'

    return summary
  }

  /**
   * Map file line numbers to diff positions for PR comments
   * Returns null if the line is not part of the diff
   */
  private async mapFileLinesWithDiff(
    filename: string,
    lineNumber: number,
    prNumber: number
  ): Promise<{ line: number } | null> {
    try {
      // Get the PR files to access the patch/diff information
      const response = await this.octokit.rest.pulls.listFiles({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        pull_number: prNumber,
      })

      const file = response.data.find(f => f.filename === filename)
      if (!file || !file.patch) {
        return null
      }

      // Parse the diff to find if our line number is in the diff
      const diffLines = file.patch.split('\n')
      let currentRightLine = 0

      for (const diffLine of diffLines) {
        // Parse hunk headers like "@@ -1,4 +1,6 @@"
        const hunkMatch = diffLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        if (hunkMatch) {
          currentRightLine = parseInt(hunkMatch[1]) - 1 // -1 because we increment before checking
          continue
        }

        // Handle different types of diff lines
        if (diffLine.startsWith('+')) {
          // Addition - this line exists in the new version
          currentRightLine++
          if (currentRightLine === lineNumber) {
            // Line is in the diff, return the actual line number
            return { line: lineNumber }
          }
        } else if (diffLine.startsWith('-')) {
          // Deletion - only in old version, skip
          continue
        } else if (diffLine.startsWith(' ')) {
          // Context line - exists in both versions
          currentRightLine++
          if (currentRightLine === lineNumber) {
            // Line is in the diff, return the actual line number
            return { line: lineNumber }
          }
        }
        // Lines starting with \ (like "\ No newline at end of file") are ignored
      }

      return null // Line not found in diff
    } catch (error) {
      core.debug(`Failed to map line ${lineNumber} in ${filename}: ${error}`)
      return null
    }
  }

  /**
   * Submit a blocking review if there are critical issues
   */
  private async submitBlockingReview(
    review: FinalReview,
    prNumber: number,
    commitSha: string
  ): Promise<void> {
    const criticalIssues = review.blockingIssues.filter(issue => issue.severity === 'critical')

    if (criticalIssues.length > 0) {
      await this.octokit.rest.pulls.createReview({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        pull_number: prNumber,
        commit_id: commitSha,
        event: 'REQUEST_CHANGES',
        body: `## ⚠️ Critical Issues Found\n\nThis PR has ${criticalIssues.length} critical issue(s) that must be addressed before merging.\n\n${criticalIssues.map(issue => `- **${issue.title}**: ${issue.description}`).join('\n')}`,
      })

      core.info('🚫 Submitted blocking review due to critical issues')
    }
  }

  /**
   * Find existing review comment from this action
   */
  private async findExistingReviewComment(
    prNumber: number
  ): Promise<{ id: number; body?: string } | undefined> {
    const comments = await this.octokit.rest.issues.listComments({
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      issue_number: prNumber,
    })

    return comments.data.find(comment => comment.body?.includes('<!-- argus-summary -->'))
  }

  /**
   * Format the main review comment
   */
  private formatMainReviewComment(review: FinalReview): string {
    let comment = '<!-- argus-summary -->\n'
    comment += '# 👁️ Argus - The All-Seeing Code Guardian\n\n'

    // Summary
    comment += `## 📋 Summary\n\n${review.summary}\n\n`

    // Metrics
    comment += '## 📊 Review Metrics\n\n'
    comment += `- **Files Reviewed**: ${review.metrics.filesReviewed}\n`
    comment += `- **Issues Found**: ${review.metrics.issuesFound}\n`
    comment += `- **Execution Time**: ${Math.round(review.metrics.executionTime / 1000)}s\n\n`

    // Blocking issues
    if (review.blockingIssues.length > 0) {
      comment += '## 🚫 Blocking Issues\n\n'
      comment += 'These issues must be addressed before merging:\n\n'

      for (const issue of review.blockingIssues) {
        comment += `### ${issue.severity === 'critical' ? '🔴' : '🟡'} ${issue.title}\n`
        comment += `**File**: \`${issue.file}\`${issue.line ? ` (line ${issue.line})` : ''}\n\n`
        comment += `${issue.description}\n\n`

        if (issue.suggestion) {
          comment += '**Suggested Fix**:\n```\n' + issue.suggestion.comment + '\n```\n\n'
        }
      }
    }

    // Recommendations
    if (review.recommendations.length > 0) {
      comment += '## 💡 Recommendations\n\n'
      comment += 'Consider addressing these improvements:\n\n'

      for (const issue of review.recommendations.slice(0, 5)) {
        // Limit to top 5
        comment += `- **${issue.title}** in \`${issue.file}\`: ${issue.description}\n`
      }

      if (review.recommendations.length > 5) {
        comment += `\n*... and ${review.recommendations.length - 5} more recommendations*\n`
      }
      comment += '\n'
    }

    // Linting summary
    if (review.lintingSummary.totalIssues > 0) {
      comment += '## 🔧 Linting Summary\n\n'
      comment += `Found ${review.lintingSummary.totalIssues} linting issues`

      if (review.lintingSummary.autoFixable > 0) {
        comment += ` (${review.lintingSummary.autoFixable} auto-fixable)`
      }

      comment += `:\n\n${review.lintingSummary.summary}\n\n`
    }

    // Coaching section
    if (review.coaching.length > 0 && this.config.enableCoaching) {
      comment += '## 🎓 Learning Opportunities\n\n'

      for (const coaching of review.coaching.slice(0, 3)) {
        // Limit to top 3
        comment += `### ${coaching.bestPractice}\n\n`
        comment += `${coaching.rationale}\n\n`

        if (coaching.resources.length > 0) {
          comment += '**Learn More**: ' + coaching.resources.join(', ') + '\n\n'
        }
      }
    }

    // Footer
    comment += '---\n\n'
    comment +=
      '💬 **Speak to Argus**: Reply to specific comments or mention `@argus` for follow-up questions\n'
    comment += '🔄 **Re-summon**: Push new commits to awaken Argus for fresh review\n'
    comment +=
      '⚙️ **Configure the Eyes**: Add `.github/argus-config.yml` to customize vigilance settings\n'

    return comment
  }

  /**
   * Format individual issue comment
   */
  private formatIssueComment(issue: {
    severity: string
    title: string
    description: string
    suggestion?: { comment: string; diff?: string }
    coaching?: { rationale: string }
  }): string {
    let comment = `## ${this.getSeverityEmoji(issue.severity)} ${issue.title}\n\n`
    comment += `${issue.description}\n\n`

    if (issue.suggestion) {
      if (issue.suggestion.diff) {
        // Has actual code changes - use GitHub suggestion format
        comment += '**Suggested Fix**:\n```suggestion\n' + issue.suggestion.diff + '\n```\n\n'
        if (issue.suggestion.comment) {
          comment += issue.suggestion.comment + '\n\n'
        }
      } else {
        // Only descriptive comment - use plain markdown
        comment += '**Suggested Fix**:\n' + issue.suggestion.comment + '\n\n'
      }
    }

    if (issue.coaching && this.config.enableCoaching) {
      comment += `💡 **Why this matters**: ${issue.coaching.rationale}\n\n`
    }

    return comment
  }

  /**
   * Get emoji for issue severity
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🔴'
      case 'error':
        return '🟠'
      case 'warning':
        return '🟡'
      case 'info':
        return '🔵'
      default:
        return '⚪'
    }
  }

  /**
   * Get repository files for context analysis
   */
  async getRepositoryStructure(path: string = ''): Promise<unknown[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        path,
      })

      return Array.isArray(response.data) ? response.data : [response.data]
    } catch (error) {
      core.debug(`Could not get repository structure for ${path}: ${error}`)
      return []
    }
  }

  /**
   * Get file content by path
   */
  async getFileContent(path: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        path,
      })

      if ('content' in response.data) {
        return Buffer.from(response.data.content, 'base64').toString('utf8')
      }

      return null
    } catch (error) {
      core.debug(`Could not get file content for ${path}: ${error}`)
      return null
    }
  }
}
