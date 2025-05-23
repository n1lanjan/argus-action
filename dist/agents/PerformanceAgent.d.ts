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
import { ReviewAgent, ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types';
export declare class PerformanceAgent implements ReviewAgent {
    private config;
    name: AgentType;
    capabilities: string[];
    priority: number;
    private anthropic;
    private model;
    constructor(config: ReviewConfiguration);
    /**
     * Execute performance analysis on the code changes
     */
    execute(context: ReviewContext): Promise<AgentResult>;
    /**
     * Analyze a single file for performance issues
     */
    private analyzeFilePerformance;
    /**
     * Determine if a file should be analyzed for performance
     */
    private shouldAnalyzeFile;
    /**
     * Calculate confidence score based on analysis quality
     */
    private calculateConfidence;
    /**
     * Generate summary of performance analysis
     */
    private generateSummary;
}
//# sourceMappingURL=PerformanceAgent.d.ts.map