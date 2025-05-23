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
import { ReviewAgent, ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types';
export declare class TestingAgent implements ReviewAgent {
    private config;
    name: AgentType;
    capabilities: string[];
    priority: number;
    private anthropic;
    private model;
    constructor(config: ReviewConfiguration);
    /**
     * Execute testing analysis on the code changes
     */
    execute(context: ReviewContext): Promise<AgentResult>;
    /**
     * Analyze a single file for testing issues
     */
    private analyzeFileTesting;
    /**
     * Check if file is a test file
     */
    private isTestFile;
    /**
     * Check if file is a source file that should have tests
     */
    private isSourceFile;
    /**
     * Determine if a file should be analyzed for testing
     */
    private shouldAnalyzeFile;
    /**
     * Calculate confidence score based on analysis quality
     */
    private calculateConfidence;
    /**
     * Generate summary of testing analysis
     */
    private generateSummary;
}
//# sourceMappingURL=TestingAgent.d.ts.map