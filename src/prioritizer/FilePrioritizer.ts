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

import * as core from '@actions/core'
import { ChangedFile, ProjectContext, ReviewConfiguration, FilePriority } from '../types'

export class FilePrioritizer {
  constructor(private config: ReviewConfiguration) {}

  /**
   * Prioritize files based on risk and importance
   */
  async prioritizeFiles(files: ChangedFile[], context: ProjectContext): Promise<ChangedFile[]> {
    core.info(`🎯 Prioritizing ${files.length} changed files...`)

    // Assign priorities to each file
    const prioritizedFiles = files.map(file => ({
      ...file,
      priority: this.calculateFilePriority(file, context),
    }))

    // Sort by priority (critical first)
    const sortedFiles = prioritizedFiles.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    const priorityBreakdown = this.getPriorityBreakdown(sortedFiles)
    core.info(`🎯 Priority breakdown: ${JSON.stringify(priorityBreakdown)}`)

    return sortedFiles
  }

  /**
   * Calculate priority for a single file
   */
  private calculateFilePriority(file: ChangedFile, context: ProjectContext): FilePriority {
    let score = 0

    // Security-critical files get highest priority
    if (this.isSecurityCritical(file, context)) {
      score += 10
    }

    // Core business logic files
    if (this.isBusinessLogic(file)) {
      score += 8
    }

    // API endpoints and controllers
    if (this.isApiEndpoint(file)) {
      score += 7
    }

    // Architecture/infrastructure files
    if (this.isArchitectureFile(file)) {
      score += 6
    }

    // Database-related files
    if (this.isDatabaseRelated(file)) {
      score += 6
    }

    // Configuration files
    if (this.isConfigurationFile(file)) {
      score += 5
    }

    // New files (higher risk)
    if (file.status === 'added') {
      score += 3
    }

    // Large changes
    if (file.additions + file.deletions > 100) {
      score += 2
    }

    // Files in critical areas based on project context
    if (this.isInCriticalArea(file, context)) {
      score += 4
    }

    // Convert score to priority level
    if (score >= 15) return 'critical'
    if (score >= 10) return 'high'
    if (score >= 5) return 'medium'
    return 'low'
  }

  /**
   * Check if file is security-critical
   */
  private isSecurityCritical(file: ChangedFile, context: ProjectContext): boolean {
    const securityPatterns = [
      /auth/i,
      /security/i,
      /crypto/i,
      /password/i,
      /token/i,
      /jwt/i,
      /oauth/i,
      /session/i,
      /login/i,
      /permission/i,
      /role/i,
    ]

    const filename = file.filename.toLowerCase()

    // Check against security patterns
    if (securityPatterns.some(pattern => pattern.test(filename))) {
      return true
    }

    // Check against project security profile
    if (
      context.security.criticalFiles.some(pattern => this.matchesPattern(file.filename, pattern))
    ) {
      return true
    }

    return false
  }

  /**
   * Check if file contains business logic
   */
  private isBusinessLogic(file: ChangedFile): boolean {
    const businessPatterns = [
      /service/i,
      /business/i,
      /logic/i,
      /domain/i,
      /model/i,
      /entity/i,
      /repository/i,
      /manager/i,
      /handler/i,
      /processor/i,
    ]

    return businessPatterns.some(pattern => pattern.test(file.filename))
  }

  /**
   * Check if file is an API endpoint
   */
  private isApiEndpoint(file: ChangedFile): boolean {
    const apiPatterns = [/api/i, /controller/i, /route/i, /endpoint/i, /middleware/i, /handler/i]

    return apiPatterns.some(pattern => pattern.test(file.filename))
  }

  /**
   * Check if file is architecture-related
   */
  private isArchitectureFile(file: ChangedFile): boolean {
    const archPatterns = [
      /config/i,
      /setup/i,
      /bootstrap/i,
      /infrastructure/i,
      /core/i,
      /base/i,
      /abstract/i,
      /interface/i,
      /factory/i,
      /builder/i,
    ]

    return archPatterns.some(pattern => pattern.test(file.filename))
  }

  /**
   * Check if file is database-related
   */
  private isDatabaseRelated(file: ChangedFile): boolean {
    const dbPatterns = [
      /database/i,
      /db/i,
      /migration/i,
      /schema/i,
      /query/i,
      /repository/i,
      /dao/i,
      /entity/i,
      /model/i,
    ]

    return dbPatterns.some(pattern => pattern.test(file.filename))
  }

  /**
   * Check if file is a configuration file
   */
  private isConfigurationFile(file: ChangedFile): boolean {
    const configExtensions = ['.config.js', '.config.ts', '.json', '.yml', '.yaml', '.toml', '.env']
    const configPatterns = [
      /dockerfile/i,
      /docker-compose/i,
      /package\.json/i,
      /tsconfig/i,
      /webpack/i,
      /babel/i,
      /eslint/i,
      /prettier/i,
    ]

    return (
      configExtensions.some(ext => file.filename.endsWith(ext)) ||
      configPatterns.some(pattern => pattern.test(file.filename))
    )
  }

  /**
   * Check if file is in a critical area based on project context
   */
  private isInCriticalArea(file: ChangedFile, context: ProjectContext): boolean {
    // Check against performance critical areas
    if (context.performance.criticalAreas.some(area => this.matchesPattern(file.filename, area))) {
      return true
    }

    // Check if it's in main source directories
    const isInMainSource = context.architecture.sourceDirectories.some(dir =>
      file.filename.startsWith(dir + '/')
    )

    return isInMainSource
  }

  /**
   * Simple pattern matching utility
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    // Convert glob-like patterns to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*') // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename chars
      .replace(/\?/g, '.') // ? matches single char

    return new RegExp(regexPattern, 'i').test(filename)
  }

  /**
   * Get priority breakdown for logging
   */
  private getPriorityBreakdown(files: ChangedFile[]): Record<FilePriority, number> {
    return files.reduce(
      (breakdown, file) => {
        breakdown[file.priority] = (breakdown[file.priority] || 0) + 1
        return breakdown
      },
      {} as Record<FilePriority, number>
    )
  }
}
