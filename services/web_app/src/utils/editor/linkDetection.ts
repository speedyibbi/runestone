import type { EditorView } from '@codemirror/view'

/**
 * Check if cursor is inside a markdown link URL field: [text](url)
 * Returns the link info if cursor is in URL field, null otherwise
 */
export function isInLinkUrlField(view: EditorView): {
  linkText: string
  linkStart: number
  linkEnd: number
  urlStart: number
  urlEnd: number
  urlText: string
  cursorPos: number
} | null {
  const { state } = view
  const { selection } = state
  const cursorPos = selection.main.head

  // Get the line containing the cursor
  const line = state.doc.lineAt(cursorPos)
  const lineText = line.text
  const lineStart = line.from

  // Find all markdown links in the line: [text](url)
  const linkPattern = /\[([^\]]+?)\]\(([^)]*?)\)/g
  let match

  while ((match = linkPattern.exec(lineText)) !== null) {
    const fullMatchStart = lineStart + match.index
    const linkText = match[1]
    const linkEnd = fullMatchStart + match[0].length
    const urlStart = fullMatchStart + match[0].indexOf('(') + 1 // Position after (
    const urlEnd = fullMatchStart + match[0].lastIndexOf(')') // Position before )

    // Check if cursor is in the URL field (between parentheses)
    if (cursorPos >= urlStart && cursorPos <= urlEnd) {
      // Get the current URL text
      const urlText = view.state.doc.sliceString(urlStart, urlEnd)
      return {
        linkText,
        linkStart: fullMatchStart,
        linkEnd,
        urlStart,
        urlEnd,
        urlText,
        cursorPos,
      }
    }
  }

  return null
}
