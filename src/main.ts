/**
 * Main entry point for Argus - The All-Seeing Code Guardian GitHub Action
 * 
 * This file orchestrates the entire review process:
 * 1. Initializes configuration and context
 * 2. Detects and prioritizes changed files
 * 3. Runs linting and static analysis
 * 4. Executes multi-agent review
 * 5. Synthesizes results and posts feedback
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { ReviewOrchestrator } from './orchestrator/ReviewOrchestrator'
import { ProjectContextBuilder } from './context/ProjectContextBuilder'
import { FilePrioritizer } from './prioritizer/FilePrioritizer'
import { LintingCoordinator } from './linting/LintingCoordinator'
import { ReviewSynthesizer } from './synthesis/ReviewSynthesizer'
import { GitHubService } from './services/GitHubService'
import { ConfigurationManager } from './config/ConfigurationManager'
import { ReviewContext, ReviewConfiguration } from './types'

/**
 * Main execution function
 * Handles the complete review workflow with proper error handling and logging
 */
async function run(): Promise<void> {
  try {
    core.info('👁️ Argus awakens... The All-Seeing Code Guardian is watching...')
    
    // Initialize configuration
    const config = await initializeConfiguration()
    core.info(`📋 Configuration loaded: ${config.strictnessLevel} mode`)
    
    // Check if this is a supported event
    if (!isSupportedEvent()) {
      core.info('⏭️  Skipping: unsupported event type')
      return
    }
    
    // Initialize services
    const githubService = new GitHubService(config)
    const contextBuilder = new ProjectContextBuilder(config)
    const filePrioritizer = new FilePrioritizer(config)
    const lintingCoordinator = new LintingCoordinator(config)
    const orchestrator = new ReviewOrchestrator(config)
    const synthesizer = new ReviewSynthesizer(config)
    
    // Build review context
    core.info('🔍 Building review context...')
    const reviewContext = await buildReviewContext(
      config,
      githubService,
      contextBuilder,
      filePrioritizer
    )
    
    if (reviewContext.changedFiles.length === 0) {
      core.info('⏭️  No files to review')
      return
    }
    
    core.info(`📁 Found ${reviewContext.changedFiles.length} files to review`)
    
    // Run linting and static analysis
    core.info('🔧 Running linting and static analysis...')
    const lintResults = await lintingCoordinator.runAllLinters(
      reviewContext.changedFiles.map(f => f.filename)
    )
    
    // Execute multi-agent review
    core.info('👁️ Deploying the Eyes of Argus...')
    const agentResults = await orchestrator.executeReview(reviewContext)
    
    // Synthesize results
    core.info('⚡ Synthesizing review results...')
    const finalReview = await synthesizer.synthesize(
      agentResults,
      lintResults,
      reviewContext
    )
    
    // Post results to GitHub
    core.info('📝 Argus speaks his wisdom to GitHub...')
    await githubService.postReview(finalReview, reviewContext)
    
    // Log metrics
    logMetrics(finalReview.metrics)
    
    core.info('✅ Argus has completed his vigil. All eyes have spoken.')
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    core.error(`❌ Review failed: ${errorMessage}`)
    if (errorStack) {
      core.debug(`Stack trace: ${errorStack}`)
    }
    
    core.setFailed(errorMessage)
  }
}

/**
 * Initialize configuration from GitHub Action inputs and repository settings
 */
async function initializeConfiguration(): Promise<ReviewConfiguration> {
  const configManager = new ConfigurationManager()
  return await configManager.loadConfiguration()
}

/**
 * Check if the current GitHub event is supported
 */
function isSupportedEvent(): boolean {
  const eventName = github.context.eventName
  const supportedEvents = ['pull_request', 'pull_request_target', 'pull_request_review_comment']
  
  if (!supportedEvents.includes(eventName)) {
    core.warning(`Unsupported event: ${eventName}`)
    return false
  }
  
  // Skip draft PRs unless explicitly configured
  if (eventName.startsWith('pull_request')) {
    const isDraft = github.context.payload.pull_request?.draft
    if (isDraft) {
      core.info('Skipping draft PR')
      return false
    }
  }
  
  return true
}

/**
 * Build the complete review context including PR info, changed files, and project analysis
 */
async function buildReviewContext(
  config: ReviewConfiguration,
  githubService: GitHubService,
  contextBuilder: ProjectContextBuilder,
  filePrioritizer: FilePrioritizer
): Promise<ReviewContext> {
  // Get pull request information
  const pullRequest = await githubService.getPullRequestInfo()
  
  // Get changed files
  const changedFiles = await githubService.getChangedFiles()
  
  // Filter files based on configuration
  const filteredFiles = changedFiles.filter(file => 
    !isFileExcluded(file.filename, config.excludePaths)
  )
  
  // Build project context
  const projectContext = await contextBuilder.buildContext()
  
  // Prioritize files based on risk and importance
  const prioritizedFiles = await filePrioritizer.prioritizeFiles(
    filteredFiles,
    projectContext
  )
  
  // Limit files if necessary
  const finalFiles = config.maxFiles > 0 
    ? prioritizedFiles.slice(0, config.maxFiles)
    : prioritizedFiles
  
  return {
    pullRequest,
    changedFiles: finalFiles,
    projectContext,
    config,
    github: githubService.octokit
  }
}

/**
 * Check if a file should be excluded from review
 */
function isFileExcluded(filename: string, excludePatterns: string[]): boolean {
  const minimatch = require('minimatch')
  
  return excludePatterns.some(pattern => 
    minimatch(filename, pattern, { dot: true })
  )
}

/**
 * Log review metrics for monitoring and improvement
 */
function logMetrics(metrics: any): void {
  core.info('📊 Review Metrics:')
  core.info(`  • Files reviewed: ${metrics.filesReviewed}`)
  core.info(`  • Issues found: ${metrics.issuesFound}`)
  core.info(`  • Execution time: ${metrics.executionTime}ms`)
  
  // Log agent performance
  for (const [agent, performance] of Object.entries(metrics.agentPerformance as any)) {
    core.info(`  • ${agent}: ${performance.issuesFound} issues, ${performance.executionTime}ms`)
  }
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  core.warning(`Unhandled Rejection at Promise: ${reason}`)
  core.debug(`Promise: ${promise}`)
})

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  core.error(`Uncaught Exception: ${error.message}`)
  core.debug(`Stack: ${error.stack}`)
  process.exit(1)
})

// Execute the main function
run().catch(error => {
  core.setFailed(error.message)
  process.exit(1)
})