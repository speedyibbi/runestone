import { EditorView } from '@codemirror/view'
import { indentMore, indentLess } from '@codemirror/commands'
import type { KeyBinding } from '@codemirror/view'

/**
 * Custom Tab handler for numbered lists that resets numbering when indenting
 */
function handleTabOnNumberedList(view: EditorView): boolean {
  const { state } = view
  const { from } = state.selection.main

  // Get the line containing the cursor
  const line = state.doc.lineAt(from)
  const lineText = line.text

  // Check if this is a numbered list item (e.g., "1. ", "2. ", "123. ")
  const numberedListMatch = lineText.match(/^(\s*)(\d+)\.\s/)

  if (numberedListMatch) {
    const [fullMatch, indent] = numberedListMatch
    const newIndent = indent + '\t'
    const newLine = lineText.replace(/^(\s*)(\d+)\.\s/, `${newIndent}1. `)

    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: newLine,
      },
      selection: {
        anchor: from + 1, // Add 1 for the extra tab character
      },
    })
    return true
  }

  // If not a numbered list, use default indent behavior
  return indentMore(view)
}

/**
 * Custom Shift+Tab handler that handles outdenting numbered lists
 * Continues numbering from the outer list level
 */
function handleShiftTabOnNumberedList(view: EditorView): boolean {
  const { state } = view
  const { from } = state.selection.main

  // Get the line containing the cursor
  const line = state.doc.lineAt(from)
  const lineText = line.text

  // Check if this is a numbered list item with indentation
  const numberedListMatch = lineText.match(/^(\s+)(\d+)\.\s/)

  if (numberedListMatch) {
    const [fullMatch, indent] = numberedListMatch

    // Remove one level of indentation
    if (indent.length > 0) {
      const newIndent = indent.slice(1) // Remove one tab/space

      // Find the last numbered item at the target indentation level
      let lastNumber = 0
      let currentLine = line.number - 1

      while (currentLine > 0) {
        const prevLine = state.doc.line(currentLine)
        const prevText = prevLine.text
        const prevMatch = prevText.match(/^(\s*)(\d+)\.\s/)

        if (prevMatch) {
          const [, prevIndent, prevNum] = prevMatch

          // Check if this line has the same indentation as our target
          if (prevIndent.length === newIndent.length) {
            lastNumber = parseInt(prevNum, 10)
            break
          }

          // If we encounter a line with less indentation, stop searching
          if (prevIndent.length < newIndent.length) {
            break
          }
        }

        currentLine--
      }

      // Continue numbering from the last item at this level
      const nextNumber = lastNumber + 1
      const newLine = lineText.replace(/^(\s+)(\d+)\.\s/, `${newIndent}${nextNumber}. `)

      view.dispatch({
        changes: {
          from: line.from,
          to: line.to,
          insert: newLine,
        },
        selection: {
          anchor: from - 1, // Subtract 1 for the removed tab character
        },
      })
      return true
    }
  }

  // If not a numbered list or no indentation, use default behavior
  return indentLess(view)
}

/**
 * Custom key bindings for enhanced markdown list handling
 * These extend CodeMirror's default behavior with smart numbered list management
 */
export const customListKeyBindings: KeyBinding[] = [
  {
    key: 'Tab',
    run: handleTabOnNumberedList,
  },
  {
    key: 'Shift-Tab',
    run: handleShiftTabOnNumberedList,
  },
]
