/**
 * Linting Coordinator
 *
 * Coordinates multiple static analysis tools and linters to provide
 * comprehensive code quality analysis. This component:
 * - Runs configured linters (ESLint, TypeScript, Prettier, etc.)
 * - Aggregates and summarizes findings
 * - Filters out noise and duplicates
 * - Provides actionable summaries instead of individual comments
 */
import { LintResult, ReviewConfiguration } from '../types';
export declare class LintingCoordinator {
    private config;
    private readonly workspaceRoot;
    constructor(config: ReviewConfiguration);
    /**
     * Run all configured linters and aggregate results
     */
    runAllLinters(files: string[]): Promise<LintResult>;
    /**
     * Run a specific linter on the given files
     */
    private runLinter;
    /**
     * Run ESLint analysis
     */
    private runESLint;
    /**
     * Run TypeScript compiler analysis
     */
    private runTypeScript;
    /**
     * Run Prettier formatting analysis
     */
    private runPrettier;
    /**
     * Run SonarJS analysis (if available)
     */
    private runSonarJS;
    /**
     * Check if a tool is available in the environment
     */
    private checkToolAvailability;
    /**
     * Map ESLint severity numbers to strings
     */
    private mapESLintSeverity;
    /**
     * Calculate severity breakdown across all linters
     */
    private calculateSeverityBreakdown;
    /**
     * Generate a comprehensive summary of linting results
     */
    private generateLintingSummary;
    /**
     * Get most common issues for a linter
     */
    private getMostCommonIssues;
    /**
     * Generate configuration suggestions based on findings
     */
    private getConfigurationSuggestions;
    /**
     * Get linting statistics for metrics
     */
    getLintingStatistics(result: LintResult): Record<string, unknown>;
}
//# sourceMappingURL=LintingCoordinator.d.ts.map