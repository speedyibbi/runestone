/**
 * Markdown Best Practices Validation
 * Based on https://www.markdownguide.org/basic-syntax/
 *
 * These validators help ensure markdown documents follow recommended best practices
 * for maximum compatibility across different markdown processors.
 */

export interface ValidationIssue {
  line: number
  column: number
  message: string
  severity: 'warning' | 'info'
  suggestion?: string
}

/**
 * Validate markdown content against best practices
 */
export function validateMarkdownBestPractices(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const lineNumber = index + 1

    // Check for heading without space after #
    const headingNoSpace = line.match(/^(#{1,6})([^\s#])/)
    if (headingNoSpace) {
      issues.push({
        line: lineNumber,
        column: headingNoSpace[1].length + 1,
        message: 'Headings should have a space after the # symbols',
        severity: 'warning',
        suggestion: `${headingNoSpace[1]} ${headingNoSpace[2]}`,
      })
    }

    // Check for heading without blank lines before/after
    if (line.match(/^#{1,6}\s/)) {
      // Check if previous line exists and is not blank
      if (index > 0 && lines[index - 1].trim() !== '') {
        issues.push({
          line: lineNumber,
          column: 1,
          message: 'Put blank lines before headings for compatibility',
          severity: 'info',
        })
      }
      // Check if next line exists and is not blank
      if (
        index < lines.length - 1 &&
        lines[index + 1].trim() !== '' &&
        !lines[index + 1].match(/^#{1,6}\s/)
      ) {
        issues.push({
          line: lineNumber,
          column: 1,
          message: 'Put blank lines after headings for compatibility',
          severity: 'info',
        })
      }
    }

    // Check for paragraph indentation (should not indent paragraphs)
    if (line.match(/^\s+[^\s\-\*\+\d>]/) && !line.match(/^```/)) {
      // Make sure it's not part of a list or blockquote
      const prevLine = index > 0 ? lines[index - 1] : ''
      if (!prevLine.match(/^[\s]*[\-\*\+\d]/) && !prevLine.match(/^>/)) {
        issues.push({
          line: lineNumber,
          column: 1,
          message: "Don't indent paragraphs with spaces or tabs",
          severity: 'warning',
          suggestion: line.trimStart(),
        })
      }
    }

    // Check for underscore emphasis in middle of word (recommend asterisks instead)
    const underscoreEmphasis = line.match(/\w__\w+__\w/)
    if (underscoreEmphasis) {
      issues.push({
        line: lineNumber,
        column: line.indexOf(underscoreEmphasis[0]),
        message: 'Use asterisks (**) instead of underscores (__) for bold in middle of word',
        severity: 'info',
        suggestion: underscoreEmphasis[0].replace(/__/g, '**'),
      })
    }

    const underscoreItalic = line.match(/\w_\w+_\w/)
    if (underscoreItalic) {
      issues.push({
        line: lineNumber,
        column: line.indexOf(underscoreItalic[0]),
        message: 'Use asterisks (*) instead of underscores (_) for italic in middle of word',
        severity: 'info',
        suggestion: underscoreItalic[0].replace(/_/g, '*'),
      })
    }

    // Check for links with spaces (recommend URL encoding)
    const linkWithSpaces = line.match(/\[([^\]]+)\]\(([^)]*\s+[^)]*)\)/)
    if (linkWithSpaces) {
      const url = linkWithSpaces[2]
      if (!url.includes('%20')) {
        issues.push({
          line: lineNumber,
          column: line.indexOf(linkWithSpaces[0]),
          message: 'URLs with spaces should be encoded with %20',
          severity: 'warning',
          suggestion: url.replace(/\s+/g, '%20'),
        })
      }
    }

    // Check for backslash line breaks (not recommended)
    if (line.endsWith('\\') && !line.match(/^\s*[\-\*\+\d]/)) {
      issues.push({
        line: lineNumber,
        column: line.length,
        message: 'Use trailing whitespace or <br> instead of backslash for line breaks',
        severity: 'info',
      })
    }

    // Check for HTML block elements without blank lines
    const htmlBlockStart = line.match(/^<(div|table|pre|p|h[1-6]|ul|ol|blockquote)/)
    if (htmlBlockStart) {
      if (index > 0 && lines[index - 1].trim() !== '') {
        issues.push({
          line: lineNumber,
          column: 1,
          message: 'Use blank lines to separate block-level HTML elements',
          severity: 'info',
        })
      }
    }

    // Check for trailing whitespace line breaks (good practice, just informative)
    if (line.match(/\s{2,}$/)) {
      issues.push({
        line: lineNumber,
        column: line.length - 1,
        message: 'Trailing whitespace detected (used for line breaks)',
        severity: 'info',
      })
    }
  })

  return issues
}

/**
 * Check if a markdown document follows basic structural best practices
 */
export function checkDocumentStructure(content: string): {
  hasTitle: boolean
  hasParagraphs: boolean
  properHeadingHierarchy: boolean
  issues: string[]
} {
  const lines = content.split('\n')
  const issues: string[] = []

  let hasH1 = false
  let hasParagraphs = false
  let previousHeadingLevel = 0

  for (const line of lines) {
    // Check for H1
    if (line.match(/^#\s/)) {
      hasH1 = true
    }

    // Check for paragraphs
    if (line.trim().length > 0 && !line.match(/^[#>\-\*\+\d\s\[\]`]/)) {
      hasParagraphs = true
    }

    // Check heading hierarchy
    const headingMatch = line.match(/^(#{1,6})\s/)
    if (headingMatch) {
      const level = headingMatch[1].length
      if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
        issues.push(`Heading hierarchy skip detected (h${previousHeadingLevel} to h${level})`)
      }
      previousHeadingLevel = level
    }
  }

  return {
    hasTitle: hasH1,
    hasParagraphs,
    properHeadingHierarchy: issues.length === 0,
    issues,
  }
}

/**
 * Format a markdown document to follow best practices automatically
 */
export function autoFormatMarkdown(content: string): string {
  const lines = content.split('\n')
  const formatted: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prevLine = i > 0 ? lines[i - 1] : ''
    const nextLine = i < lines.length - 1 ? lines[i + 1] : ''

    // Fix headings without space
    let fixedLine = line.replace(/^(#{1,6})([^\s#])/, '$1 $2')

    // Add blank line before heading if needed
    if (fixedLine.match(/^#{1,6}\s/) && prevLine.trim() !== '' && formatted.length > 0) {
      formatted.push('')
    }

    formatted.push(fixedLine)

    // Add blank line after heading if needed
    if (fixedLine.match(/^#{1,6}\s/) && nextLine.trim() !== '' && !nextLine.match(/^#{1,6}\s/)) {
      if (i < lines.length - 1) {
        formatted.push('')
        i++ // Skip adding the next line since we'll add it in next iteration
        formatted.push(lines[i])
      }
    }
  }

  return formatted.join('\n')
}
