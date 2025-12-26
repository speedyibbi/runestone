import { EditorView } from '@codemirror/view'
import { EditorSelection, type ChangeSpec } from '@codemirror/state'
import { keymap } from '@codemirror/view'

/**
 * Keyboard shortcuts for markdown editor features
 */

// Helper to check if text is surrounded by markers (in selection or around it)
export function isSurrounded(
  text: string,
  marker: string,
  beforeText: string,
  afterText: string,
): boolean {
  // Check if selected text includes markers
  if (text.startsWith(marker) && text.endsWith(marker) && text.length > marker.length * 2) {
    return true
  }
  // Check if markers are immediately before and after selection
  if (beforeText.endsWith(marker) && afterText.startsWith(marker)) {
    return true
  }
  return false
}

// Helper to toggle wrapping markers around selection
export function toggleWrap(view: EditorView, marker: string): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []
  const markerLen = marker.length

  for (const range of selection.ranges) {
    const selectedText = state.doc.sliceString(range.from, range.to)

    // Get text before and after selection to check for markers
    const beforeText = state.doc.sliceString(Math.max(0, range.from - markerLen), range.from)
    const afterText = state.doc.sliceString(
      range.to,
      Math.min(state.doc.length, range.to + markerLen),
    )

    const hasSurroundingMarkers = isSurrounded(selectedText, marker, beforeText, afterText)

    if (hasSurroundingMarkers) {
      // Check where the markers are
      if (selectedText.startsWith(marker) && selectedText.endsWith(marker)) {
        // Markers are in the selection - remove them
        const newText = selectedText.slice(markerLen, -markerLen)
        changes.push({
          from: range.from,
          to: range.to,
          insert: newText,
        })
      } else if (beforeText.endsWith(marker) && afterText.startsWith(marker)) {
        // Markers are outside the selection - remove them by expanding the range
        const newText = selectedText
        changes.push({
          from: range.from - markerLen,
          to: range.to + markerLen,
          insert: newText,
        })
      }
    } else {
      // Add markers
      const newText = `${marker}${selectedText}${marker}`
      changes.push({
        from: range.from,
        to: range.to,
        insert: newText,
      })
    }
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(
      selection.ranges.map((range, i) => {
        const change = changes[i]
        const selectedText = state.doc.sliceString(range.from, range.to)
        const beforeText = state.doc.sliceString(Math.max(0, range.from - markerLen), range.from)
        const afterText = state.doc.sliceString(
          range.to,
          Math.min(state.doc.length, range.to + markerLen),
        )
        const isRemoving = isSurrounded(selectedText, marker, beforeText, afterText)

        if (isRemoving) {
          // When removing, selection stays in place (but the text is shorter)
          if (beforeText.endsWith(marker) && afterText.startsWith(marker)) {
            // Markers were outside - adjust for removed markers
            return EditorSelection.range(range.from - markerLen, range.to - markerLen)
          } else {
            // Markers were inside - selection shrinks
            return EditorSelection.range(range.from, range.to - markerLen * 2)
          }
        } else {
          // When adding, adjust selection to be inside new markers
          return EditorSelection.range(range.from + markerLen, range.to + markerLen)
        }
      }),
    ),
  })

  return true
}

// Helper to toggle line prefix (for headings, blockquotes)
export function toggleLinePrefix(view: EditorView, prefix: string, removeOnly = false): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []

  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from)
    const lineText = line.text
    const trimmedText = lineText.trimStart()
    const leadingSpace = lineText.length - trimmedText.length

    // Check if line starts with the prefix
    const hasPrefix = trimmedText.startsWith(prefix)

    if (hasPrefix) {
      // Remove prefix
      const newText = trimmedText.slice(prefix.length).trimStart()
      changes.push({
        from: line.from,
        to: line.to,
        insert: ' '.repeat(leadingSpace) + newText,
      })
    } else if (!removeOnly) {
      // Add prefix
      const newText = prefix + ' ' + trimmedText
      changes.push({
        from: line.from,
        to: line.to,
        insert: ' '.repeat(leadingSpace) + newText,
      })
    }
  }

  view.dispatch({ changes })
  return true
}

