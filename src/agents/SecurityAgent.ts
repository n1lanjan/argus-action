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

import * as core from '@actions/core'
import Anthropic from '@anthropic-ai/sdk'
import {
  ReviewAgent,
  ReviewContext,
  AgentResult,
  AgentType,
  ReviewIssue,
  ReviewConfiguration,
} from '../types'
import { buildSecurityAnalysisPrompt } from '@/prompts'
import { parseAgentResponse } from '@/utils'

export class SecurityAgent implements ReviewAgent {
  name: AgentType = 'security'
  capabilities = [
    'Vulnerability detection',
    'Authentication/authorization review',
    'Input validation analysis',
    'Data exposure prevention',
    'Cryptographic review',
    'Configuration security',
  ]
  priority = 2

  private anthropic: Anthropic
  private model: string

  constructor(private config: ReviewConfiguration) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Security Agent')
    }

    this.anthropic = new Anthropic({ apiKey })
    this.model = config.models.anthropic
  }

  /**
   * Execute security analysis on the code changes
   */
  async execute(context: ReviewContext): Promise<AgentResult> {
    const startTime = Date.now()
    core.info('🔒 Security Agent: Starting security analysis...')

    try {
      const issues: ReviewIssue[] = []

      // Analyze each changed file for security issues
      for (const file of context.changedFiles) {
        if (this.shouldAnalyzeFile(file.filename)) {
          const fileIssues = await this.analyzeFileSecurity(file, context)
          issues.push(...fileIssues)
        }
      }

      // Check for configuration security issues
      const configIssues = await this.analyzeConfigurationSecurity(context)
      issues.push(...configIssues)

      // Generate overall summary
      const summary = this.generateSecuritySummary(issues, context)

      const result: AgentResult = {
        agent: 'security',
        confidence: this.calculateConfidence(issues, context),
        issues,
        summary,
        executionTime: Date.now() - startTime,
      }

      core.info(`🔒 Security Agent: Found ${issues.length} security issues`)
      return result
    } catch (error) {
      core.error(`Security Agent failed: ${error}`)
      throw error
    }
  }

  /**
   * Analyze a single file for security vulnerabilities
   */
  private async analyzeFileSecurity(file: any, context: ReviewContext): Promise<ReviewIssue[]> {
    if (!file.patch || !file.content) {
      return []
    }

    const prompt = buildSecurityAnalysisPrompt(file, context)

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.config.models.parameters.maxTokens,
        temperature: this.config.models.parameters.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      return this.parseSecurityIssues(response.content[0] as any, file.filename)
    } catch (error) {
      core.warning(`Failed to analyze ${file.filename} for security: ${error}`)
      return []
    }
  }

  /**
   * Parse Claude's response into security issues
   */
  private parseSecurityIssues(response: any, filename: string): ReviewIssue[] {
    const issues: ReviewIssue[] = []
    const text = response.text || ''
    const parsedIssues = parseAgentResponse(text, filename, 'security')

    for (const issue of parsedIssues) {
      issues.push({
        severity: issue.severity || 'warning',
        category: issue.category ? `security-${issue.category}` : 'security-general',
        title: `🔒 ${issue.title}`,
        description: this.formatSecurityDescription(issue),
        file: filename,
        line: issue.line,
        endLine: issue.endLine,
        snippet: issue.snippet,
        suggestion:
          typeof issue.suggestion === 'string' ? { comment: issue.suggestion } : issue.suggestion,
        coaching: {
          rationale: issue.rationale || '',
          resources: this.getSecurityResources(issue.category),
          bestPractice: issue.bestPractice || '',
          level: this.determineSecurityComplexity(issue.category),
        },
      })
    }

    return issues
  }

  /**
   * Analyze configuration files for security issues
   */
  private async analyzeConfigurationSecurity(context: ReviewContext): Promise<ReviewIssue[]> {
    const configFiles = context.changedFiles.filter(file => this.isConfigurationFile(file.filename))

    const issues: ReviewIssue[] = []

    for (const file of configFiles) {
      // Check for hardcoded secrets
      if (file.content && this.containsHardcodedSecrets(file.content)) {
        issues.push({
          severity: 'critical',
          category: 'security-configuration',
          title: '🚨 Hardcoded Secrets Detected',
          description:
            'Configuration file contains what appears to be hardcoded credentials or API keys.',
          file: file.filename,
          snippet: 'Content hidden for security',
          suggestion: {
            comment: 'Use environment variables or secure secret management systems instead',
          },
          coaching: {
            rationale:
              'Hardcoded secrets can be exposed in version control and compromise security',
            resources: ['OWASP Secret Management Cheat Sheet'],
            bestPractice:
              'Store secrets in environment variables or dedicated secret management systems',
            level: 'intermediate',
          },
        })
      }

      // Check for insecure configurations
      const configIssues = this.checkInsecureConfigurations(file)
      issues.push(...configIssues)
    }

    return issues
  }

  /**
   * Check if file is a configuration file
   */
  private isConfigurationFile(filename: string): boolean {
    const configPatterns = [
      /\.env/,
      /config\.(js|ts|json|yaml|yml)$/,
      /\.config\.(js|ts)$/,
      /docker-compose\.ya?ml$/,
      /Dockerfile$/,
      /nginx\.conf$/,
      /apache\.conf$/,
    ]

    return configPatterns.some(pattern => pattern.test(filename))
  }

  /**
   * Check for hardcoded secrets using patterns
   */
  private containsHardcodedSecrets(content: string): boolean {
    const secretPatterns = [
      /password\s*[=:]\s*["'][^"']{8,}["']/i,
      /api_?key\s*[=:]\s*["'][^"']{20,}["']/i,
      /secret\s*[=:]\s*["'][^"']{16,}["']/i,
      /token\s*[=:]\s*["'][^"']{20,}["']/i,
      /private_?key\s*[=:]\s*["']-----BEGIN/i,
    ]

    return secretPatterns.some(pattern => pattern.test(content))
  }

  /**
   * Check for insecure configuration patterns
   */
  private checkInsecureConfigurations(file: any): ReviewIssue[] {
    const issues: ReviewIssue[] = []

    if (!file.content) return issues

    // Check for insecure CORS settings
    if (file.content.includes('Access-Control-Allow-Origin: *')) {
      issues.push({
        severity: 'warning',
        category: 'security-configuration',
        title: '⚠️ Permissive CORS Configuration',
        description: 'Wildcard CORS origin allows requests from any domain',
        file: file.filename,
        suggestion: {
          comment: 'Specify allowed origins explicitly instead of using wildcard',
        },
        coaching: {
          rationale: 'Wildcard CORS can enable CSRF attacks and unauthorized data access',
          resources: ['OWASP CORS Guide'],
          bestPractice: 'Use specific origins and validate them server-side',
          level: 'intermediate',
        },
      })
    }

    // Check for debug mode in production configs
    if (file.content.includes('debug: true') || file.content.includes('DEBUG=true')) {
      issues.push({
        severity: 'error',
        category: 'security-configuration',
        title: '🐛 Debug Mode Enabled',
        description: 'Debug mode may expose sensitive information',
        file: file.filename,
        suggestion: {
          comment: 'Ensure debug mode is disabled in production',
        },
        coaching: {
          rationale: 'Debug mode can leak stack traces, internal paths, and sensitive data',
          resources: ['OWASP Configuration Guide'],
          bestPractice: 'Use environment-specific configuration with debug disabled in production',
          level: 'beginner',
        },
      })
    }

    return issues
  }

  /**
   * Determine if a file should be analyzed for security
   */
  private shouldAnalyzeFile(filename: string): boolean {
    // Prioritize security-critical file types
    const securityCriticalPatterns = [
      /auth/i,
      /login/i,
      /password/i,
      /crypto/i,
      /security/i,
      /session/i,
      /jwt/i,
      /oauth/i,
      /api/i,
      /middleware/i,
      /routes?/i,
      /controllers?/i,
      /handlers?/i,
    ]

    // Check if filename indicates security relevance
    const isSecurityRelevant = securityCriticalPatterns.some(pattern => pattern.test(filename))

    // Standard code files
    const codeExtensions = [
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.php',
      '.rb',
      '.go',
      '.cs',
    ]
    const isCodeFile = codeExtensions.some(ext => filename.endsWith(ext))

    // Configuration files
    const isConfigFile = this.isConfigurationFile(filename)

    return isCodeFile || isConfigFile || isSecurityRelevant
  }

  /**
   * Calculate confidence score for security analysis
   */
  private calculateConfidence(issues: ReviewIssue[], context: ReviewContext): number {
    let baseConfidence = 0.85

    // Higher confidence for security-critical files
    const securityFiles = context.changedFiles.filter(f =>
      /auth|security|crypto|login/.test(f.filename.toLowerCase())
    )

    if (securityFiles.length > 0) {
      baseConfidence += 0.1
    }

    // Adjust based on findings
    const criticalIssues = issues.filter(i => i.severity === 'critical')
    if (criticalIssues.length > 0) {
      baseConfidence += 0.05 // High confidence in critical findings
    }

    return Math.max(0.1, Math.min(1.0, baseConfidence))
  }

  /**
   * Generate security analysis summary
   */
  private generateSecuritySummary(issues: ReviewIssue[], _context: ReviewContext): string {
    if (issues.length === 0) {
      return 'No security vulnerabilities detected in the code changes.'
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length
    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length

    let summary = `Found ${issues.length} security issue(s): `

    const severityParts = []
    if (criticalCount > 0) severityParts.push(`${criticalCount} critical`)
    if (errorCount > 0) severityParts.push(`${errorCount} high`)
    if (warningCount > 0) severityParts.push(`${warningCount} medium`)

    summary += severityParts.join(', ')

    if (criticalCount > 0) {
      summary += '. 🚨 Critical security issues require immediate attention before merging.'
    }

    return summary
  }

  /**
   * Format security issue description with additional context
   */
  private formatSecurityDescription(issue: any): string {
    let description = issue.description

    if (issue.cwe) {
      description += `\n\n**CWE Reference**: ${issue.cwe}`
    }

    if (issue.rationale) {
      description += `\n\n**Security Impact**: ${issue.rationale}`
    }

    return description
  }

  /**
   * Get security learning resources based on category
   */
  private getSecurityResources(category: string): string[] {
    const resourceMap: Record<string, string[]> = {
      authentication: ['OWASP Authentication Cheat Sheet', 'Auth0 Security Best Practices'],
      authorization: ['OWASP Authorization Cheat Sheet', 'NIST Access Control Guidelines'],
      'input-validation': ['OWASP Input Validation Cheat Sheet', 'SANS Input Validation'],
      'data-protection': ['OWASP Data Protection Cheat Sheet', 'GDPR Technical Guidelines'],
      configuration: ['OWASP Configuration Review Guide', 'CIS Security Benchmarks'],
      cryptography: ['OWASP Cryptographic Storage Cheat Sheet', 'NIST Cryptographic Standards'],
    }

    return resourceMap[category] || ['OWASP Top 10', 'Security Code Review Guide']
  }

  /**
   * Determine complexity level for security coaching
   */
  private determineSecurityComplexity(category: string): 'beginner' | 'intermediate' | 'advanced' {
    const advancedCategories = ['cryptography', 'authorization']
    const intermediateCategories = ['authentication', 'configuration']

    if (advancedCategories.includes(category)) {
      return 'advanced'
    } else if (intermediateCategories.includes(category)) {
      return 'intermediate'
    } else {
      return 'beginner'
    }
  }
}
