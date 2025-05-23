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

      let jsonText = jsonMatch[jsonMatch.length - 1].trim()

      // Handle truncated JSON responses (common with token limits)
      if (!jsonText.endsWith('}') && !jsonText.endsWith(']')) {
        core.warning(
          `${agentType} response appears truncated for ${filename} - attempting recovery`
        )

        // Try to close the JSON structure properly
        const openBraces = (jsonText.match(/\{/g) || []).length
        const closeBraces = (jsonText.match(/\}/g) || []).length
        const openBrackets = (jsonText.match(/\[/g) || []).length
        const closeBrackets = (jsonText.match(/\]/g) || []).length

        // Add missing closing braces/brackets
        for (let i = 0; i < openBraces - closeBraces; i++) {
          jsonText += '}'
        }
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          jsonText += ']'
        }

        // Remove trailing comma if present
        jsonText = jsonText.replace(/,(\s*[}\]])$/, '$1')
      }

      try {
        parsedResponse = JSON.parse(jsonText)
      } catch (parseError) {
        core.warning(`Failed to parse ${agentType} JSON for ${filename}: ${parseError}`)
        core.debug(`Problematic JSON: ${jsonText.substring(0, 200)}...`)
        return []
      }
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
