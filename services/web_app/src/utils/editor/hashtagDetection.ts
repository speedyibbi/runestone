import type { EditorView } from '@codemirror/view'

/**
 * Check if cursor is inside a hashtag: #tag
 * Returns the hashtag info if cursor is in hashtag, null otherwise
 */
export function isInHashtag(view: EditorView): {
  hashStart: number
  tagStart: number
  tagEnd: number
  tagText: string
  cursorPos: number
} | null {
  const { state } = view
  const { selection } = state
  const cursorPos = selection.main.head

  // Get the line containing the cursor
  const line = state.doc.lineAt(cursorPos)
  const lineText = line.text
  const lineStart = line.from

  // Find hashtags: #tag (word characters and hyphens)
  // Pattern matches at start of line or after whitespace
  const hashtagRegex = /(?:^|\s)(#)([\w-]+)/g
  let hashtagMatch

  while ((hashtagMatch = hashtagRegex.exec(lineText)) !== null) {
    const fullMatchStart = lineStart + hashtagMatch.index
    const hashStart = fullMatchStart + hashtagMatch[0].indexOf('#')
    const tagStart = hashStart + 1 // After the #
    const tagEnd = fullMatchStart + hashtagMatch[0].length
    const tagText = hashtagMatch[2]

    // Check if cursor is within the hashtag (including the #)
    if (cursorPos >= hashStart && cursorPos <= tagEnd) {
      return {
        hashStart,
        tagStart,
        tagEnd,
        tagText,
        cursorPos,
      }
    }
  }

  return null
}
