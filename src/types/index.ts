/**
 * Core type definitions for Argus
 *
 * This file contains all the essential interfaces and types used throughout
 * the application, providing a centralized type system for better maintainability.
 */

export interface ReviewContext {
  /** Pull request information */
  pullRequest: PullRequestInfo
  /** Changed files in the PR */
  changedFiles: ChangedFile[]
  /** Project context and analysis */
  projectContext: ProjectContext
  /** Configuration for this review */
  config: ReviewConfiguration
  /** GitHub API client */
  github: unknown // Octokit instance
}

export interface PullRequestInfo {
  /** PR number */
  number: number
  /** PR title */
  title: string
  /** PR description */
  description: string
  /** Base branch */
  base: {
    sha: string
    ref: string
  }
  /** Head branch */
  head: {
    sha: string
    ref: string
  }
  /** PR author */
  author: string
  /** Repository information */
  repository: {
    owner: string
    name: string
  }
}

export interface ChangedFile {
  /** File path relative to repository root */
  filename: string
  /** File status: added, modified, deleted, renamed */
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  /** Number of additions */
  additions: number
  /** Number of deletions */
  deletions: number
  /** Git patch/diff */
  patch?: string
  /** Previous filename if renamed */
  previousFilename?: string
  /** Risk priority assigned by prioritizer */
  priority: FilePriority
  /** File content (for context) */
  content?: string
}

export type FilePriority = 'critical' | 'high' | 'medium' | 'low'

export interface ProjectContext {
  /** Detected frameworks and technologies */
  frameworks: DetectedFramework[]
  /** Project architecture analysis */
  architecture: ArchitectureInfo
  /** Coding conventions and patterns */
  conventions: CodingConventions
  /** Testing strategy and patterns */
  testStrategy: TestingStrategy
  /** Security requirements and patterns */
  security: SecurityProfile
  /** Performance criteria */
  performance: PerformanceProfile
  /** Dependencies analysis */
  dependencies: DependencyInfo
}

export interface DetectedFramework {
  /** Framework name (e.g., 'react', 'express', 'vue') */
  name: string
  /** Framework version */
  version: string
  /** Confidence level (0-1) */
  confidence: number
  /** Configuration files found */
  configFiles: string[]
}

export interface ArchitectureInfo {
  /** Architecture pattern (MVC, microservices, etc.) */
  pattern: string
  /** Main source directories */
  sourceDirectories: string[]
  /** Test directories */
  testDirectories: string[]
  /** Configuration directories */
  configDirectories: string[]
  /** Entry points */
  entryPoints: string[]
}

export interface CodingConventions {
  /** Indentation style */
  indentation: 'spaces' | 'tabs'
  /** Indentation size */
  indentSize: number
  /** Naming conventions */
  naming: {
    variables: 'camelCase' | 'snake_case' | 'kebab-case'
    functions: 'camelCase' | 'snake_case' | 'kebab-case'
    classes: 'PascalCase' | 'camelCase'
    constants: 'UPPER_CASE' | 'camelCase'
  }
  /** Import/export patterns */
  imports: {
    style: 'commonjs' | 'es6' | 'mixed'
    organization: 'grouped' | 'sorted' | 'none'
  }
}

export interface TestingStrategy {
  /** Testing framework */
  framework: string
  /** Test file patterns */
  patterns: string[]
  /** Coverage requirements */
  coverage: {
    minimum: number
    target: number
  }
  /** Testing types used */
  types: ('unit' | 'integration' | 'e2e')[]
}

export interface SecurityProfile {
  /** Security-critical file patterns */
  criticalFiles: string[]
  /** Authentication patterns */
  authPatterns: string[]
  /** Data handling requirements */
  dataHandling: {
    encryption: boolean
    sanitization: boolean
    validation: boolean
  }
}

export interface PerformanceProfile {
  /** Performance-critical areas */
  criticalAreas: string[]
  /** Performance budgets */
  budgets: {
    bundleSize?: number
    loadTime?: number
    memoryUsage?: number
  }
}

export interface DependencyInfo {
  /** Package manager used */
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'maven' | 'gradle' | 'pip'
  /** Production dependencies */
  production: string[]
  /** Development dependencies */
  development: string[]
  /** Outdated dependencies */
  outdated: string[]
  /** Security vulnerabilities */
  vulnerabilities: DependencyVulnerability[]
}

export interface DependencyVulnerability {
  /** Package name */
  package: string
  /** Vulnerability severity */
  severity: 'low' | 'moderate' | 'high' | 'critical'
  /** Description */
  description: string
  /** Recommended fix */
  fix?: string
}

export type PrDescriptionMode = 'disabled' | 'overwrite' | 'append'

