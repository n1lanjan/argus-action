/**
 * Configuration Manager
 *
 * Handles loading and validation of configuration from multiple sources:
 * - GitHub Action inputs
 * - Repository configuration files
 * - Team-specific settings
 * - Default fallbacks
 */

import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as yaml from 'js-yaml'
import { ReviewConfiguration, PrDescriptionMode } from '../types'

export class ConfigurationManager {
  private static readonly DEFAULT_CONFIG: ReviewConfiguration = {
    strictnessLevel: 'standard',
    focusAreas: ['security', 'architecture', 'logic'],
    agentWeights: {
      security: 1.0,
      architecture: 0.8,
      logic: 1.0,
      performance: 0.6,
      testing: 0.4,
    },
    linting: {
      enabled: ['eslint', 'typescript', 'prettier'],
      configs: {},
    },
    learningMode: true,
    enableCoaching: true,
    updatePrDescription: 'append',
    maxFiles: 50,
    excludePaths: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/*.generated.*',
      '**/*.lock',
      'vendor/**',
      '.git/**',
    ],
    models: {
      anthropic: 'claude-sonnet-4-20250514',
      openai: 'gpt-4-turbo-preview',
      parameters: {
        temperature: 0.1,
        maxTokens: 4000,
      },
    },
  }

  /**
   * Load complete configuration from all sources
   */
  async loadConfiguration(): Promise<ReviewConfiguration> {
    core.info('📋 Loading configuration...')

    // Start with default configuration
    let config = { ...ConfigurationManager.DEFAULT_CONFIG }

    // Load team-specific configuration if available
    const teamConfig = await this.loadTeamConfiguration()
    if (teamConfig) {
      config = this.mergeConfigurations(config, teamConfig)
      core.info('✅ Team configuration loaded')
    }

    // Override with GitHub Action inputs
    const actionConfig = this.loadActionInputs()
    config = this.mergeConfigurations(config, actionConfig)

    // Validate configuration
    this.validateConfiguration(config)

    core.info(`✅ Configuration loaded: ${config.strictnessLevel} mode`)
    return config
  }

  /**
   * Load team-specific configuration from repository
   */
  private async loadTeamConfiguration(): Promise<Partial<ReviewConfiguration> | null> {
    const configPath = core.getInput('team-config-path') || '.github/argus-config.yml'

    try {
      const configContent = await fs.readFile(configPath, 'utf8')
      const teamConfig = yaml.load(configContent) as Partial<ReviewConfiguration>

      core.debug(`Team configuration loaded from ${configPath}`)
      return teamConfig
    } catch {
      // Config file is optional
      core.debug(`No team configuration found at ${configPath}`)
      return null
    }
  }

  /**
   * Load configuration from GitHub Action inputs
   */
  private loadActionInputs(): Partial<ReviewConfiguration> {
    const config: Partial<ReviewConfiguration> = {}

    // Strictness level
    const strictnessLevel = core.getInput('strictness-level')
    if (strictnessLevel) {
      config.strictnessLevel = strictnessLevel as 'coaching' | 'standard' | 'strict' | 'blocking'
    }

    // Focus areas
    const focusAreas = core.getInput('focus-areas')
    if (focusAreas) {
      config.focusAreas = focusAreas.split(',').map(area => area.trim()) as (
        | 'security'
        | 'architecture'
        | 'logic'
        | 'performance'
        | 'testing'
        | 'documentation'
      )[]
    }

    // Learning mode
    const learningMode = core.getInput('learning-mode')
    if (learningMode) {
      config.learningMode = learningMode.toLowerCase() === 'true'
    }

    // Enable coaching
    const enableCoaching = core.getInput('enable-coaching')
    if (enableCoaching) {
      config.enableCoaching = enableCoaching.toLowerCase() === 'true'
    }

    // Update PR description
    const updatePrDescription = core.getInput('update-pr-description')
    if (updatePrDescription) {
      const mode = updatePrDescription.toLowerCase()
      if (mode === 'disabled' || mode === 'overwrite' || mode === 'append') {
        config.updatePrDescription = mode as PrDescriptionMode
      } else if (mode === 'true') {
        // Backward compatibility: treat 'true' as 'append'
        config.updatePrDescription = 'append'
      } else if (mode === 'false') {
        // Backward compatibility: treat 'false' as 'disabled'
        config.updatePrDescription = 'disabled'
      }
    }

    // Max files
    const maxFiles = core.getInput('max-files')
    if (maxFiles) {
      config.maxFiles = parseInt(maxFiles, 10)
    }

    // Exclude paths
    const excludePaths = core.getInput('exclude-paths')
    if (excludePaths) {
      config.excludePaths = excludePaths.split('\n').filter(path => path.trim())
    }

    // Linting configuration
    const includeLinters = core.getInput('include-linters')
    if (includeLinters) {
      config.linting = {
        enabled: includeLinters.split(',').map(linter => linter.trim()) as (
          | 'eslint'
          | 'typescript'
          | 'prettier'
          | 'sonar'
        )[],
        configs: {},
      }
    }

    // Model configuration
    const anthropicModel = core.getInput('anthropic-model')
    const openaiModel = core.getInput('openai-model')

    if (anthropicModel || openaiModel) {
      config.models = {
        anthropic: anthropicModel || ConfigurationManager.DEFAULT_CONFIG.models.anthropic,
        openai: openaiModel || ConfigurationManager.DEFAULT_CONFIG.models.openai,
        parameters: ConfigurationManager.DEFAULT_CONFIG.models.parameters,
      }
    }

    return config
  }

  /**
   * Merge two configuration objects with deep merging
   */
  private mergeConfigurations(
    base: ReviewConfiguration,
    override: Partial<ReviewConfiguration>
  ): ReviewConfiguration {
    const merged = { ...base }

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          // Deep merge objects
          const baseValue = merged[key as keyof ReviewConfiguration]
          if (typeof baseValue === 'object' && !Array.isArray(baseValue) && baseValue !== null) {
            ;(merged as Record<string, unknown>)[key] = {
              ...baseValue,
              ...value,
            }
          } else {
            ;(merged as Record<string, unknown>)[key] = value
          }
        } else {
          // Direct assignment for primitives and arrays
          ;(merged as Record<string, unknown>)[key] = value
        }
      }
    }

    return merged
  }

  /**
   * Validate configuration values
   */
  private validateConfiguration(config: ReviewConfiguration): void {
    // Validate strictness level
    const validStrictnessLevels = ['coaching', 'standard', 'strict', 'blocking']
    if (!validStrictnessLevels.includes(config.strictnessLevel)) {
      throw new Error(`Invalid strictness level: ${config.strictnessLevel}`)
    }

    // Validate focus areas
    const validFocusAreas = [
      'security',
      'architecture',
      'logic',
      'performance',
      'testing',
      'documentation',
    ]
    for (const area of config.focusAreas) {
      if (!validFocusAreas.includes(area)) {
        throw new Error(`Invalid focus area: ${area}`)
      }
    }

    // Validate max files
    if (config.maxFiles < 0) {
      throw new Error('Max files cannot be negative')
    }

    // Validate agent weights
    for (const [agent, weight] of Object.entries(config.agentWeights)) {
      if (weight < 0 || weight > 2) {
        throw new Error(`Invalid agent weight for ${agent}: ${weight} (must be 0-2)`)
      }
    }

    // Validate model configuration
    if (!config.models.anthropic || !config.models.openai) {
      throw new Error('Both Anthropic and OpenAI models must be specified')
    }

    // Validate linting configuration
    const validLinters = ['eslint', 'typescript', 'prettier', 'sonar']
    for (const linter of config.linting.enabled) {
      if (!validLinters.includes(linter)) {
        throw new Error(`Invalid linter: ${linter}`)
      }
    }

    // Validate PR description mode
    const validPrModes: PrDescriptionMode[] = ['disabled', 'overwrite', 'append']
    if (!validPrModes.includes(config.updatePrDescription)) {
      throw new Error(`Invalid PR description mode: ${config.updatePrDescription}`)
    }

    core.info('✅ Configuration validation passed')
  }

  /**
   * Get strictness-specific settings
   */
  static getStrictnessSettings(level: string) {
    switch (level) {
      case 'coaching':
        return {
          blockOnIssues: false,
          includeEducationalContent: true,
          severityThreshold: 'info',
          maxIssuesPerFile: 10,
        }
      case 'standard':
        return {
          blockOnIssues: false,
          includeEducationalContent: true,
          severityThreshold: 'warning',
          maxIssuesPerFile: 5,
        }
      case 'strict':
        return {
          blockOnIssues: true,
          includeEducationalContent: false,
          severityThreshold: 'warning',
          maxIssuesPerFile: 3,
        }
      case 'blocking':
        return {
          blockOnIssues: true,
          includeEducationalContent: false,
          severityThreshold: 'error',
          maxIssuesPerFile: 1,
        }
      default:
        return {
          blockOnIssues: false,
          includeEducationalContent: true,
          severityThreshold: 'warning',
          maxIssuesPerFile: 5,
        }
    }
  }

  /**
   * Get environment variables for AI model APIs
   */
  static getAPIKeys(): { anthropic?: string; openai?: string } {
    return {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    }
  }

  /**
   * Check if debug mode is enabled
   */
  static isDebugMode(): boolean {
    return core.getInput('debug').toLowerCase() === 'true' || process.env.DEBUG === 'true'
  }
}