// Helper to detect current list type
export function getListType(text: string): 'numbered' | 'bullet' | 'task' | null {
  const trimmed = text.trimStart()
  if (/^\d+\.\s/.test(trimmed)) return 'numbered'
  if (/^[-*+]\s\[[ xX]\]\s/.test(trimmed)) return 'task'
  if (/^[-*+]\s/.test(trimmed)) return 'bullet'
  return null
}

// Helper to get leading whitespace (preserves tabs and spaces)
export function getLeadingWhitespace(text: string): string {
  const match = text.match(/^[\t ]*/)
  return match ? match[0] : ''
}

// Helper to remove any list prefix
export function removeListPrefix(text: string): string {
  const leadingWhitespace = getLeadingWhitespace(text)
  const trimmed = text.trimStart()

  // Remove numbered list (1. 2. etc)
  let content = trimmed.replace(/^\d+\.\s+/, '')
  // Remove task list (- [ ] or - [x])
  content = content.replace(/^[-*+]\s\[[ xX]\]\s+/, '')
  // Remove bullet list (- * +)
  content = content.replace(/^[-*+]\s+/, '')

  return leadingWhitespace + content
}

// Helper to toggle list type (smart conversion between list types)
export function toggleListType(
  view: EditorView,
  targetType: 'numbered' | 'bullet' | 'task',
): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []

  // Get all lines in selection
  const lines: { line: any; from: number; to: number }[] = []
  for (const range of selection.ranges) {
    const startLine = state.doc.lineAt(range.from)
    const endLine = state.doc.lineAt(range.to)

    for (let pos = startLine.from; pos <= endLine.from; ) {
      const line = state.doc.lineAt(pos)
      lines.push({ line, from: line.from, to: line.to })
      pos = line.to + 1
    }
  }

  // Check if all lines are already the target type
  const allTargetType = lines.every(({ line }) => getListType(line.text) === targetType)

  for (const { line, from, to } of lines) {
    const lineText = line.text
    const currentType = getListType(lineText)

    if (allTargetType) {
      // If all lines are already target type, remove list formatting
      const newText = removeListPrefix(lineText)
      changes.push({ from, to, insert: newText })
    } else if (currentType === targetType) {
      // This line is already the target type, keep it
      continue
    } else {
      // Convert to target type
      const leadingWhitespace = getLeadingWhitespace(lineText)
      const content = removeListPrefix(lineText)
      const trimmed = content.trimStart()

      let newPrefix: string
      if (targetType === 'numbered') {
        // For numbered lists, use sequential numbers
        const lineIndex = lines.findIndex((l) => l.from === from)
        newPrefix = `${lineIndex + 1}.`
      } else if (targetType === 'bullet') {
        newPrefix = '-'
      } else {
        // task
        newPrefix = '- [ ]'
      }

      const newText = leadingWhitespace + newPrefix + ' ' + trimmed
      changes.push({ from, to, insert: newText })
    }
  }

  view.dispatch({ changes })
  return true
}

// Helper to set heading level
export function setHeading(view: EditorView, level: number): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []

  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from)
    const lineText = line.text
    const trimmedText = lineText.trimStart()
    const leadingSpace = lineText.length - trimmedText.length

    // Remove existing heading markers
    const headingMatch = trimmedText.match(/^#{1,6}\s+/)
    const textWithoutHeading = headingMatch
      ? trimmedText.slice(headingMatch[0].length)
      : trimmedText

    // Add new heading markers
    const newText = '#'.repeat(level) + ' ' + textWithoutHeading

    changes.push({
      from: line.from,
      to: line.to,
      insert: ' '.repeat(leadingSpace) + newText,
    })
  }

  view.dispatch({ changes })
  return true
}

