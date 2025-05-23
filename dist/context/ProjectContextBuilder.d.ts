/**
 * Project Context Builder
 *
 * Analyzes the project structure and builds comprehensive context about:
 * - Framework and technology detection
 * - Architecture patterns and conventions
 * - Code organization and structure
 * - Testing strategies and patterns
 * - Security requirements and patterns
 * - Performance criteria and budgets
 */
import { ProjectContext, ReviewConfiguration } from '../types';
export declare class ProjectContextBuilder {
    private config;
    private readonly workspaceRoot;
    constructor(config: ReviewConfiguration);
    /**
     * Build comprehensive project context
     */
    buildContext(): Promise<ProjectContext>;
    /**
     * Detect frameworks and technologies used in the project
     */
    private detectFrameworks;
    /**
     * Analyze project architecture and structure
     */
    private analyzeArchitecture;
    /**
     * Analyze coding conventions used in the project
     */
    private analyzeCodingConventions;
    /**
     * Analyze testing strategy and patterns
     */
    private analyzeTestingStrategy;
    /**
     * Analyze security profile and requirements
     */
    private analyzeSecurityProfile;
    /**
     * Analyze performance profile and criteria
     */
    private analyzePerformanceProfile;
    /**
     * Analyze project dependencies
     */
    private analyzeDependencies;
    /**
     * Helper methods
     */
    private fileExists;
    private directoryExists;
    private readJsonFile;
    private inferArchitecturePattern;
    private getDefaultContext;
}
//# sourceMappingURL=ProjectContextBuilder.d.ts.map