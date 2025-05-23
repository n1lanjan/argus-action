/**
 * Logic Agent
 *
 * Specialized AI agent that focuses on code logic analysis using Claude Code.
 * This agent leverages Claude's deep understanding of code to identify:
 * - Logic errors and edge cases
 * - Business rule violations
 * - Complex algorithmic issues
 * - Code flow problems
 * - Integration and dependency issues
 */
import { ReviewAgent, ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types';
export declare class LogicAgent implements ReviewAgent {
    private config;
    name: AgentType;
    capabilities: string[];
    priority: number;
    private anthropic;
    private model;
    constructor(config: ReviewConfiguration);
    /**
     * Execute logic analysis on the code changes
     */
    execute(context: ReviewContext): Promise<AgentResult>;
    /**
     * Analyze a single file for logic issues
     */
    private analyzeFileLogic;
    /**
     * Build the analysis prompt for Claude
     */
    private buildAnalysisPrompt;
    /**
     * Parse Claude's response into ReviewIssue objects
     */
    private parseLogicIssues;
    /**
     * Determine if a file should be analyzed for logic issues
     */
    private shouldAnalyzeFile;
    /**
     * Calculate confidence score based on analysis quality
     */
    private calculateConfidence;
    /**
     * Generate summary of logic analysis
     */
    private generateSummary;
    /**
     * Determine complexity level for coaching
     */
    private determineComplexityLevel;
}
//# sourceMappingURL=LogicAgent.d.ts.map