// Helper to insert block (code block, math block, etc.)
export function insertBlock(
  view: EditorView,
  startMarker: string,
  endMarker: string,
  placeholder = '',
): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []
  const newSelections: ReturnType<typeof EditorSelection.range>[] = []

  for (const range of selection.ranges) {
    const line = state.doc.lineAt(range.from)
    const isAtLineStart = range.from === line.from
    const selectedText = state.doc.sliceString(range.from, range.to)

    // Insert block with proper line breaks
    const beforeNewline = isAtLineStart ? '' : '\n'
    const content = selectedText || placeholder
    const insert = `${beforeNewline}${startMarker}\n${content}\n${endMarker}\n`

    changes.push({
      from: range.from,
      to: range.to,
      insert,
    })

    // Place cursor inside the block
    const newPos = range.from + beforeNewline.length + startMarker.length + 1
    newSelections.push(EditorSelection.range(newPos, newPos + content.length))
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(newSelections),
  })

  return true
}

// Helper to insert inline element
export function insertInline(
  view: EditorView,
  before: string,
  after: string,
  placeholder = '',
): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []
  const newSelections: ReturnType<typeof EditorSelection.range>[] = []

  for (const range of selection.ranges) {
    const selectedText = state.doc.sliceString(range.from, range.to)
    const content = selectedText || placeholder
    const insert = `${before}${content}${after}`

    changes.push({
      from: range.from,
      to: range.to,
      insert,
    })

    // Select the placeholder or keep selection
    const newStart = range.from + before.length
    newSelections.push(EditorSelection.range(newStart, newStart + content.length))
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(newSelections),
  })

  return true
}

// Helper to toggle link (smart detection and removal)
export function toggleLink(view: EditorView): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []
  const newSelections: ReturnType<typeof EditorSelection.range>[] = []

  for (const range of selection.ranges) {
    const selectedText = state.doc.sliceString(range.from, range.to)

    // Check if selection is already a link: [text](url)
    const linkMatch = selectedText.match(/^\[(.+?)\]\((.+?)\)$/)

    if (linkMatch) {
      // Remove link, keep just the text
      const linkText = linkMatch[1]
      changes.push({
        from: range.from,
        to: range.to,
        insert: linkText,
      })
      newSelections.push(EditorSelection.range(range.from, range.from + linkText.length))
    } else {
      // Check if there's a link around the selection
      const beforeText = state.doc.sliceString(Math.max(0, range.from - 1), range.from)
      const afterText = state.doc.sliceString(range.to, Math.min(state.doc.length, range.to + 6))

      if (beforeText === '[' && afterText.startsWith('](')) {
        // Selection is inside a link, find the full link and remove it
        const textBeforeSelection = state.doc.sliceString(Math.max(0, range.from - 100), range.from)
        const textAfterSelection = state.doc.sliceString(
          range.to,
          Math.min(state.doc.length, range.to + 100),
        )

        const linkStart = textBeforeSelection.lastIndexOf('[')
        const linkEnd = textAfterSelection.indexOf(')')

        if (linkStart !== -1 && linkEnd !== -1) {
          const fullFrom = range.from - (textBeforeSelection.length - linkStart)
          const fullTo = range.to + linkEnd + 1
          const fullLink = state.doc.sliceString(fullFrom, fullTo)
          const linkTextMatch = fullLink.match(/^\[(.+?)\]\(.+?\)$/)

          if (linkTextMatch) {
            const linkText = linkTextMatch[1]
            changes.push({
              from: fullFrom,
              to: fullTo,
              insert: linkText,
            })
            newSelections.push(EditorSelection.range(fullFrom, fullFrom + linkText.length))
            continue
          }
        }
      }

      // Add link
      const content = selectedText || 'link text'
      const insert = `[${content}](url)`
      changes.push({
        from: range.from,
        to: range.to,
        insert,
      })
      // Select 'url' for easy replacement
      const urlStart = range.from + content.length + 3 // [text](
      newSelections.push(EditorSelection.range(urlStart, urlStart + 3))
    }
  }

  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: EditorSelection.create(newSelections),
    })
  }

  return true
}

