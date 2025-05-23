/**
 * File extension utilities for language detection
 */

/**
 * Get the file extension and map it to a language name
 */
export function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    tsx: 'typescript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    cs: 'csharp',
    rb: 'ruby',
    go: 'go',
    php: 'php',
    cpp: 'cpp',
    c: 'c',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    dart: 'dart',
    vue: 'vue',
    svelte: 'svelte',
  }
  return langMap[ext || ''] || ext || 'text'
}
