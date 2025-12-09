import { EditorView } from '@codemirror/view'
import { EditorSelection, type ChangeSpec } from '@codemirror/state'
import { keymap } from '@codemirror/view'

/**
 * Keyboard shortcuts for markdown editor features
 */

// Helper to check if text is surrounded by markers
function isSurrounded(text: string, marker: string): boolean {
  return text.startsWith(marker) && text.endsWith(marker)
}

// Helper to toggle wrapping markers around selection
function toggleWrap(view: EditorView, marker: string): boolean {
  const { state } = view
  const { selection } = state
  const changes: ChangeSpec[] = []

  for (const range of selection.ranges) {
    const selectedText = state.doc.sliceString(range.from, range.to)

    if (isSurrounded(selectedText, marker)) {
      // Remove markers
      const newText = selectedText.slice(marker.length, -marker.length)
      changes.push({
        from: range.from,
        to: range.to,
        insert: newText,
      })
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
        const isRemoving = isSurrounded(selectedText, marker)
        const offset = isRemoving ? -marker.length : marker.length

        return EditorSelection.range(
          range.from + (isRemoving ? 0 : marker.length),
          range.to + offset
        )
      })
    ),
  })

  return true
}

// Helper to toggle line prefix (for headings, lists, blockquotes)
function toggleLinePrefix(view: EditorView, prefix: string, removeOnly = false): boolean {
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

// Helper to set heading level
function setHeading(view: EditorView, level: number): boolean {
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
function insertBlock(view: EditorView, startMarker: string, endMarker: string, placeholder = ''): boolean {
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
    newSelections.push(
      EditorSelection.range(newPos, newPos + content.length)
    )
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(newSelections),
  })

  return true
}

// Helper to insert inline element
function insertInline(view: EditorView, before: string, after: string, placeholder = ''): boolean {
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
    newSelections.push(
      EditorSelection.range(newStart, newStart + content.length)
    )
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(newSelections),
  })

  return true
}

// Helper to insert at cursor
function insertAtCursor(view: EditorView, text: string): boolean {
  const { state } = view
  const { selection } = state

  view.dispatch({
    changes: selection.ranges.map(range => ({
      from: range.from,
      to: range.to,
      insert: text,
    })),
    selection: EditorSelection.create(
      selection.ranges.map(range => {
        const newPos = range.from + text.length
        return EditorSelection.cursor(newPos)
      })
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
  'Mod-Shift-7': (view: EditorView) => toggleLinePrefix(view, '1.'), // Numbered list
  'Mod-Shift-8': (view: EditorView) => toggleLinePrefix(view, '-'), // Bullet list
  'Mod-Shift-9': (view: EditorView) => toggleLinePrefix(view, '- [ ]'), // Task list

  // Blockquote
  'Mod-Shift-q': (view: EditorView) => toggleLinePrefix(view, '>'), // Blockquote

  // Links and images
  'Mod-k': (view: EditorView) => insertInline(view, '[', '](url)', 'link text'),
  'Mod-Shift-k': (view: EditorView) => insertInline(view, '![', '](url)', 'alt text'),

  // Code blocks
  'Mod-Shift-e': (view: EditorView) => insertBlock(view, '```', '```', 'code'),

  // Math equations
  'Mod-m': (view: EditorView) => toggleWrap(view, '$'), // Inline math
  'Mod-Shift-m': (view: EditorView) => insertBlock(view, '$$', '$$', 'equation'), // Block math

  // Horizontal rule
  'Mod-Shift-h': (view: EditorView) => insertAtCursor(view, '\n---\n'),
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
    }))
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
    'Headings': [
      { keys: `${mod}+${alt}+1`, description: 'Heading 1' },
      { keys: `${mod}+${alt}+2`, description: 'Heading 2' },
      { keys: `${mod}+${alt}+3`, description: 'Heading 3' },
      { keys: `${mod}+${alt}+4`, description: 'Heading 4' },
      { keys: `${mod}+${alt}+5`, description: 'Heading 5' },
      { keys: `${mod}+${alt}+6`, description: 'Heading 6' },
    ],
    'Lists': [
      { keys: `${mod}+${shift}+7`, description: 'Toggle numbered list' },
      { keys: `${mod}+${shift}+8`, description: 'Toggle bullet list' },
      { keys: `${mod}+${shift}+9`, description: 'Toggle task list' },
    ],
    'Blocks': [
      { keys: `${mod}+${shift}+Q`, description: 'Toggle blockquote' },
      { keys: `${mod}+${shift}+H`, description: 'Insert horizontal rule' },
    ],
    'Links & Images': [
      { keys: `${mod}+K`, description: 'Insert link' },
      { keys: `${mod}+${shift}+K`, description: 'Insert image' },
    ],
    'Math': [
      { keys: `${mod}+M`, description: 'Toggle inline math' },
      { keys: `${mod}+${shift}+M`, description: 'Insert block math' },
    ],
  }
}
