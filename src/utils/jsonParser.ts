/**
 * JSON parsing utilities for AI agent responses
 */

import * as core from '@actions/core'

/**
 * Robustly parse JSON from AI agent responses
 * Handles various formats including markdown code blocks and partial JSON
 */
export function parseAgentResponse(text: string, filename: string, agentType: string): any[] {
  try {
    // First try to parse the entire response as JSON
    let parsedResponse: any
    try {
      parsedResponse = JSON.parse(text)
    } catch {
      // If that fails, try to extract JSON from markdown blocks or partial content
      const jsonMatch =
        text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/\{[\s\S]*\}/) ||
        text.match(/\[[\s\S]*\]/)

      if (!jsonMatch) {
        core.debug(`No ${agentType} issues found in ${filename} - no valid JSON`)
        return []
      }

      parsedResponse = JSON.parse(jsonMatch[jsonMatch.length - 1])
    }

    // Handle both old format (array) and new format (object with issues property)
    const issues = Array.isArray(parsedResponse) ? parsedResponse : parsedResponse.issues || []

    if (!Array.isArray(issues)) {
      core.warning(`Invalid ${agentType} response format for ${filename} - expected array`)
      return []
    }

    return issues
  } catch (error) {
    core.warning(`Failed to parse ${agentType} analysis for ${filename}: ${error}`)
    return []
  }
}
