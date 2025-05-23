/**
 * JSON parsing utilities for AI agent responses
 */

import * as core from '@actions/core'

/**
 * Clean JSON string to handle common AI response formatting issues
 */
function cleanJsonString(jsonText: string): string {
  // Remove any leading/trailing whitespace
  jsonText = jsonText.trim()

  // Handle unescaped backticks and newlines in JSON string values
  // This is a more robust approach that processes JSON structure
  try {
    // First, let's try a simple escape approach for common issues
    let cleaned = jsonText

    // Replace unescaped backticks with escaped ones (simple approach)
    // We'll be conservative and only replace backticks that are clearly within string values
    cleaned = cleaned.replace(/"([^"]*)`([^"]*)"/g, (match, before, after) => {
      return `"${before}\\${'`'}${after}"`
    })

    // Handle unescaped newlines within JSON string values
    cleaned = cleaned.replace(/"([^"]*)\n([^"]*)"/g, (match, before, after) => {
      return `"${before}\\n${after}"`
    })

    return cleaned
  } catch {
    // If anything goes wrong, return the original text
    return jsonText
  }
}

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

      // Clean the JSON string to handle common AI response issues
      let jsonText = jsonMatch[jsonMatch.length - 1]
      const originalText = jsonText
      jsonText = cleanJsonString(jsonText)

      try {
        parsedResponse = JSON.parse(jsonText)
      } catch (parseError) {
        core.debug(
          `JSON parse failed for ${agentType} agent on ${filename}. Original: ${originalText.substring(0, 100)}...`
        )
        core.debug(`Cleaned: ${jsonText.substring(0, 100)}...`)
        core.debug(`Parse error: ${parseError}`)
        throw parseError
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