// Helper to toggle code block (smart detection and removal)
export function toggleCodeBlock(view: EditorView): boolean {
  const { state } = view
  const { selection } = state
  const range = selection.main

  // Get surrounding lines to check for code block
  const line = state.doc.lineAt(range.from)
  const startLine = state.doc.lineAt(Math.max(0, line.from - 1))
  const endLine = state.doc.lineAt(Math.min(state.doc.length, range.to + 1))

  // Check if cursor is inside a code block
  let codeBlockStart = -1
  let codeBlockEnd = -1

  // Search backwards for opening ```
  for (let pos = range.from; pos >= 0; ) {
    const checkLine = state.doc.lineAt(pos)
    if (checkLine.text.trimStart().startsWith('```')) {
      codeBlockStart = checkLine.from
      break
    }
    pos = checkLine.from - 1
    if (pos < 0) break
  }

  // If found opening, search forwards for closing ```
  if (codeBlockStart !== -1) {
    for (let pos = range.from; pos < state.doc.length; ) {
      const checkLine = state.doc.lineAt(pos)
      if (pos > codeBlockStart && checkLine.text.trimStart().startsWith('```')) {
        codeBlockEnd = checkLine.to
        break
      }
      pos = checkLine.to + 1
    }
  }

  if (codeBlockStart !== -1 && codeBlockEnd !== -1) {
    // Remove code block
    const openLine = state.doc.lineAt(codeBlockStart)
    const closeLine = state.doc.lineAt(codeBlockEnd)
    const content = state.doc.sliceString(openLine.to + 1, closeLine.from)

    view.dispatch({
      changes: {
        from: codeBlockStart,
        to: codeBlockEnd + 1,
        insert: content.trimEnd() + '\n',
      },
      selection: EditorSelection.cursor(codeBlockStart),
    })
  } else {
    // Add code block
    const selectedText = state.doc.sliceString(range.from, range.to)
    const isAtLineStart = range.from === line.from
    const beforeNewline = isAtLineStart ? '' : '\n'
    const content = selectedText || 'code'
    const insert = `${beforeNewline}\`\`\`\n${content}\n\`\`\`\n`

    view.dispatch({
      changes: {
        from: range.from,
        to: range.to,
        insert,
      },
      selection: EditorSelection.range(
        range.from + beforeNewline.length + 4,
        range.from + beforeNewline.length + 4 + content.length,
      ),
    })
  }

  return true
}

// Helper to insert at cursor
export function insertAtCursor(view: EditorView, text: string): boolean {
  const { state } = view
  const { selection } = state

  view.dispatch({
    changes: selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
      insert: text,
    })),
    selection: EditorSelection.create(
      selection.ranges.map((range) => {
        const newPos = range.from + text.length
        return EditorSelection.cursor(newPos)
      }),
    ),
  })

  return true
}

