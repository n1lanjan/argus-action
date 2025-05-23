/**
 * Configuration Manager
 *
 * Handles loading and validation of configuration from multiple sources:
 * - GitHub Action inputs
 * - Repository configuration files
 * - Team-specific settings
 * - Default fallbacks
 */
import { ReviewConfiguration } from '../types';
export declare class ConfigurationManager {
    private static readonly DEFAULT_CONFIG;
    /**
     * Load complete configuration from all sources
     */
    loadConfiguration(): Promise<ReviewConfiguration>;
    /**
     * Load team-specific configuration from repository
     */
    private loadTeamConfiguration;
    /**
     * Load configuration from GitHub Action inputs
     */
    private loadActionInputs;
    /**
     * Merge two configuration objects with deep merging
     */
    private mergeConfigurations;
    /**
     * Validate configuration values
     */
    private validateConfiguration;
    /**
     * Get strictness-specific settings
     */
    static getStrictnessSettings(level: string): {
        blockOnIssues: boolean;
        includeEducationalContent: boolean;
        severityThreshold: string;
        maxIssuesPerFile: number;
    };
    /**
     * Get environment variables for AI model APIs
     */
    static getAPIKeys(): {
        anthropic?: string;
        openai?: string;
    };
    /**
     * Check if debug mode is enabled
     */
    static isDebugMode(): boolean;
}
//# sourceMappingURL=ConfigurationManager.d.ts.map