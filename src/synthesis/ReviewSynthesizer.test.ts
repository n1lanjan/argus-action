/**
 * ReviewSynthesizer Tests
 *
 * Unit tests for the ReviewSynthesizer class that combines results from multiple agents
 * into coherent, actionable feedback.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReviewSynthesizer } from './ReviewSynthesizer'
import {
  ReviewConfiguration,
  AgentResult,
  LintResult,
  ReviewContext,
  ReviewIssue,
  CoachingInfo,
  PrDescriptionMode,
} from '../types'

// Mock core module
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

describe('ReviewSynthesizer', () => {
  let synthesizer: ReviewSynthesizer
  let mockConfig: ReviewConfiguration
  let mockContext: ReviewContext
  let mockLintResults: LintResult

  beforeEach(() => {
    // Mock configuration
    mockConfig = {
      strictnessLevel: 'standard',
      focusAreas: ['security', 'architecture', 'logic'],
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
      updatePrDescription: 'append' as PrDescriptionMode,
      maxFiles: 50,
      excludePaths: [],
      models: {
        anthropic: 'claude-sonnet-4-20250514',
        openai: 'gpt-4-turbo-preview',
        parameters: { temperature: 0.1, maxTokens: 4000 },
      },
    }

    // Mock context
    mockContext = {
      pullRequest: {
        number: 123,
        title: 'Test PR',
        description: 'Test description',
        base: { sha: 'base-sha', ref: 'main' },
        head: { sha: 'head-sha', ref: 'feature' },
        author: 'test-user',
        repository: { owner: 'test-owner', name: 'test-repo' },
      },
      changedFiles: [
        {
          filename: 'src/security.ts',
          status: 'modified',
          additions: 10,
          deletions: 5,
          priority: 'high',
        },
        {
          filename: 'src/utils.ts',
          status: 'added',
          additions: 20,
          deletions: 0,
          priority: 'medium',
        },
      ],
      projectContext: {
        frameworks: [],
        architecture: {
          pattern: 'mvc',
          sourceDirectories: [],
          testDirectories: [],
          configDirectories: [],
          entryPoints: [],
        },
        conventions: {
          indentation: 'spaces',
          indentSize: 2,
          naming: {
            variables: 'camelCase',
            functions: 'camelCase',
            classes: 'PascalCase',
            constants: 'UPPER_CASE',
          },
          imports: { style: 'es6', organization: 'grouped' },
        },
        testStrategy: {
          framework: 'vitest',
          patterns: [],
          coverage: { minimum: 80, target: 90 },
          types: ['unit'],
        },
        security: {
          criticalFiles: [],
          authPatterns: [],
          dataHandling: { encryption: true, sanitization: true, validation: true },
        },
        performance: { criticalAreas: [], budgets: {} },
        dependencies: {
          packageManager: 'npm',
          production: [],
          development: [],
          outdated: [],
          vulnerabilities: [],
        },
      },
      config: mockConfig,
      github: {},
    }

    // Mock lint results
    mockLintResults = {
      totalIssues: 3,
      severityBreakdown: { error: 1, warning: 2, info: 0 },
      byLinter: {},
      summary: 'Found 3 linting issues',
      autoFixable: 1,
    }

    synthesizer = new ReviewSynthesizer(mockConfig)
  })

  describe('synthesize', () => {
    it('should synthesize empty results correctly', async () => {
      const agentResults: AgentResult[] = []

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      expect(result.summary).toContain('Argus has completed analysis of 2 changed files')
      expect(result.summary).toContain('All Clear!')
      expect(result.blockingIssues).toHaveLength(0)
      expect(result.recommendations).toHaveLength(0)
      expect(result.metrics.filesReviewed).toBe(2)
      expect(result.metrics.issuesFound).toBe(0)
      expect(result.metrics.executionTime).toBe(1000)
    })

    it('should synthesize agent results with issues', async () => {
      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'critical',
              category: 'security',
              title: 'SQL Injection Risk',
              description: 'Potential SQL injection vulnerability',
              file: 'src/security.ts',
              line: 10,
            },
            {
              severity: 'warning',
              category: 'security',
              title: 'Weak Password Policy',
              description: 'Password requirements too weak',
              file: 'src/auth.ts',
              line: 25,
            },
          ],
        },
        {
          agent: 'architecture',
          confidence: 0.8,
          executionTime: 300,
          summary: 'Architecture analysis complete',
          issues: [
            {
              severity: 'info',
              category: 'architecture',
              title: 'Consider Design Pattern',
              description: 'Could benefit from factory pattern',
              file: 'src/utils.ts',
              line: 15,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 2000)

      expect(result.summary).toContain('3 Recommendation(s)')
      expect(result.blockingIssues).toHaveLength(0) // Standard mode doesn't block on warnings
      expect(result.recommendations).toHaveLength(3)
      expect(result.metrics.filesReviewed).toBe(2)
      expect(result.metrics.issuesFound).toBe(3)
      expect(result.metrics.executionTime).toBe(2000)
      expect(result.metrics.agentPerformance.security.issuesFound).toBe(2)
      expect(result.metrics.agentPerformance.architecture.issuesFound).toBe(1)
    })

    it('should handle blocking issues in strict mode', async () => {
      // Update config to strict mode
      mockConfig.strictnessLevel = 'strict'
      synthesizer = new ReviewSynthesizer(mockConfig)

      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'critical',
              category: 'security',
              title: 'SQL Injection Risk',
              description: 'Potential SQL injection vulnerability',
              file: 'src/security.ts',
              line: 10,
            },
            {
              severity: 'warning',
              category: 'security',
              title: 'Weak Password Policy',
              description: 'Password requirements too weak',
              file: 'src/auth.ts',
              line: 25,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1500)

      expect(result.blockingIssues).toHaveLength(2) // Both critical and warning block in strict mode
      expect(result.recommendations).toHaveLength(0)
      expect(result.summary).toContain('Blocking Issue(s)')
    })

    it('should deduplicate similar issues', async () => {
      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'warning',
              category: 'security',
              title: 'SQL Injection Risk',
              description: 'Potential SQL injection vulnerability',
              file: 'src/security.ts',
              line: 10,
            },
          ],
        },
        {
          agent: 'logic',
          confidence: 0.8,
          executionTime: 400,
          summary: 'Logic analysis complete',
          issues: [
            {
              severity: 'error', // Higher severity for same location/category
              category: 'security',
              title: 'SQL Injection Confirmed',
              description: 'Confirmed SQL injection vulnerability',
              file: 'src/security.ts',
              line: 10,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      // Should only have 1 issue (the higher severity one)
      expect(result.recommendations).toHaveLength(1)
      expect(result.recommendations[0].severity).toBe('error')
      expect(result.recommendations[0].title).toBe('SQL Injection Confirmed')
    })

    it('should generate coaching when enabled', async () => {
      const coachingInfo: CoachingInfo = {
        rationale: 'This helps prevent security vulnerabilities',
        resources: ['https://owasp.org'],
        bestPractice: 'Always validate user input',
        level: 'intermediate',
      }

      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'warning',
              category: 'security',
              title: 'Input Validation',
              description: 'Missing input validation',
              file: 'src/api.ts',
              line: 15,
              coaching: coachingInfo,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      expect(result.coaching).toHaveLength(1)
      expect(result.coaching[0]).toEqual(coachingInfo)
    })

    it('should not generate coaching when disabled', async () => {
      mockConfig.enableCoaching = false
      synthesizer = new ReviewSynthesizer(mockConfig)

      const coachingInfo: CoachingInfo = {
        rationale: 'This helps prevent security vulnerabilities',
        resources: ['https://owasp.org'],
        bestPractice: 'Always validate user input',
        level: 'intermediate',
      }

      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'warning',
              category: 'security',
              title: 'Input Validation',
              description: 'Missing input validation',
              file: 'src/api.ts',
              line: 15,
              coaching: coachingInfo,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      expect(result.coaching).toHaveLength(0)
    })

    it('should calculate metrics correctly without total execution time', async () => {
      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'warning',
              category: 'security',
              title: 'Test Issue',
              description: 'Test description',
              file: 'src/test.ts',
              line: 10,
            },
          ],
        },
        {
          agent: 'architecture',
          confidence: 0.8,
          executionTime: 300,
          summary: 'Architecture analysis complete',
          issues: [],
        },
      ]

      // Don't pass totalExecutionTime
      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext)

      expect(result.metrics.executionTime).toBe(800) // Sum of agent execution times
      expect(result.metrics.agentPerformance.security.executionTime).toBe(500)
      expect(result.metrics.agentPerformance.architecture.executionTime).toBe(300)
    })

    it('should sort issues by severity correctly', async () => {
      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Security analysis complete',
          issues: [
            {
              severity: 'info',
              category: 'security',
              title: 'Info Issue',
              description: 'Info description',
              file: 'src/test1.ts',
              line: 10,
            },
            {
              severity: 'critical',
              category: 'security',
              title: 'Critical Issue',
              description: 'Critical description',
              file: 'src/test2.ts',
              line: 20,
            },
            {
              severity: 'warning',
              category: 'security',
              title: 'Warning Issue',
              description: 'Warning description',
              file: 'src/test3.ts',
              line: 30,
            },
            {
              severity: 'error',
              category: 'security',
              title: 'Error Issue',
              description: 'Error description',
              file: 'src/test4.ts',
              line: 40,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      // All should be recommendations in standard mode
      expect(result.recommendations).toHaveLength(4)

      // Should be sorted by severity: critical, error, warning, info
      expect(result.recommendations[0].severity).toBe('critical')
      expect(result.recommendations[1].severity).toBe('error')
      expect(result.recommendations[2].severity).toBe('warning')
      expect(result.recommendations[3].severity).toBe('info')
    })

    it('should handle agent failures gracefully', async () => {
      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0,
          executionTime: 1000,
          summary: 'Agent failed: Network timeout',
          issues: [],
        },
        {
          agent: 'architecture',
          confidence: 0.8,
          executionTime: 300,
          summary: 'Architecture analysis complete',
          issues: [
            {
              severity: 'info',
              category: 'architecture',
              title: 'Design Suggestion',
              description: 'Consider using dependency injection',
              file: 'src/service.ts',
              line: 15,
            },
          ],
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1500)

      expect(result.recommendations).toHaveLength(1)
      expect(result.summary).toContain('1 Recommendation(s)')
      expect(result.metrics.agentPerformance.security.issuesFound).toBe(0)
      expect(result.metrics.agentPerformance.architecture.issuesFound).toBe(1)
    })
  })

  describe('different strictness levels', () => {
    const createTestIssues = (): ReviewIssue[] => [
      {
        severity: 'critical',
        category: 'security',
        title: 'Critical Issue',
        description: 'Critical description',
        file: 'src/test.ts',
        line: 10,
      },
      {
        severity: 'error',
        category: 'logic',
        title: 'Error Issue',
        description: 'Error description',
        file: 'src/test.ts',
        line: 20,
      },
      {
        severity: 'warning',
        category: 'architecture',
        title: 'Warning Issue',
        description: 'Warning description',
        file: 'src/test.ts',
        line: 30,
      },
      {
        severity: 'info',
        category: 'performance',
        title: 'Info Issue',
        description: 'Info description',
        file: 'src/test.ts',
        line: 40,
      },
    ]

    it('should handle coaching mode correctly', async () => {
      mockConfig.strictnessLevel = 'coaching'
      synthesizer = new ReviewSynthesizer(mockConfig)

      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Analysis complete',
          issues: createTestIssues(),
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      // Coaching mode doesn't block on any issues
      expect(result.blockingIssues).toHaveLength(0)
      expect(result.recommendations).toHaveLength(4)
    })

    it('should handle blocking mode correctly', async () => {
      mockConfig.strictnessLevel = 'blocking'
      synthesizer = new ReviewSynthesizer(mockConfig)

      const agentResults: AgentResult[] = [
        {
          agent: 'security',
          confidence: 0.9,
          executionTime: 500,
          summary: 'Analysis complete',
          issues: createTestIssues(),
        },
      ]

      const result = await synthesizer.synthesize(agentResults, mockLintResults, mockContext, 1000)

      // Blocking mode only blocks on error+ severity
      expect(result.blockingIssues).toHaveLength(2) // critical and error
      expect(result.recommendations).toHaveLength(2) // warning and info
    })
  })
})
