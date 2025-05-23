/**
 * ReviewOrchestrator Tests
 *
 * Unit tests for the ReviewOrchestrator class that manages the lifecycle
 * of specialized AI agents and coordinates parallel execution of reviews.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { ReviewOrchestrator } from './ReviewOrchestrator'
import {
  ReviewConfiguration,
  ReviewContext,
  AgentResult,
  AgentType,
  ReviewAgent,
  PrDescriptionMode,
} from '../types'

// Mock dependencies
vi.mock('@actions/core')
vi.mock('p-limit', () => ({
  default: vi.fn(() => vi.fn((fn: any) => fn())),
}))

// Mock agent classes
vi.mock('../agents/SecurityAgent')
vi.mock('../agents/ArchitectureAgent')
vi.mock('../agents/LogicAgent')
vi.mock('../agents/PerformanceAgent')
vi.mock('../agents/TestingAgent')

describe('ReviewOrchestrator', () => {
  let orchestrator: ReviewOrchestrator
  let mockConfig: ReviewConfiguration
  let mockContext: ReviewContext
  let mockSecurityAgent: ReviewAgent
  let mockArchitectureAgent: ReviewAgent
  let mockLogicAgent: ReviewAgent

  beforeEach(async () => {
    vi.clearAllMocks()

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

    // Mock review context
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

    // Mock agents
    mockSecurityAgent = {
      name: 'security',
      capabilities: ['vulnerability-detection', 'security-patterns'],
      priority: 1,
      execute: vi.fn(),
    }

    mockArchitectureAgent = {
      name: 'architecture',
      capabilities: ['design-patterns', 'solid-principles'],
      priority: 2,
      execute: vi.fn(),
    }

    mockLogicAgent = {
      name: 'logic',
      capabilities: ['business-logic', 'edge-cases'],
      priority: 3,
      execute: vi.fn(),
    }

    // Mock agent constructors
    const { SecurityAgent } = await import('../agents/SecurityAgent')
    const { ArchitectureAgent } = await import('../agents/ArchitectureAgent')
    const { LogicAgent } = await import('../agents/LogicAgent')
    const { PerformanceAgent } = await import('../agents/PerformanceAgent')
    const { TestingAgent } = await import('../agents/TestingAgent')

    ;(SecurityAgent as any).mockImplementation(() => mockSecurityAgent)
    ;(ArchitectureAgent as any).mockImplementation(() => mockArchitectureAgent)
    ;(LogicAgent as any).mockImplementation(() => mockLogicAgent)
    ;(PerformanceAgent as any).mockImplementation(() => ({
      name: 'performance',
      capabilities: [],
      priority: 4,
      execute: vi.fn(),
    }))
    ;(TestingAgent as any).mockImplementation(() => ({
      name: 'testing',
      capabilities: [],
      priority: 5,
      execute: vi.fn(),
    }))

    orchestrator = new ReviewOrchestrator(mockConfig)
  })

  describe('initialization', () => {
    it('should initialize agents based on focus areas and weights', () => {
      // The orchestrator should have been initialized with 3 agents (security, architecture, logic)
      // since these are the focus areas with positive weights
      const metrics = orchestrator.getAgentMetrics()

      expect(metrics.security).toBeDefined()
      expect(metrics.architecture).toBeDefined()
      expect(metrics.logic).toBeDefined()
      expect(metrics.performance).toBeUndefined() // Not in focus areas
      expect(metrics.testing).toBeUndefined() // Not in focus areas
    })

    it('should skip agents with zero weight', () => {
      // Create config with zero weight for architecture
      const configWithZeroWeight = {
        ...mockConfig,
        agentWeights: {
          ...mockConfig.agentWeights,
          architecture: 0,
        },
      }

      const orchestratorWithZeroWeight = new ReviewOrchestrator(configWithZeroWeight)
      const metrics = orchestratorWithZeroWeight.getAgentMetrics()

      expect(metrics.security).toBeDefined()
      expect(metrics.architecture).toBeUndefined() // Should be skipped due to zero weight
      expect(metrics.logic).toBeDefined()
    })

    it('should skip agents not in focus areas', () => {
      const configWithLimitedFocus = {
        ...mockConfig,
        focusAreas: ['security'] as any,
      }

      const orchestratorWithLimitedFocus = new ReviewOrchestrator(configWithLimitedFocus)
      const metrics = orchestratorWithLimitedFocus.getAgentMetrics()

      expect(metrics.security).toBeDefined()
      expect(metrics.architecture).toBeUndefined() // Not in focus areas
      expect(metrics.logic).toBeUndefined() // Not in focus areas
    })
  })

  describe('executeReview', () => {
    it('should execute all agents successfully', async () => {
      // Mock successful agent executions
      const securityResult: AgentResult = {
        agent: 'security',
        confidence: 0.9,
        executionTime: 500,
        summary: 'Security analysis complete',
        issues: [
          {
            severity: 'warning',
            category: 'security',
            title: 'Security Issue',
            description: 'Security issue description',
            file: 'src/security.ts',
            line: 10,
          },
        ],
      }

      const architectureResult: AgentResult = {
        agent: 'architecture',
        confidence: 0.8,
        executionTime: 300,
        summary: 'Architecture analysis complete',
        issues: [],
      }

      const logicResult: AgentResult = {
        agent: 'logic',
        confidence: 0.85,
        executionTime: 400,
        summary: 'Logic analysis complete',
        issues: [
          {
            severity: 'info',
            category: 'logic',
            title: 'Logic Suggestion',
            description: 'Logic suggestion description',
            file: 'src/utils.ts',
            line: 15,
          },
        ],
      }

      ;(mockSecurityAgent.execute as MockedFunction<any>).mockResolvedValue(securityResult)
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockResolvedValue(architectureResult)
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue(logicResult)

      const { results, totalTime } = await orchestrator.executeReview(mockContext)

      expect(results).toHaveLength(3)
      expect(totalTime).toBeGreaterThan(0)

      // Check that confidence scores are capped
      expect(results[0].confidence).toBeLessThanOrEqual(1.0)
      expect(results[1].confidence).toBeLessThanOrEqual(1.0)
      expect(results[2].confidence).toBeLessThanOrEqual(1.0)

      // Check that agent weights are applied (but capped)
      const securityAgent = results.find(r => r.agent === 'security')
      const architectureAgent = results.find(r => r.agent === 'architecture')
      const logicAgent = results.find(r => r.agent === 'logic')

      expect(securityAgent?.confidence).toBe(Math.min(1.0, 0.9 * 1.0)) // security weight = 1.0
      expect(architectureAgent?.confidence).toBe(Math.min(1.0, 0.8 * 0.8)) // architecture weight = 0.8
      expect(logicAgent?.confidence).toBe(Math.min(1.0, 0.85 * 1.0)) // logic weight = 1.0
    })

    it('should cap confidence at 1.0 when agent weight would exceed it', async () => {
      // Test the confidence capping fix
      const highConfidenceResult: AgentResult = {
        agent: 'security',
        confidence: 0.8, // With weight 1.0, this should stay at 0.8
        executionTime: 500,
        summary: 'Analysis complete',
        issues: [],
      }

      // Create config with high agent weight that would cause confidence > 1.0
      const configWithHighWeight = {
        ...mockConfig,
        agentWeights: {
          ...mockConfig.agentWeights,
          security: 1.5, // This would cause 0.8 * 1.5 = 1.2 without capping
        },
      }

      const orchestratorWithHighWeight = new ReviewOrchestrator(configWithHighWeight)
      ;(mockSecurityAgent.execute as MockedFunction<any>).mockResolvedValue(highConfidenceResult)

      const { results } = await orchestratorWithHighWeight.executeReview(mockContext)

      const securityResult = results.find(r => r.agent === 'security')
      expect(securityResult?.confidence).toBe(1.0) // Should be capped at 1.0
    })

    it('should handle agent failures gracefully', async () => {
      // Mock one successful and one failed agent
      const securityResult: AgentResult = {
        agent: 'security',
        confidence: 0.9,
        executionTime: 500,
        summary: 'Security analysis complete',
        issues: [],
      }

      ;(mockSecurityAgent.execute as MockedFunction<any>).mockResolvedValue(securityResult)
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockRejectedValue(
        new Error('Network timeout')
      )
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'logic',
        confidence: 0.85,
        executionTime: 400,
        summary: 'Logic analysis complete',
        issues: [],
      })

      const { results, totalTime } = await orchestrator.executeReview(mockContext)

      // Should have 3 results (1 success, 1 failure with empty result, 1 success)
      expect(results).toHaveLength(3)
      expect(totalTime).toBeGreaterThan(0)

      // Failed agent should return empty result
      const failedAgent = results.find(r => r.agent === 'architecture')
      expect(failedAgent?.confidence).toBe(0)
      expect(failedAgent?.issues).toHaveLength(0)
      expect(failedAgent?.summary).toContain('Agent failed')
    })

    it('should retry failed agents', async () => {
      const securityResult: AgentResult = {
        agent: 'security',
        confidence: 0.9,
        executionTime: 500,
        summary: 'Security analysis complete',
        issues: [],
      }

      // Mock agent to fail twice then succeed
      ;(mockSecurityAgent.execute as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce(securityResult)
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'architecture',
        confidence: 0.8,
        executionTime: 300,
        summary: 'Architecture analysis complete',
        issues: [],
      })
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'logic',
        confidence: 0.85,
        executionTime: 400,
        summary: 'Logic analysis complete',
        issues: [],
      })

      const { results } = await orchestrator.executeReview(mockContext)

      // Security agent should succeed after retries
      const securityAgent = results.find(r => r.agent === 'security')
      expect(securityAgent?.summary).toBe('Security analysis complete')
      expect(securityAgent?.confidence).toBeGreaterThan(0)

      // Should have been called 3 times (initial + 2 retries)
      expect(mockSecurityAgent.execute).toHaveBeenCalledTimes(3)
    })

    it('should validate agent results', async () => {
      // Mock invalid result (missing required fields)
      const invalidResult = {
        agent: 'security',
        confidence: 'invalid', // Should be number
        summary: 'Analysis complete',
        issues: 'not-an-array', // Should be array
      }

      ;(mockSecurityAgent.execute as MockedFunction<any>).mockResolvedValue(invalidResult)
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'architecture',
        confidence: 0.8,
        executionTime: 300,
        summary: 'Architecture analysis complete',
        issues: [],
      })
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'logic',
        confidence: 0.85,
        executionTime: 400,
        summary: 'Logic analysis complete',
        issues: [],
      })

      const { results } = await orchestrator.executeReview(mockContext)

      // Invalid agent should return failure result
      const securityAgent = results.find(r => r.agent === 'security')
      expect(securityAgent?.confidence).toBe(0)
      expect(securityAgent?.summary).toContain('Agent failed')
    })

    it('should set execution time correctly', async () => {
      const startTime = Date.now()

      ;(mockSecurityAgent.execute as MockedFunction<any>).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)) // Simulate work
        return {
          agent: 'security',
          confidence: 0.9,
          executionTime: 0, // Will be overwritten
          summary: 'Analysis complete',
          issues: [],
        }
      })
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'architecture',
        confidence: 0.8,
        executionTime: 0, // Will be overwritten
        summary: 'Architecture analysis complete',
        issues: [],
      })
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'logic',
        confidence: 0.85,
        executionTime: 0, // Will be overwritten
        summary: 'Logic analysis complete',
        issues: [],
      })

      const { results, totalTime } = await orchestrator.executeReview(mockContext)

      const endTime = Date.now()

      expect(totalTime).toBeGreaterThan(0)
      expect(totalTime).toBeLessThan(endTime - startTime + 100) // Allow some margin

      // Each agent should have non-negative execution time (can be 0 in fast test environment)
      results.forEach(result => {
        expect(result.executionTime).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('agent validation', () => {
    it('should validate agent availability', () => {
      expect(() => orchestrator.validateAgentAvailability()).not.toThrow()
    })

    it('should throw when required agents are missing', async () => {
      // Mock the PerformanceAgent to throw during initialization
      const { PerformanceAgent } = await import('../agents/PerformanceAgent')
      ;(PerformanceAgent as any).mockImplementation(() => {
        throw new Error('Failed to initialize performance agent')
      })

      const configWithMissingAgents = {
        ...mockConfig,
        focusAreas: ['security', 'architecture', 'logic', 'performance'] as any, // Include performance which will fail to initialize
      }

      const orchestratorWithMissingAgents = new ReviewOrchestrator(configWithMissingAgents)

      expect(() => orchestratorWithMissingAgents.validateAgentAvailability()).toThrow(
        'Missing required agents'
      )
    })
  })

  describe('performance monitoring', () => {
    it('should return agent metrics', () => {
      const metrics = orchestrator.getAgentMetrics()

      expect(metrics.security).toEqual({
        initialized: true,
        weight: 1.0,
        lastExecution: null,
      })

      expect(metrics.architecture).toEqual({
        initialized: true,
        weight: 0.8,
        lastExecution: null,
      })

      expect(metrics.logic).toEqual({
        initialized: true,
        weight: 1.0,
        lastExecution: null,
      })
    })

    it('should return agent capabilities', () => {
      const capabilities = orchestrator.getAgentCapabilities()

      expect(capabilities.security).toEqual(['vulnerability-detection', 'security-patterns'])
      expect(capabilities.architecture).toEqual(['design-patterns', 'solid-principles'])
      expect(capabilities.logic).toEqual(['business-logic', 'edge-cases'])
    })
  })

  describe('learning mode', () => {
    it('should adjust agent weights when learning mode is enabled', () => {
      const performanceData: Record<AgentType, number> = {
        security: 0.9, // High performance - should increase weight
        architecture: 0.3, // Low performance - should decrease weight
        logic: 0.7, // Medium performance - no change
        performance: 0.5,
        testing: 0.5,
      }

      orchestrator.adjustAgentWeights(performanceData)

      // Note: This test would need access to internal state to verify changes
      // In a real implementation, you might want to expose a method to get current weights
      expect(mockConfig.agentWeights.security).toBeGreaterThan(1.0)
      expect(mockConfig.agentWeights.architecture).toBeLessThan(0.8)
      expect(mockConfig.agentWeights.logic).toBe(1.0) // No change
    })

    it('should not adjust weights when learning mode is disabled', () => {
      const configWithoutLearning = {
        ...mockConfig,
        learningMode: false,
      }

      const orchestratorWithoutLearning = new ReviewOrchestrator(configWithoutLearning)
      const originalWeights = { ...configWithoutLearning.agentWeights }

      const performanceData: Record<AgentType, number> = {
        security: 0.9,
        architecture: 0.3,
        logic: 0.7,
        performance: 0.5,
        testing: 0.5,
      }

      orchestratorWithoutLearning.adjustAgentWeights(performanceData)

      // Weights should remain unchanged
      expect(configWithoutLearning.agentWeights).toEqual(originalWeights)
    })

    it('should respect weight bounds when adjusting', () => {
      // Set initial weights at boundaries
      mockConfig.agentWeights.security = 2.0 // At max
      mockConfig.agentWeights.architecture = 0.0 // At min

      const performanceData: Record<AgentType, number> = {
        security: 0.9, // Would increase beyond max
        architecture: 0.3, // Would decrease below min
        logic: 0.7,
        performance: 0.5,
        testing: 0.5,
      }

      orchestrator.adjustAgentWeights(performanceData)

      // Should not exceed bounds
      expect(mockConfig.agentWeights.security).toBeLessThanOrEqual(2.0)
      expect(mockConfig.agentWeights.architecture).toBeGreaterThanOrEqual(0.0)
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(orchestrator.cleanup()).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should handle malformed agent results', async () => {
      ;(mockSecurityAgent.execute as MockedFunction<any>).mockResolvedValue(null)
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockResolvedValue(undefined)
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'logic',
        confidence: 0.85,
        executionTime: 400,
        summary: 'Logic analysis complete',
        issues: [],
      })

      const { results } = await orchestrator.executeReview(mockContext)

      expect(results).toHaveLength(3)

      // Null/undefined results should be converted to failure results
      const securityResult = results.find(r => r.agent === 'security')
      const architectureResult = results.find(r => r.agent === 'architecture')

      expect(securityResult?.confidence).toBe(0)
      expect(architectureResult?.confidence).toBe(0)
      expect(securityResult?.summary).toContain('Agent failed')
      expect(architectureResult?.summary).toContain('Agent failed')
    })

    it('should handle agent type mismatches', async () => {
      const incorrectResult: AgentResult = {
        agent: 'performance', // Wrong agent type
        confidence: 0.9,
        executionTime: 500,
        summary: 'Analysis complete',
        issues: [],
      }

      ;(mockSecurityAgent.execute as MockedFunction<any>).mockResolvedValue(incorrectResult)
      ;(mockArchitectureAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'architecture',
        confidence: 0.8,
        executionTime: 300,
        summary: 'Architecture analysis complete',
        issues: [],
      })
      ;(mockLogicAgent.execute as MockedFunction<any>).mockResolvedValue({
        agent: 'logic',
        confidence: 0.85,
        executionTime: 400,
        summary: 'Logic analysis complete',
        issues: [],
      })

      const { results } = await orchestrator.executeReview(mockContext)

      // Security agent should return failure result due to type mismatch
      const securityResult = results.find(r => r.agent === 'security')
      expect(securityResult?.confidence).toBe(0)
      expect(securityResult?.summary).toContain('Agent failed')
    })
  })
})
