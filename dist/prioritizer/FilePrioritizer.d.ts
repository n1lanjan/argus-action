/**
 * File Prioritizer
 *
 * Analyzes changed files and assigns priority levels based on:
 * - Security criticality
 * - Business logic importance
 * - Architecture impact
 * - Test coverage gaps
 * - Performance implications
 */
import { ChangedFile, ProjectContext, ReviewConfiguration } from '../types';
export declare class FilePrioritizer {
    private config;
    constructor(config: ReviewConfiguration);
    /**
     * Prioritize files based on risk and importance
     */
    prioritizeFiles(files: ChangedFile[], context: ProjectContext): Promise<ChangedFile[]>;
    /**
     * Calculate priority for a single file
     */
    private calculateFilePriority;
    /**
     * Check if file is security-critical
     */
    private isSecurityCritical;
    /**
     * Check if file contains business logic
     */
    private isBusinessLogic;
    /**
     * Check if file is an API endpoint
     */
    private isApiEndpoint;
    /**
     * Check if file is architecture-related
     */
    private isArchitectureFile;
    /**
     * Check if file is database-related
     */
    private isDatabaseRelated;
    /**
     * Check if file is a configuration file
     */
    private isConfigurationFile;
    /**
     * Check if file is in a critical area based on project context
     */
    private isInCriticalArea;
    /**
     * Simple pattern matching utility
     */
    private matchesPattern;
    /**
     * Get priority breakdown for logging
     */
    private getPriorityBreakdown;
}
//# sourceMappingURL=FilePrioritizer.d.ts.map