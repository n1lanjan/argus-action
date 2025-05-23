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
import { ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types';
export declare class ReviewOrchestrator {
    private config;
    private agents;
    private concurrencyLimit;
    constructor(config: ReviewConfiguration);
    /**
     * Initialize all review agents based on configuration
     */
    private initializeAgents;
    /**
     * Execute review using all configured agents
     */
    executeReview(context: ReviewContext): Promise<AgentResult[]>;
    /**
     * Execute a single agent with retry logic and error handling
     */
    private executeAgentWithRetry;
    /**
     * Validate agent result format and content
     */
    private validateAgentResult;
    /**
     * Get agent performance metrics
     */
    getAgentMetrics(): Record<AgentType, any>;
    /**
     * Check if all required agents are available
     */
    validateAgentAvailability(): void;
    /**
     * Dynamically adjust agent weights based on performance
     */
    adjustAgentWeights(performanceData: Record<AgentType, number>): void;
    /**
     * Get summary of agent capabilities
     */
    getAgentCapabilities(): Record<AgentType, string[]>;
    /**
     * Sleep utility for retry delays
     */
    private sleep;
    /**
     * Cleanup resources (if needed)
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=ReviewOrchestrator.d.ts.map