/**
 * Security Agent
 *
 * Specialized AI agent focused on identifying security vulnerabilities and risks.
 * This agent analyzes code changes for:
 * - Authentication and authorization issues
 * - Input validation and sanitization problems
 * - SQL injection and XSS vulnerabilities
 * - Data exposure and privacy concerns
 * - Cryptographic implementation issues
 * - Configuration security problems
 */
import { ReviewAgent, ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types';
export declare class SecurityAgent implements ReviewAgent {
    private config;
    name: AgentType;
    capabilities: string[];
    priority: number;
    private anthropic;
    private model;
    constructor(config: ReviewConfiguration);
    /**
     * Execute security analysis on the code changes
     */
    execute(context: ReviewContext): Promise<AgentResult>;
    /**
     * Analyze a single file for security vulnerabilities
     */
    private analyzeFileSecurity;
    /**
     * Build the security analysis prompt
     */
    private buildSecurityAnalysisPrompt;
    /**
     * Parse Claude's response into security issues
     */
    private parseSecurityIssues;
    /**
     * Analyze configuration files for security issues
     */
    private analyzeConfigurationSecurity;
    /**
     * Check if file is a configuration file
     */
    private isConfigurationFile;
    /**
     * Check for hardcoded secrets using patterns
     */
    private containsHardcodedSecrets;
    /**
     * Check for insecure configuration patterns
     */
    private checkInsecureConfigurations;
    /**
     * Determine if a file should be analyzed for security
     */
    private shouldAnalyzeFile;
    /**
     * Calculate confidence score for security analysis
     */
    private calculateConfidence;
    /**
     * Generate security analysis summary
     */
    private generateSecuritySummary;
    /**
     * Format security issue description with additional context
     */
    private formatSecurityDescription;
    /**
     * Get security learning resources based on category
     */
    private getSecurityResources;
    /**
     * Determine complexity level for security coaching
     */
    private determineSecurityComplexity;
}
//# sourceMappingURL=SecurityAgent.d.ts.map