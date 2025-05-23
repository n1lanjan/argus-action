/**
 * GitHub Service
 *
 * Handles all interactions with the GitHub API including:
 * - Pull request information retrieval
 * - File change detection
 * - Comment posting and management
 * - Review submission
 */
import * as github from '@actions/github';
import { PullRequestInfo, ChangedFile, FinalReview, ReviewConfiguration } from '../types';
type Octokit = ReturnType<typeof github.getOctokit>;
export declare class GitHubService {
    private config;
    readonly octokit: Octokit;
    private readonly context;
    constructor(config: ReviewConfiguration);
    /**
     * Get pull request information from the current context
     */
    getPullRequestInfo(): Promise<PullRequestInfo>;
    /**
     * Get list of changed files in the pull request
     */
    getChangedFiles(): Promise<ChangedFile[]>;
    /**
     * Post review results to the pull request
     */
    postReview(review: FinalReview, context: {
        pullRequest: PullRequestInfo;
    }): Promise<void>;
    /**
     * Post the main review summary comment
     */
    private postMainReviewComment;
    /**
     * Post individual issue comments on specific lines
     */
    private postIssueComments;
    /**
     * Submit a blocking review if there are critical issues
     */
    private submitBlockingReview;
    /**
     * Find existing review comment from this action
     */
    private findExistingReviewComment;
    /**
     * Format the main review comment
     */
    private formatMainReviewComment;
    /**
     * Format individual issue comment
     */
    private formatIssueComment;
    /**
     * Get emoji for issue severity
     */
    private getSeverityEmoji;
    /**
     * Get repository files for context analysis
     */
    getRepositoryStructure(path?: string): Promise<unknown[]>;
    /**
     * Get file content by path
     */
    getFileContent(path: string): Promise<string | null>;
}
export {};
//# sourceMappingURL=GitHubService.d.ts.map