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
import { AgentResult, LintResult, ReviewContext, FinalReview, ReviewConfiguration } from '../types';
export declare class ReviewSynthesizer {
    private config;
    constructor(config: ReviewConfiguration);
    /**
     * Synthesize all agent results and linting into final review
     */
    synthesize(agentResults: AgentResult[], lintResults: LintResult, context: ReviewContext): Promise<FinalReview>;
    /**
     * Aggregate issues from all agent results
     */
    private aggregateIssues;
    /**
     * Remove duplicate issues and resolve conflicts
     */
    private deduplicateIssues;
    /**
     * Determine if one issue should replace another
     */
    private shouldReplaceIssue;
    /**
     * Categorize issues into blocking vs recommendations
     */
    private categorizeIssues;
    /**
     * Determine if an issue is blocking based on strictness level
     */
    private isBlockingIssue;
    /**
     * Generate coaching recommendations
     */
    private generateCoaching;
    /**
     * Generate overall review summary
     */
    private generateSummary;
    /**
     * Calculate performance and quality metrics
     */
    private calculateMetrics;
    /**
     * Get strictness settings based on configuration
     */
    private getStrictnessSettings;
    /**
     * Get emoji for agent type
     */
    private getAgentEmoji;
}
//# sourceMappingURL=ReviewSynthesizer.d.ts.map