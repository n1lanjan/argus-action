/**
 * Architecture Agent
 *
 * Specialized AI agent focused on software architecture and design patterns.
 * This agent analyzes code changes for:
 * - Design pattern violations
 * - SOLID principle adherence
 * - Code organization and structure
 * - Dependency management
 * - Modularity and coupling issues
 * - Architectural consistency
 */
import { ReviewAgent, ReviewContext, AgentResult, AgentType, ReviewConfiguration } from '../types';
export declare class ArchitectureAgent implements ReviewAgent {
    private config;
    name: AgentType;
    capabilities: string[];
    priority: number;
    private anthropic;
    private model;
    constructor(config: ReviewConfiguration);
    /**
     * Execute architecture analysis on the code changes
     */
    execute(context: ReviewContext): Promise<AgentResult>;
    /**
     * Analyze a single file for architecture issues
     */
    private analyzeFileArchitecture;
    /**
     * Build the architecture analysis prompt
     */
    private buildArchitectureAnalysisPrompt;
    /**
     * Parse Claude's response into architecture issues
     */
    private parseArchitectureIssues;
    /**
     * Analyze structural changes across multiple files
     */
    private analyzeStructuralChanges;
    /**
     * Analyze new modules for architectural consistency
     */
    private analyzeNewModules;
    /**
     * Analyze file renames for architectural impact
     */
    private analyzeFileRenames;
    /**
     * Check for potential circular dependencies
     */
    private checkCircularDependencies;
    /**
     * Determine if a file should be analyzed for architecture
     */
    private shouldAnalyzeFile;
    /**
     * Calculate confidence score based on analysis quality
     */
    private calculateConfidence;
    /**
     * Generate summary of architecture analysis
     */
    private generateSummary;
    /**
     * Helper methods for architectural analysis
     */
    private getExpectedLocation;
    private breaksNamingPattern;
    private extractNamingPattern;
    private hasCircularDependencyRisk;
    private formatArchitectureDescription;
    private getArchitectureResources;
    private determineArchitectureComplexity;
}
//# sourceMappingURL=ArchitectureAgent.d.ts.map