export interface ReviewConfiguration {
  /** Review strictness level */
  strictnessLevel: 'coaching' | 'standard' | 'strict' | 'blocking'
  /** Areas to focus on */
  focusAreas: ReviewFocus[]
  /** Agent weights/priorities */
  agentWeights: Record<AgentType, number>
  /** Linting configuration */
  linting: LinterConfig
  /** Whether to enable learning mode */
  learningMode: boolean
  /** Whether to enable coaching feedback */
  enableCoaching: boolean
  /** How to handle PR description updates */
  updatePrDescription: PrDescriptionMode
  /** Maximum files to review */
  maxFiles: number
  /** Path exclusion patterns */
  excludePaths: string[]
  /** AI model configurations */
  models: ModelConfig
}

export type ReviewFocus =
  | 'security'
  | 'architecture'
  | 'logic'
  | 'performance'
  | 'testing'
  | 'documentation'

export type AgentType = 'security' | 'architecture' | 'logic' | 'performance' | 'testing'

export interface LinterConfig {
  /** Enabled linters */
  enabled: ('eslint' | 'typescript' | 'prettier' | 'sonar')[]
  /** Linter-specific configurations */
  configs: Record<string, unknown>
}

export interface ModelConfig {
  /** Anthropic model for Claude agents */
  anthropic: string
  /** OpenAI model for specialized tasks */
  openai: string
  /** Model-specific parameters */
  parameters: {
    temperature: number
    maxTokens: number
  }
}

export interface ReviewAgent {
  /** Agent name/identifier */
  name: AgentType
  /** Agent capabilities */
  capabilities: string[]
  /** Priority level */
  priority: number
  /** Execute review for given context */
  execute(context: ReviewContext): Promise<AgentResult>
}

export interface AgentResult {
  /** Agent that generated this result */
  agent: AgentType
  /** Confidence score (0-1) */
  confidence: number
  /** Issues found */
  issues: ReviewIssue[]
  /** Summary of findings */
  summary: string
  /** Execution time in ms */
  executionTime: number
}

export interface SuggestedFix {
  /** Descriptive comment about the fix */
  comment: string
  /** Actual code diff/change (if applicable) */
  diff?: string
}

export interface ReviewIssue {
  /** Issue severity */
  severity: 'info' | 'warning' | 'error' | 'critical'
  /** Issue category */
  category: string
  /** Issue title */
  title: string
  /** Detailed description */
  description: string
  /** File path */
  file: string
  /** Line number (if applicable) */
  line?: number
  /** End line number for range issues */
  endLine?: number
  /** Code snippet */
  snippet?: string
  /** Suggested fix */
  suggestion?: SuggestedFix
  /** Educational context */
  coaching?: CoachingInfo
}

export interface CoachingInfo {
  /** Why this issue matters */
  rationale: string
  /** Learning resources */
  resources: string[]
  /** Best practice explanation */
  bestPractice: string
  /** Difficulty level */
  level: 'beginner' | 'intermediate' | 'advanced'
}

export interface LintResult {
  /** Total issues found */
  totalIssues: number
  /** Issues by severity */
  severityBreakdown: Record<string, number>
  /** Issues by linter */
  byLinter: Record<string, LintIssue[]>
  /** Summary of findings */
  summary: string
  /** Auto-fixable issues count */
  autoFixable: number
}

export interface LintIssue {
  /** Linter that found this issue */
  linter: string
  /** File path */
  file: string
  /** Line number */
  line: number
  /** Column number */
  column: number
  /** Issue severity */
  severity: 'error' | 'warning' | 'info'
  /** Issue message */
  message: string
  /** Rule ID */
  ruleId?: string
  /** Whether auto-fixable */
  fixable: boolean
}

export interface FinalReview {
  /** Overall review summary */
  summary: string
  /** Critical issues that block merge */
  blockingIssues: ReviewIssue[]
  /** Non-blocking recommendations */
  recommendations: ReviewIssue[]
  /** Linting summary */
  lintingSummary: LintResult
  /** Coaching feedback */
  coaching: CoachingInfo[]
  /** Metrics for tracking */
  metrics: ReviewMetrics
}

export interface ReviewMetrics extends Record<string, unknown> {
  /** Total files reviewed */
  filesReviewed: number
  /** Total issues found */
  issuesFound: number
  /** Review execution time */
  executionTime: number
  /** Agent performance */
  agentPerformance: Record<AgentType, AgentPerformance>
}

export interface AgentPerformance {
  /** Issues found by this agent */
  issuesFound: number
  /** Execution time */
  executionTime: number
  /** Confidence score */
  averageConfidence: number
}

export interface DeveloperProfile {
  /** Developer experience level */
  level: 'junior' | 'mid' | 'senior' | 'lead'
  /** Areas of expertise */
  expertise: string[]
  /** Learning goals */
  learningGoals: string[]
  /** Feedback history */
  feedbackHistory: FeedbackEntry[]
}

export interface FeedbackEntry {
  /** Review ID */
  reviewId: string
  /** Developer feedback */
  feedback: 'helpful' | 'not-helpful' | 'incorrect'
  /** Additional comments */
  comments?: string
  /** Timestamp */
  timestamp: Date
}
