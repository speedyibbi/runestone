import { EditorView } from '@codemirror/view'
import { indentMore, indentLess } from '@codemirror/commands'
import type { KeyBinding } from '@codemirror/view'

/**
 * Custom Enter handler for markdown lists and line breaks
 * Implements proper list continuation and markdown line break best practices
 */
function handleEnterInMarkdown(view: EditorView): boolean {
  const { state } = view
  const { from } = state.selection.main

  // Get the line containing the cursor
  const line = state.doc.lineAt(from)
  const lineText = line.text
  const cursorPosInLine = from - line.from

  // Check for numbered list (e.g., "1. ", "2. ", "123. ")
  const numberedListMatch = lineText.match(/^(\s*)(\d+)\.\s+(.*)$/)
  if (numberedListMatch) {
    const [, indent, num, content] = numberedListMatch
    
    // If cursor is at the end and content is empty, remove the list marker
    if (cursorPosInLine === lineText.length && content === '') {
      view.dispatch({
        changes: {
          from: line.from,
          to: line.to,
          insert: indent,
        },
        selection: {
          anchor: line.from + indent.length,
        },
      })
      return true
    }
    
    // Continue the numbered list with incremented number
    const nextNumber = parseInt(num, 10) + 1
    const newLine = `\n${indent}${nextNumber}. `
    
    view.dispatch({
      changes: {
        from: from,
        insert: newLine,
      },
      selection: {
        anchor: from + newLine.length,
      },
    })
    return true
  }

  // Check for unordered list (-, *, +)
  const unorderedListMatch = lineText.match(/^(\s*)([-*+])\s+(.*)$/)
  if (unorderedListMatch) {
    const [, indent, marker, content] = unorderedListMatch
    
    // If cursor is at the end and content is empty, remove the list marker
    if (cursorPosInLine === lineText.length && content === '') {
      view.dispatch({
        changes: {
          from: line.from,
          to: line.to,
          insert: indent,
        },
        selection: {
          anchor: line.from + indent.length,
        },
      })
      return true
    }
    
    // Continue the unordered list
    const newLine = `\n${indent}${marker} `
    
    view.dispatch({
      changes: {
        from: from,
        insert: newLine,
      },
      selection: {
        anchor: from + newLine.length,
      },
    })
    return true
  }

  // Check for task list (- [ ] or - [x])
  const taskListMatch = lineText.match(/^(\s*)-\s+\[([ x])\]\s+(.*)$/)
  if (taskListMatch) {
    const [, indent, , content] = taskListMatch
    
    // If cursor is at the end and content is empty, remove the list marker
    if (cursorPosInLine === lineText.length && content === '') {
      view.dispatch({
        changes: {
          from: line.from,
          to: line.to,
          insert: indent,
        },
        selection: {
          anchor: line.from + indent.length,
        },
      })
      return true
    }
    
    // Continue the task list with unchecked box
    const newLine = `\n${indent}- [ ] `
    
    view.dispatch({
      changes: {
        from: from,
        insert: newLine,
      },
      selection: {
        anchor: from + newLine.length,
      },
    })
    return true
  }

  // Check for blockquote (>)
  const blockquoteMatch = lineText.match(/^(\s*)(>+)\s*(.*)$/)
  if (blockquoteMatch) {
    const [, indent, markers, content] = blockquoteMatch
    
    // If cursor is at the end and content is empty, exit blockquote
    if (cursorPosInLine === lineText.length && content === '') {
      view.dispatch({
        changes: {
          from: from,
          insert: '\n\n',
        },
        selection: {
          anchor: from + 2,
        },
      })
      return true
    }
    
    // Continue the blockquote
    const newLine = `\n${indent}${markers} `
    
    view.dispatch({
      changes: {
        from: from,
        insert: newLine,
      },
      selection: {
        anchor: from + newLine.length,
      },
    })
    return true
  }

  // Default: Use standard Enter behavior
  return false
}

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
 * Custom key bindings for enhanced markdown editing
 * - Smart numbered list management with proper indentation
 * - Automatic list continuation (ordered, unordered, task lists)
 * - Blockquote continuation
 * - Proper line break handling per Markdown best practices
 */
export const customMarkdownKeyBindings: KeyBinding[] = [
  {
    key: 'Enter',
    run: handleEnterInMarkdown,
  },
  {
    key: 'Tab',
    run: handleTabOnNumberedList,
  },
  {
    key: 'Shift-Tab',
    run: handleShiftTabOnNumberedList,
  },
]
