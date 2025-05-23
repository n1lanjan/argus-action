/**
 * Review Orchestrator
 *
 * The central coordinator for all review agents. This class:
 * - Manages the lifecycle of specialized AI agents
 * - Coordinates parallel execution of reviews
 * - Handles agent failures and retries
 * - Aggregates results from multiple agents
 * - Provides performance monitoring and metrics
 */

import * as core from '@actions/core'
import pLimit from 'p-limit'
import { ReviewAgent, ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types'
import { SecurityAgent } from '../agents/SecurityAgent'
import { ArchitectureAgent } from '../agents/ArchitectureAgent'
import { LogicAgent } from '../agents/LogicAgent'
import { PerformanceAgent } from '../agents/PerformanceAgent'
import { TestingAgent } from '../agents/TestingAgent'

export class ReviewOrchestrator {
  private agents: Map<AgentType, ReviewAgent> = new Map()
  private concurrencyLimit: ReturnType<typeof pLimit>

  constructor(private config: ReviewConfiguration) {
    // Set up concurrency control - limit parallel agent execution
    this.concurrencyLimit = pLimit(3)

    // Initialize all available agents
    this.initializeAgents()
  }

  /**
   * Initialize all review agents based on configuration
   */
  private initializeAgents(): void {
    core.info('🤖 Initializing review agents...')

    // Create agents based on focus areas and weights
    const agentFactories = {
      security: () => new SecurityAgent(this.config),
      architecture: () => new ArchitectureAgent(this.config),
      logic: () => new LogicAgent(this.config),
      performance: () => new PerformanceAgent(this.config),
      testing: () => new TestingAgent(this.config),
    }

    for (const [agentType, factory] of Object.entries(agentFactories)) {
      const typedAgentType = agentType as AgentType

      // Only initialize agents that are in focus areas and have positive weight
      if (
        this.config.focusAreas.includes(typedAgentType) &&
        this.config.agentWeights[typedAgentType] > 0
      ) {
        try {
          const agent = factory()
          this.agents.set(typedAgentType, agent)
          core.info(`✅ Initialized ${agentType} agent`)
        } catch (error) {
          core.warning(`⚠️ Failed to initialize ${agentType} agent: ${error}`)
        }
      } else {
        core.info(`⏭️ Skipping ${agentType} agent (not in focus or zero weight)`)
      }
    }

    core.info(`🎯 Initialized ${this.agents.size} agents`)
  }

  /**
   * Execute review using all configured agents
   */
  async executeReview(context: ReviewContext): Promise<AgentResult[]> {
    const startTime = Date.now()
    core.info(`🚀 Starting multi-agent review with ${this.agents.size} agents`)

    // Prepare agent execution promises with concurrency control
    const agentPromises = Array.from(this.agents.entries()).map(([agentType, agent]) =>
      this.concurrencyLimit(async () => {
        return await this.executeAgentWithRetry(agentType, agent, context)
      })
    )

    // Execute all agents in parallel (with concurrency limits)
    const results = await Promise.allSettled(agentPromises)

    // Process results and handle failures
    const successfulResults: AgentResult[] = []
    const failedAgents: string[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const agentTypes = Array.from(this.agents.keys())
      const agentType = agentTypes[i]

      if (result && result.status === 'fulfilled') {
        successfulResults.push(result.value)
        core.info(`✅ ${agentType} agent completed successfully`)
      } else if (result && result.status === 'rejected') {
        failedAgents.push(agentType || 'unknown')
        core.error(`❌ ${agentType} agent failed: ${result.reason}`)
      }
    }

    const totalTime = Date.now() - startTime
    core.info(`🏁 Multi-agent review completed in ${totalTime}ms`)
    core.info(`📊 Success rate: ${successfulResults.length}/${this.agents.size} agents`)

    if (failedAgents.length > 0) {
      core.warning(`⚠️ Failed agents: ${failedAgents.join(', ')}`)
    }

    return successfulResults
  }

  /**
   * Execute a single agent with retry logic and error handling
   */
  private async executeAgentWithRetry(
    agentType: AgentType,
    agent: ReviewAgent,
    context: ReviewContext,
    maxRetries: number = 2
  ): Promise<AgentResult> {
    const startTime = Date.now()

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        core.debug(`🔄 Executing ${agentType} agent (attempt ${attempt})`)

        const result = await agent.execute(context)

        // Validate result
        this.validateAgentResult(result, agentType)

        // Apply agent weight to confidence score
        const weightedResult = {
          ...result,
          confidence: result.confidence * this.config.agentWeights[agentType],
          executionTime: Date.now() - startTime,
        }

        core.debug(`✅ ${agentType} agent completed in ${weightedResult.executionTime}ms`)
        return weightedResult
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (attempt <= maxRetries) {
          core.warning(
            `⚠️ ${agentType} agent attempt ${attempt} failed: ${errorMessage}. Retrying...`
          )
          // Wait before retry with exponential backoff
          await this.sleep(1000 * Math.pow(2, attempt - 1))
        } else {
          core.error(
            `❌ ${agentType} agent failed after ${maxRetries + 1} attempts: ${errorMessage}`
          )

          // Return empty result for failed agent
          return {
            agent: agentType,
            confidence: 0,
            issues: [],
            summary: `Agent failed: ${errorMessage}`,
            executionTime: Date.now() - startTime,
          }
        }
      }
    }

    // This should never be reached due to the loop structure
    throw new Error(`Unexpected error in agent execution for ${agentType}`)
  }

  /**
   * Validate agent result format and content
   */
  private validateAgentResult(result: AgentResult, agentType: AgentType): void {
    if (!result) {
      throw new Error('Agent returned null or undefined result')
    }

    if (result.agent !== agentType) {
      throw new Error(`Agent type mismatch: expected ${agentType}, got ${result.agent}`)
    }

    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
      throw new Error(`Invalid confidence score: ${result.confidence}`)
    }

    if (!Array.isArray(result.issues)) {
      throw new Error('Issues must be an array')
    }

    if (typeof result.summary !== 'string') {
      throw new Error('Summary must be a string')
    }

    // Validate each issue
    for (const issue of result.issues) {
      if (!issue.severity || !issue.title || !issue.description || !issue.file) {
        throw new Error('Invalid issue format: missing required fields')
      }
    }
  }

  /**
   * Get agent performance metrics
   */
  getAgentMetrics(): Record<AgentType, any> {
    const metrics: Record<AgentType, any> = {} as any

    for (const agentType of this.agents.keys()) {
      metrics[agentType] = {
        initialized: true,
        weight: this.config.agentWeights[agentType],
        lastExecution: null, // Will be populated during execution
      }
    }

    return metrics
  }

  /**
   * Check if all required agents are available
   */
  validateAgentAvailability(): void {
    const requiredAgents = this.config.focusAreas.filter(
      area => this.config.agentWeights[area as AgentType] > 0
    )

    const missingAgents = requiredAgents.filter(agent => !this.agents.has(agent as AgentType))

    if (missingAgents.length > 0) {
      throw new Error(`Missing required agents: ${missingAgents.join(', ')}`)
    }

    core.info(`✅ All required agents are available: ${requiredAgents.join(', ')}`)
  }

  /**
   * Dynamically adjust agent weights based on performance
   */
  adjustAgentWeights(performanceData: Record<AgentType, number>): void {
    if (!this.config.learningMode) {
      return
    }

    core.info('🧠 Adjusting agent weights based on performance...')

    for (const [agentType, performance] of Object.entries(performanceData)) {
      const currentWeight = this.config.agentWeights[agentType as AgentType]

      // Adjust weight based on performance (simple linear adjustment)
      // High performance (>0.8) increases weight, low performance (<0.4) decreases weight
      let adjustment = 0
      if (performance > 0.8) {
        adjustment = 0.1
      } else if (performance < 0.4) {
        adjustment = -0.1
      }

      const newWeight = Math.max(0, Math.min(2, currentWeight + adjustment))
      this.config.agentWeights[agentType as AgentType] = newWeight

      if (adjustment !== 0) {
        core.info(`📊 Adjusted ${agentType} weight: ${currentWeight} -> ${newWeight}`)
      }
    }
  }

  /**
   * Get summary of agent capabilities
   */
  getAgentCapabilities(): Record<AgentType, string[]> {
    const capabilities: Record<AgentType, string[]> = {} as any

    for (const [agentType, agent] of this.agents.entries()) {
      capabilities[agentType] = agent.capabilities
    }

    return capabilities
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup resources (if needed)
   */
  async cleanup(): Promise<void> {
    // Currently no cleanup needed, but this method provides
    // a hook for future resource management
    core.debug('🧹 Cleaning up orchestrator resources')
  }
}
