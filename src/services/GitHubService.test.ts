/**
 * GitHubService Tests
 *
 * Unit tests for GitHub API interactions, especially PR description updates
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHubService } from './GitHubService'
import { ReviewConfiguration, FinalReview, ReviewMetrics, PrDescriptionMode } from '../types'

// Mock dependencies
vi.mock('@actions/core')
vi.mock('@actions/github')

describe('GitHubService', () => {
  let service: GitHubService
  let mockOctokit: any
  let mockConfig: ReviewConfiguration

  const mockContext = {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    payload: {
      pull_request: {
        number: 123,
        title: 'Test PR',
        body: 'Original PR description',
        base: { sha: 'base-sha', ref: 'main' },
        head: { sha: 'head-sha', ref: 'feature-branch' },
        user: { login: 'test-user' },
      },
    },
  }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock configuration
    mockConfig = {
      strictnessLevel: 'standard',
      focusAreas: ['security', 'architecture'],
      agentWeights: {
        security: 1.0,
        architecture: 0.8,
        logic: 1.0,
        performance: 0.6,
        testing: 0.4,
      },
      linting: { enabled: ['eslint'], configs: {} },
      learningMode: true,
      enableCoaching: true,
      updatePrDescription: 'append', // Enable PR description updates for testing
      maxFiles: 50,
      excludePaths: [],
      models: {
        anthropic: 'claude-3-5-sonnet-20241022',
        openai: 'gpt-4-turbo-preview',
        parameters: { temperature: 0.1, maxTokens: 4000 },
      },
    }

    // Mock Octokit
    mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn(),
          update: vi.fn(),
          listFiles: vi.fn(),
          createReview: vi.fn(),
          createReviewComment: vi.fn(),
        },
        issues: {
          createComment: vi.fn(),
          updateComment: vi.fn(),
          listComments: vi.fn().mockResolvedValue({ data: [] }),
        },
        repos: {
          getContent: vi.fn(),
        },
      },
    }

    // Mock GitHub module
    ;(github as any).context = mockContext
    ;(github.getOctokit as MockedFunction<typeof github.getOctokit>).mockReturnValue(mockOctokit)

    // Mock core module
    ;(core.getInput as MockedFunction<typeof core.getInput>).mockImplementation((name: string) => {
      if (name === 'github-token') return 'test-token'
      return ''
    })

    // Mock environment variable
    process.env.GITHUB_TOKEN = 'test-token'

    service = new GitHubService(mockConfig)
  })

  describe('updatePrDescription', () => {
    const mockReview: FinalReview = {
      summary: 'Test review summary',
      blockingIssues: [
        {
          severity: 'critical',
          category: 'security',
          title: 'Critical Security Issue',
          description: 'This is a critical security issue',
          file: 'src/test.ts',
          line: 10,
        },
        {
          severity: 'error',
          category: 'logic',
          title: 'Logic Error',
          description: 'This is a logic error',
          file: 'src/logic.ts',
          line: 20,
        },
      ],
      recommendations: [
        {
          severity: 'warning',
          category: 'architecture',
          title: 'Architecture Warning',
          description: 'This is an architecture warning',
          file: 'src/arch.ts',
          line: 30,
        },
        {
          severity: 'info',
          category: 'performance',
          title: 'Performance Info',
          description: 'This is performance info',
          file: 'src/perf.ts',
        },
      ],
      lintingSummary: {
        totalIssues: 5,
        severityBreakdown: { error: 2, warning: 2, info: 1 },
        byLinter: {},
        summary: 'Found 5 linting issues',
        autoFixable: 2,
      },
      coaching: [],
      metrics: {
        filesReviewed: 4,
        issuesFound: 6,
        executionTime: 5000,
        agentPerformance: {},
      } as ReviewMetrics,
    }

    it('should update PR description when none exists', async () => {
      // Mock PR with no existing description
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          ...mockContext.payload.pull_request,
          body: null,
        },
      })
      mockOctokit.rest.pulls.update.mockResolvedValue({})

      await service.postReview(mockReview, { pullRequest: await service.getPullRequestInfo() })

      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        body: expect.stringContaining('## 👁️ Argus Code Review Summary'),
      })

      const updateCall = mockOctokit.rest.pulls.update.mock.calls[0][0]
      expect(updateCall.body).toContain('**Risk Level**: 🔴 Critical')
      expect(updateCall.body).toContain('**Files Analyzed**: 4')
      expect(updateCall.body).toContain('**Issues Found**: 6')
      expect(updateCall.body).toContain('🔴 Critical: 1')
      expect(updateCall.body).toContain('🟠 High: 1')
      expect(updateCall.body).toContain('🟡 Medium: 1')
      expect(updateCall.body).toContain('🔵 Info: 1')
      expect(updateCall.body).toContain('⚠️ **Action Required**: Critical issues found')
    })

    it('should append Argus summary to existing description', async () => {
      const existingDescription = 'This is my PR description\n\nIt has multiple lines.'

      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          ...mockContext.payload.pull_request,
          body: existingDescription,
        },
      })
      mockOctokit.rest.pulls.update.mockResolvedValue({})

      await service.postReview(mockReview, { pullRequest: await service.getPullRequestInfo() })

      const updateCall = mockOctokit.rest.pulls.update.mock.calls[0][0]
      expect(updateCall.body).toContain(existingDescription)
      expect(updateCall.body).toContain('## 👁️ Argus Code Review Summary')
      expect(updateCall.body.indexOf(existingDescription)).toBeLessThan(
        updateCall.body.indexOf('## 👁️ Argus Code Review Summary')
      )
    })

    it('should replace existing Argus summary', async () => {
      const existingDescription = `This is my PR description

<!-- argus-pr-summary-start -->
## 👁️ Argus Code Review Summary

**Risk Level**: 🟢 Low
**Files Analyzed**: 2
**Issues Found**: 0

✅ **Clean Code**: No issues detected by Argus review.

📋 [View Detailed Review](#issuecomment-argus)
<!-- argus-pr-summary-end -->

More content after Argus summary`

      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          ...mockContext.payload.pull_request,
          body: existingDescription,
        },
      })
      mockOctokit.rest.pulls.update.mockResolvedValue({})

      await service.postReview(mockReview, { pullRequest: await service.getPullRequestInfo() })

      const updateCall = mockOctokit.rest.pulls.update.mock.calls[0][0]
      expect(updateCall.body).toContain('This is my PR description')
      expect(updateCall.body).toContain('More content after Argus summary')
      expect(updateCall.body).toContain('**Risk Level**: 🔴 Critical') // New summary
      expect(updateCall.body).not.toContain('**Risk Level**: 🟢 Low') // Old summary removed
      expect(updateCall.body).toContain('**Files Analyzed**: 4') // New metrics
      expect(updateCall.body).not.toContain('**Files Analyzed**: 2') // Old metrics removed
    })

    it('should handle different risk levels correctly', async () => {
      const testCases = [
        {
          review: {
            ...mockReview,
            blockingIssues: [],
            recommendations: [],
            metrics: { ...mockReview.metrics, issuesFound: 0 },
          },
          expectedRisk: '🟢 Low',
          expectedMessage: '✅ **Clean Code**: No issues detected by Argus review.',
        },
        {
          review: {
            ...mockReview,
            blockingIssues: [
              {
                severity: 'warning' as const,
                category: 'architecture',
                title: 'Warning Issue',
                description: 'Warning description',
                file: 'test.ts',
              },
            ],
            recommendations: [],
          },
          expectedRisk: '🟡 Medium',
          expectedMessage: '💡 **Improvements Available**: Minor issues and recommendations found.',
        },
        {
          review: {
            ...mockReview,
            blockingIssues: [
              {
                severity: 'error' as const,
                category: 'logic',
                title: 'Error Issue',
                description: 'Error description',
                file: 'test.ts',
              },
            ],
          },
          expectedRisk: '🟠 High',
          expectedMessage: '⚠️ **Review Recommended**: High-priority issues found.',
        },
      ]

      for (const testCase of testCases) {
        mockOctokit.rest.pulls.get.mockResolvedValue({
          data: { ...mockContext.payload.pull_request, body: '' },
        })
        mockOctokit.rest.pulls.update.mockResolvedValue({})

        await service.postReview(testCase.review, {
          pullRequest: await service.getPullRequestInfo(),
        })

        const updateCall = mockOctokit.rest.pulls.update.mock.calls.pop()[0]
        expect(updateCall.body).toContain(`**Risk Level**: ${testCase.expectedRisk}`)
        expect(updateCall.body).toContain(testCase.expectedMessage)
      }
    })

    it('should not update PR description when feature is disabled', async () => {
      const configWithoutPrUpdate = {
        ...mockConfig,
        updatePrDescription: 'disabled' as PrDescriptionMode,
      }
      const serviceWithoutPrUpdate = new GitHubService(configWithoutPrUpdate)

      await serviceWithoutPrUpdate.postReview(mockReview, {
        pullRequest: await service.getPullRequestInfo(),
      })

      expect(mockOctokit.rest.pulls.get).not.toHaveBeenCalled()
      expect(mockOctokit.rest.pulls.update).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockOctokit.rest.pulls.get.mockRejectedValue(new Error('API Error'))
      const warningSpy = vi.spyOn(core, 'warning')

      await service.postReview(mockReview, { pullRequest: await service.getPullRequestInfo() })

      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not update PR description: Error: API Error')
      )
    })

    it('should overwrite entire description in overwrite mode', async () => {
      const configOverwrite = {
        ...mockConfig,
        updatePrDescription: 'overwrite' as PrDescriptionMode,
      }
      const serviceOverwrite = new GitHubService(configOverwrite)

      const existingDescription = 'This is my existing PR description\n\nWith multiple lines.'

      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          ...mockContext.payload.pull_request,
          body: existingDescription,
        },
      })
      mockOctokit.rest.pulls.update.mockResolvedValue({})

      await serviceOverwrite.postReview(mockReview, {
        pullRequest: await service.getPullRequestInfo(),
      })

      const updateCall = mockOctokit.rest.pulls.update.mock.calls[0][0]
      expect(updateCall.body).not.toContain('This is my existing PR description')
      expect(updateCall.body).toContain('## 👁️ Argus Code Review Summary')
      expect(updateCall.body).toContain('**Risk Level**: 🔴 Critical')
      expect(updateCall.body).toContain('<!-- argus-pr-summary-start -->')
      expect(updateCall.body).toContain('<!-- argus-pr-summary-end -->')
    })

    it('should preserve user content in append mode with existing Argus section', async () => {
      const existingDescription = `My PR description

Some important notes

<!-- argus-pr-summary-start -->
## 👁️ Argus Code Review Summary

**Risk Level**: 🟢 Low
**Files Analyzed**: 2
**Issues Found**: 0

✅ **Clean Code**: No issues detected by Argus review.

📋 [View Detailed Review](#issuecomment-argus)
<!-- argus-pr-summary-end -->

More content after Argus`

      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          ...mockContext.payload.pull_request,
          body: existingDescription,
        },
      })
      mockOctokit.rest.pulls.update.mockResolvedValue({})

      await service.postReview(mockReview, { pullRequest: await service.getPullRequestInfo() })

      const updateCall = mockOctokit.rest.pulls.update.mock.calls[0][0]
      expect(updateCall.body).toContain('My PR description')
      expect(updateCall.body).toContain('Some important notes')
      expect(updateCall.body).toContain('More content after Argus')
      expect(updateCall.body).toContain('**Risk Level**: 🔴 Critical') // New summary
      expect(updateCall.body).not.toContain('**Risk Level**: 🟢 Low') // Old summary removed
    })
  })

  describe('generatePrDescriptionSummary', () => {
    it('should generate correct summary format', async () => {
      const mockReview: FinalReview = {
        summary: 'Test summary',
        blockingIssues: [],
        recommendations: [],
        lintingSummary: {
          totalIssues: 0,
          severityBreakdown: {},
          byLinter: {},
          summary: '',
          autoFixable: 0,
        },
        coaching: [],
        metrics: {
          filesReviewed: 3,
          issuesFound: 0,
          executionTime: 1000,
          agentPerformance: {},
        } as ReviewMetrics,
      }

      // Access the private method through postReview workflow
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: { ...mockContext.payload.pull_request, body: '' },
      })
      mockOctokit.rest.pulls.update.mockResolvedValue({})

      await service.postReview(mockReview, { pullRequest: await service.getPullRequestInfo() })

      const updateCall = mockOctokit.rest.pulls.update.mock.calls[0][0]

      // Check that the summary contains all required elements
      expect(updateCall.body).toContain('<!-- argus-pr-summary-start -->')
      expect(updateCall.body).toContain('## 👁️ Argus Code Review Summary')
      expect(updateCall.body).toContain('**Risk Level**:')
      expect(updateCall.body).toContain('**Files Analyzed**:')
      expect(updateCall.body).toContain('**Issues Found**:')
      expect(updateCall.body).toContain('📋 [View Detailed Review]')
      expect(updateCall.body).toContain('<!-- argus-pr-summary-end -->')
    })
  })
})