// Keyboard shortcut handlers
const shortcuts = {
  // Text formatting
  'Mod-b': (view: EditorView) => toggleWrap(view, '**'), // Bold
  'Mod-i': (view: EditorView) => toggleWrap(view, '*'), // Italic
  'Mod-Shift-x': (view: EditorView) => toggleWrap(view, '~~'), // Strikethrough
  'Mod-e': (view: EditorView) => toggleWrap(view, '`'), // Inline code

  // Headings (Mod-Alt-1 through Mod-Alt-6)
  'Mod-Alt-1': (view: EditorView) => setHeading(view, 1),
  'Mod-Alt-2': (view: EditorView) => setHeading(view, 2),
  'Mod-Alt-3': (view: EditorView) => setHeading(view, 3),
  'Mod-Alt-4': (view: EditorView) => setHeading(view, 4),
  'Mod-Alt-5': (view: EditorView) => setHeading(view, 5),
  'Mod-Alt-6': (view: EditorView) => setHeading(view, 6),

  // Lists
  'Mod-Shift-7': (view: EditorView) => toggleListType(view, 'numbered'), // Numbered list
  'Mod-Shift-8': (view: EditorView) => toggleListType(view, 'bullet'), // Bullet list
  'Mod-Shift-9': (view: EditorView) => toggleListType(view, 'task'), // Task list

  // Blockquote
  'Mod-Shift-q': (view: EditorView) => toggleLinePrefix(view, '>'), // Blockquote

  // Links and images
  'Mod-k': (view: EditorView) => toggleLink(view),
  'Mod-Shift-k': (view: EditorView) => insertInline(view, '![', '](url)', 'alt text'),

  // Code blocks
  'Mod-Shift-e': (view: EditorView) => toggleCodeBlock(view),

  // Math equations
  'Mod-m': (view: EditorView) => toggleWrap(view, '$'), // Inline math
  'Mod-Shift-m': (view: EditorView) => insertBlock(view, '$$', '$$', 'equation'), // Block math

  // Horizontal rule
  'Mod-Shift-h': (view: EditorView) => insertAtCursor(view, '\n---\n'),

  // Save (Cmd/Ctrl+S) - prevent browser default
  'Mod-s': (view: EditorView) => {
    // Dispatch custom event for save
    // The view component will listen for this and handle the actual save
    const event = new CustomEvent('editor-save', { bubbles: true })
    view.dom.dispatchEvent(event)
    return true
  },
}

/**
 * Create the keyboard shortcuts extension for the editor
 */
export function createKeyboardShortcuts() {
  return keymap.of(
    Object.entries(shortcuts).map(([key, handler]) => ({
      key,
      run: handler,
      preventDefault: true,
    })),
  )
}

/**
 * Get a human-readable description of all shortcuts
 */
export function getShortcutDescriptions() {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
  const mod = isMac ? '⌘' : 'Ctrl'
  const alt = isMac ? '⌥' : 'Alt'
  const shift = isMac ? '⇧' : 'Shift'

  return {
    'Text Formatting': [
      { keys: `${mod}+B`, description: 'Toggle bold' },
      { keys: `${mod}+I`, description: 'Toggle italic' },
      { keys: `${mod}+${shift}+X`, description: 'Toggle strikethrough' },
      { keys: `${mod}+E`, description: 'Toggle inline code' },
      { keys: `${mod}+${shift}+E`, description: 'Insert code block' },
    ],
    Headings: [
      { keys: `${mod}+${alt}+1`, description: 'Heading 1' },
      { keys: `${mod}+${alt}+2`, description: 'Heading 2' },
      { keys: `${mod}+${alt}+3`, description: 'Heading 3' },
      { keys: `${mod}+${alt}+4`, description: 'Heading 4' },
      { keys: `${mod}+${alt}+5`, description: 'Heading 5' },
      { keys: `${mod}+${alt}+6`, description: 'Heading 6' },
    ],
    Lists: [
      { keys: `${mod}+${shift}+7`, description: 'Toggle numbered list' },
      { keys: `${mod}+${shift}+8`, description: 'Toggle bullet list' },
      { keys: `${mod}+${shift}+9`, description: 'Toggle task list' },
    ],
    Blocks: [
      { keys: `${mod}+${shift}+Q`, description: 'Toggle blockquote' },
      { keys: `${mod}+${shift}+H`, description: 'Insert horizontal rule' },
    ],
    'Links & Images': [
      { keys: `${mod}+K`, description: 'Insert link' },
      { keys: `${mod}+${shift}+K`, description: 'Insert image' },
    ],
    Math: [
      { keys: `${mod}+M`, description: 'Toggle inline math' },
      { keys: `${mod}+${shift}+M`, description: 'Insert block math' },
    ],
  }
}
