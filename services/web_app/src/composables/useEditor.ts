import { ref, shallowRef, onMounted, onBeforeUnmount, nextTick, type Ref } from 'vue'
import { EditorState, Selection, TextSelection, NodeSelection, Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema, type MarkType, type NodeType } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
  InputRule,
} from 'prosemirror-inputrules'

// ============================================================================
// SCHEMA CONFIGURATION
// ============================================================================

/**
 * Create the editor schema with basic nodes and marks plus list support
 */
function createEditorSchema() {
  // Add horizontal rule node
  const nodes = addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block').addToEnd('horizontal_rule', {
    group: 'block',
    atom: true, // Makes it indivisible
    selectable: false, // Makes it non-selectable
    parseDOM: [{ tag: 'hr' }],
    toDOM() {
      return ['hr']
    },
  })

  // Add strikethrough and highlight marks
  const marks = basicSchema.spec.marks.addToEnd('strikethrough', {
    parseDOM: [
      { tag: 's' },
      { tag: 'strike' },
      { tag: 'del' },
      { style: 'text-decoration=line-through' },
    ],
    toDOM() {
      return ['s', 0]
    },
  }).addToEnd('highlight', {
    parseDOM: [
      { tag: 'mark' },
      { style: 'background-color' },
    ],
    toDOM() {
      return ['mark', 0]
    },
  })

  return new Schema({
    nodes,
    marks,
  })
}

// ============================================================================
// MARKDOWN INPUT RULES
// ============================================================================

/**
 * Helper function to create input rules for inline marks (bold, italic, code, etc.)
 * This handles the pattern matching and mark application for inline formatting.
 */
function markInputRule(regexp: RegExp, markType: MarkType, getAttrs?: any) {
  return new InputRule(regexp, (state, match, start, end) => {
    const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs
    const tr = state.tr

    if (match[1]) {
      const textStart = start + match[0].indexOf(match[1])
      const textEnd = textStart + match[1].length

      if (textEnd < end) tr.delete(textEnd, end)
      if (textStart > start) tr.delete(start, textStart)

      end = start + match[1].length
    }

    tr.addMark(start, end, markType.create(attrs))
    tr.removeStoredMark(markType)

    return tr
  })
}

/**
 * ⚙️ MARKDOWN RULES CONFIGURATION
 * 
 * Add or modify markdown input rules here. Input rules are triggered when you type
 * markdown syntax and automatically convert it to formatted text.
 * 
 * Available helper functions:
 * - markInputRule(regexp, markType): For inline formatting (bold, italic, code)
 * - textblockTypeInputRule(regexp, nodeType, attrs): For block conversions (headings, code blocks)
 * - wrappingInputRule(regexp, nodeType, attrs): For wrapping blocks (blockquotes, lists)
 * 
 * Examples of adding new rules:
 * 
 * 1. Add strikethrough: ~~text~~
 *    rules.push(markInputRule(/~~([^~]+)~~$/, schema.marks.strikethrough))
 * 
 * 2. Add heading level 4:
 *    rules.push(textblockTypeInputRule(/^####\s/, schema.nodes.heading, { level: 4 }))
 * 
 * 3. Add horizontal rule: --- or ***
 *    rules.push(new InputRule(/^(---|\*\*\*)$/, (state, match, start, end) => {
 *      return state.tr.replaceWith(start, end, schema.nodes.horizontal_rule.create())
 *    }))
 */
function buildInputRules(schema: Schema) {
  const rules: InputRule[] = []

  // ──────────────────────────────────────────────────────────────────────
  // INLINE MARKS
  // ──────────────────────────────────────────────────────────────────────
  // Order matters: check longest matches first to avoid conflicts

  // Bold + Italic: ***text*** (check this FIRST before bold/italic alone)
  rules.push(
    new InputRule(/\*\*\*([^*]+)\*\*\*$/, (state, match, start, end) => {
      const tr = state.tr
      if (match[1]) {
        const textStart = start + match[0].indexOf(match[1])
        const textEnd = textStart + match[1].length
        if (textEnd < end) tr.delete(textEnd, end)
        if (textStart > start) tr.delete(start, textStart)
        end = start + match[1].length
      }
      tr.addMark(start, end, schema.marks.strong.create())
      tr.addMark(start, end, schema.marks.em.create())
      return tr
    })
  )

  // Bold + Italic: ___text___
  rules.push(
    new InputRule(/___([^_]+)___$/, (state, match, start, end) => {
      const tr = state.tr
      if (match[1]) {
        const textStart = start + match[0].indexOf(match[1])
        const textEnd = textStart + match[1].length
        if (textEnd < end) tr.delete(textEnd, end)
        if (textStart > start) tr.delete(start, textStart)
        end = start + match[1].length
      }
      tr.addMark(start, end, schema.marks.strong.create())
      tr.addMark(start, end, schema.marks.em.create())
      return tr
    })
  )

  // Bold: **text** - Must be preceded by space, start, or non-* character
  rules.push(
    new InputRule(/(^|[^*])\*\*([^*]+)\*\*$/, (state, match, start, end) => {
      const tr = state.tr
      if (match[2]) {
        const prefix = match[1] || ''
        const textStart = start + prefix.length + 2 // prefix + **
        const textEnd = textStart + match[2].length
        if (textEnd < end) tr.delete(textEnd, end) // delete closing **
        tr.delete(textStart - 2, textStart) // delete opening **
        tr.addMark(textStart - 2, textStart - 2 + match[2].length, schema.marks.strong.create())
        tr.removeStoredMark(schema.marks.strong)
      }
      return tr
    })
  )

  // Bold: __text__ - Must be preceded by space, start, or non-_ character  
  rules.push(
    new InputRule(/(^|[^_])__([^_]+)__$/, (state, match, start, end) => {
      const tr = state.tr
      if (match[2]) {
        const prefix = match[1] || ''
        const textStart = start + prefix.length + 2
        const textEnd = textStart + match[2].length
        if (textEnd < end) tr.delete(textEnd, end)
        tr.delete(textStart - 2, textStart)
        tr.addMark(textStart - 2, textStart - 2 + match[2].length, schema.marks.strong.create())
        tr.removeStoredMark(schema.marks.strong)
      }
      return tr
    })
  )

  // Italic: *text* - Must be preceded by space, start, or non-* character
  rules.push(
    new InputRule(/(^|[^*])\*([^*]+)\*$/, (state, match, start, end) => {
      const tr = state.tr
      if (match[2]) {
        const prefix = match[1] || ''
        const textStart = start + prefix.length + 1 // prefix + *
        const textEnd = textStart + match[2].length
        if (textEnd < end) tr.delete(textEnd, end) // delete closing *
        tr.delete(textStart - 1, textStart) // delete opening *
        tr.addMark(textStart - 1, textStart - 1 + match[2].length, schema.marks.em.create())
        tr.removeStoredMark(schema.marks.em)
      }
      return tr
    })
  )

  // Italic: _text_ - Must be preceded by space, start, or non-_ character
  rules.push(
    new InputRule(/(^|[^_])_([^_]+)_$/, (state, match, start, end) => {
      const tr = state.tr
      if (match[2]) {
        const prefix = match[1] || ''
        const textStart = start + prefix.length + 1
        const textEnd = textStart + match[2].length
        if (textEnd < end) tr.delete(textEnd, end)
        tr.delete(textStart - 1, textStart)
        tr.addMark(textStart - 1, textStart - 1 + match[2].length, schema.marks.em.create())
        tr.removeStoredMark(schema.marks.em)
      }
      return tr
    })
  )

  // Strikethrough: ~~text~~
  rules.push(markInputRule(/~~([^~]+)~~$/, schema.marks.strikethrough))

  // Highlight: ==text==
  rules.push(markInputRule(/==([^=]+)==$/, schema.marks.highlight))

  // Code: `text`
  rules.push(markInputRule(/`([^`]+)`$/, schema.marks.code))

  // ──────────────────────────────────────────────────────────────────────
  // BLOCK TYPES (HEADINGS, CODE BLOCKS)
  // ──────────────────────────────────────────────────────────────────────

  // Heading 1: # space
  rules.push(textblockTypeInputRule(/^#\s/, schema.nodes.heading, { level: 1 }))

  // Heading 2: ## space
  rules.push(textblockTypeInputRule(/^##\s/, schema.nodes.heading, { level: 2 }))

  // Heading 3: ### space
  rules.push(textblockTypeInputRule(/^###\s/, schema.nodes.heading, { level: 3 }))

  // Heading 4: #### space
  rules.push(textblockTypeInputRule(/^####\s/, schema.nodes.heading, { level: 4 }))

  // Heading 5: ##### space
  rules.push(textblockTypeInputRule(/^#####\s/, schema.nodes.heading, { level: 5 }))

  // Heading 6: ###### space
  rules.push(textblockTypeInputRule(/^######\s/, schema.nodes.heading, { level: 6 }))

  // Code block: ``` space
  rules.push(textblockTypeInputRule(/^```\s/, schema.nodes.code_block))

  // Horizontal rule: --- or *** (followed by space or end of line)
  rules.push(
    new InputRule(/^(---|\*\*\*)$/, (state, match, start, end) => {
      const tr = state.tr
      const $start = tr.doc.resolve(start)
      
      // Get the position of the parent paragraph
      const paragraphStart = $start.before()
      const paragraphEnd = $start.after()
      
      // Create paragraphs above and below, plus the hr
      const paragraphAbove = schema.nodes.paragraph.create()
      const hrNode = schema.nodes.horizontal_rule.create()
      const paragraphBelow = schema.nodes.paragraph.create()
      
      // Replace the entire paragraph containing --- with paragraph + hr + paragraph
      tr.replaceWith(paragraphStart, paragraphEnd, [paragraphAbove, hrNode, paragraphBelow])
      
      // Move cursor to the paragraph below the hr
      const cursorPos = paragraphStart + paragraphAbove.nodeSize + hrNode.nodeSize + 1
      tr.setSelection(Selection.near(tr.doc.resolve(cursorPos)))
      
      return tr
    })
  )

  // ──────────────────────────────────────────────────────────────────────
  // WRAPPING BLOCKS (BLOCKQUOTES, LISTS)
  // ──────────────────────────────────────────────────────────────────────

  // Blockquote: > space
  rules.push(wrappingInputRule(/^\s*>\s/, schema.nodes.blockquote))

  // Bullet list: - space, * space, or + space
  rules.push(wrappingInputRule(/^\s*([-+*])\s/, schema.nodes.bullet_list))

  // Ordered list: 1. space (or any number)
  rules.push(wrappingInputRule(/^(\d+)\.\s/, schema.nodes.ordered_list))

  // ──────────────────────────────────────────────────────────────────────
  // TYPOGRAPHIC HELPERS (smart quotes, em dash, ellipsis)
  // ──────────────────────────────────────────────────────────────────────

  rules.push(...smartQuotes)
  rules.push(ellipsis)
  rules.push(emDash)

  // ──────────────────────────────────────────────────────────────────────
  // 🎯 ADD YOUR CUSTOM RULES HERE
  // ──────────────────────────────────────────────────────────────────────

  return inputRules({ rules })
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

/**
 * Configure keyboard shortcuts for the editor.
 * Modify this function to add or change keyboard shortcuts.
 */
function buildKeymap(schema: Schema) {
  // Helper to skip over horizontal rules when navigating
  const skipHorizontalRule = (dir: 'up' | 'down') => (state: any, dispatch: any) => {
    const { $head } = state.selection
    
    // Get the position after the current block
    const afterBlock = $head.after()
    const beforeBlock = $head.before()
    
    if (dir === 'down') {
      // Check if the next block is a horizontal rule
      if (afterBlock < state.doc.content.size) {
        const nodeAfter = state.doc.nodeAt(afterBlock)
        if (nodeAfter && nodeAfter.type.name === 'horizontal_rule') {
          // Skip to the block after the HR
          const skipTo = afterBlock + nodeAfter.nodeSize
          if (skipTo < state.doc.content.size) {
            const targetNode = state.doc.nodeAt(skipTo)
            if (targetNode) {
              const targetPos = skipTo + 1
              if (dispatch) {
                dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(targetPos))))
              }
              return true
            }
          }
        }
      }
    } else {
      // Check if the previous block is a horizontal rule  
      if (beforeBlock > 0) {
        const nodeBefore = state.doc.nodeAt(beforeBlock - 1)
        if (nodeBefore && nodeBefore.type.name === 'horizontal_rule') {
          // Skip to the block before the HR
          const skipTo = beforeBlock - nodeBefore.nodeSize - 1
          if (skipTo >= 0) {
            const targetNode = state.doc.nodeAt(skipTo)
            if (targetNode) {
              const targetPos = skipTo + targetNode.nodeSize
              if (dispatch) {
                dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(targetPos))))
              }
              return true
            }
          }
        }
      }
    }
    
    return false
  }

  const keys: { [key: string]: any } = {
    // History
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,

    // Text formatting
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-`': toggleMark(schema.marks.code),
    'Mod-Shift-x': toggleMark(schema.marks.strikethrough),
    'Mod-Shift-h': toggleMark(schema.marks.highlight),

    // Block formatting
    'Shift-Ctrl-1': setBlockType(schema.nodes.heading, { level: 1 }),
    'Shift-Ctrl-2': setBlockType(schema.nodes.heading, { level: 2 }),
    'Shift-Ctrl-3': setBlockType(schema.nodes.heading, { level: 3 }),
    'Shift-Ctrl-4': setBlockType(schema.nodes.heading, { level: 4 }),
    'Shift-Ctrl-5': setBlockType(schema.nodes.heading, { level: 5 }),
    'Shift-Ctrl-6': setBlockType(schema.nodes.heading, { level: 6 }),
    'Shift-Ctrl-0': setBlockType(schema.nodes.paragraph),
    'Shift-Ctrl->': wrapIn(schema.nodes.blockquote),

    // Navigation that skips horizontal rules
    'ArrowUp': skipHorizontalRule('up'),
    'ArrowDown': skipHorizontalRule('down'),
  }

  return keys
}

// ============================================================================
// HORIZONTAL RULE SKIP PLUGIN
// ============================================================================

/**
 * Plugin that prevents cursor from landing on or inside horizontal rules
 */
function horizontalRuleSkipPlugin(schema: Schema) {
  return new Plugin({
    appendTransaction(transactions, oldState, newState) {
      const { selection } = newState
      const { $anchor, $head } = selection
      
      // Check if the selection is a NodeSelection on an HR
      if (selection instanceof NodeSelection && selection.node.type.name === 'horizontal_rule') {
        const tr = newState.tr
        const pos = selection.from
        
        // Try to move cursor to after the HR
        const afterHR = pos + selection.node.nodeSize
        if (afterHR < newState.doc.content.size) {
          tr.setSelection(TextSelection.near(newState.doc.resolve(afterHR)))
          return tr
        }
        
        // Try to move cursor to before the HR
        if (pos > 0) {
          tr.setSelection(TextSelection.near(newState.doc.resolve(pos)))
          return tr
        }
      }
      
      // Check if cursor position is at an HR node
      const nodeAtPos = newState.doc.nodeAt($anchor.pos)
      if (nodeAtPos && nodeAtPos.type.name === 'horizontal_rule') {
        const tr = newState.tr
        const pos = $anchor.pos
        
        // Move to after the HR
        const afterHR = pos + nodeAtPos.nodeSize
        if (afterHR <= newState.doc.content.size) {
          tr.setSelection(TextSelection.near(newState.doc.resolve(afterHR)))
          return tr
        }
      }
      
      // Check if parent is HR (shouldn't happen with atom, but just in case)
      if ($anchor.parent.type.name === 'horizontal_rule') {
        const tr = newState.tr
        const afterHR = $anchor.after()
        
        if (afterHR < newState.doc.content.size) {
          tr.setSelection(TextSelection.near(newState.doc.resolve(afterHR)))
          return tr
        }
        
        const beforeHR = $anchor.before()
        if (beforeHR > 0) {
          tr.setSelection(TextSelection.near(newState.doc.resolve(beforeHR)))
          return tr
        }
      }
      
      return null
    },
    
    // Prevent clicking/selecting the HR
    props: {
      handleClick(view, pos, event) {
        const node = view.state.doc.nodeAt(pos)
        if (node && node.type.name === 'horizontal_rule') {
          // Find the position after the HR
          const afterHR = pos + node.nodeSize
          const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(afterHR)))
          view.dispatch(tr)
          return true
        }
        return false
      },
    },
  })
}

// ============================================================================
// BUBBLE MENU
// ============================================================================

interface BubbleMenuState {
  show: Ref<boolean>
  visible: Ref<boolean> // Controls opacity for fade animation
  position: Ref<{ top: number; left: number }>
  element: Ref<HTMLElement | null>
  showTimer: { current: ReturnType<typeof setTimeout> | null }
}

/**
 * Calculate the optimal position for the bubble menu
 * Prefers top-left of selection, falls back to other positions if needed
 */
function calculateBubblePosition(
  view: EditorView,
  menuElement: HTMLElement,
  from: number,
  to: number
): { top: number; left: number } {
  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  
  const menuRect = menuElement.getBoundingClientRect()
  const menuWidth = menuRect.width
  const menuHeight = menuRect.height
  const padding = 10
  const offset = 8 // Distance from selection

  // Prefer top-left of selection
  let left = start.left
  let top = start.top - menuHeight - offset

  // Check if menu fits above the selection
  if (top < padding) {
    // Not enough space above, try below
    top = end.bottom + offset
    
    // Check if it fits below
    if (top + menuHeight > window.innerHeight - padding) {
      // Not enough space below either, place it at the best vertical position
      if (start.top > window.innerHeight - end.bottom) {
        // More space above, force it there with padding
        top = padding
      } else {
        // More space below
        top = window.innerHeight - menuHeight - padding
      }
    }
  }

  // Check horizontal bounds
  if (left + menuWidth > window.innerWidth - padding) {
    // Too far right, align to the right edge of selection
    left = end.right - menuWidth
    
    // Still too far right? Clamp to screen edge
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding
    }
  }
  
  // Ensure not too far left
  if (left < padding) {
    left = padding
  }

  return { top, left }
}

/**
 * Update the bubble menu position based on the current selection
 * Shows with a 1 second delay and fades in
 */
function updateBubbleMenu(view: EditorView, bubbleMenu: BubbleMenuState) {
  const { state } = view
  const { from, to, empty } = state.selection

  // Clear any pending show timer
  if (bubbleMenu.showTimer.current) {
    clearTimeout(bubbleMenu.showTimer.current)
    bubbleMenu.showTimer.current = null
  }

  // Hide if selection is empty
  if (empty) {
    bubbleMenu.visible.value = false
    // Wait for fade out animation before actually hiding
    setTimeout(() => {
      if (!state.selection.empty) return // Selection changed, don't hide
      bubbleMenu.show.value = false
    }, 200) // Match CSS transition duration
    return
  }

  // Render menu off-screen to measure it
  bubbleMenu.position.value = { top: -9999, left: -9999 }
  bubbleMenu.show.value = true
  bubbleMenu.visible.value = false

  // Wait for next tick to ensure bubble is rendered
  nextTick(() => {
    if (!bubbleMenu.element.value) return
    if (state.selection.empty) return // Selection was cleared

    // Calculate optimal position
    const position = calculateBubblePosition(
      view,
      bubbleMenu.element.value,
      from,
      to
    )
    
    // Set position (still invisible)
    bubbleMenu.position.value = position

    // Show with delay (fade in after 1 second)
    bubbleMenu.showTimer.current = setTimeout(() => {
      // Check if selection is still active
      if (!view.state.selection.empty) {
        bubbleMenu.visible.value = true
      } else {
        bubbleMenu.show.value = false
      }
      bubbleMenu.showTimer.current = null
    }, 1000)
  })
}

/**
 * Show bubble menu immediately (for right-click)
 */
function showBubbleMenuImmediately(view: EditorView, bubbleMenu: BubbleMenuState) {
  const { state } = view
  const { from, to, empty } = state.selection

  if (empty) return

  // Clear any pending show timer
  if (bubbleMenu.showTimer.current) {
    clearTimeout(bubbleMenu.showTimer.current)
    bubbleMenu.showTimer.current = null
  }

  // Render menu off-screen to measure it
  bubbleMenu.position.value = { top: -9999, left: -9999 }
  bubbleMenu.show.value = true
  bubbleMenu.visible.value = false

  nextTick(() => {
    if (!bubbleMenu.element.value) return
    if (state.selection.empty) return

    const position = calculateBubblePosition(
      view,
      bubbleMenu.element.value,
      from,
      to
    )
    
    bubbleMenu.position.value = position
    bubbleMenu.visible.value = true
  })
}

// ============================================================================
// MAIN COMPOSABLE
// ============================================================================

export interface EditorCommands {
  toggleStrong: () => void
  toggleEm: () => void
  toggleCode: () => void
  toggleStrikethrough: () => void
  toggleHighlight: () => void
  makeHeading: (level: number) => void
  makeParagraph: () => void
  makeBlockquote: () => void
  makeCodeBlock: () => void
  insertHorizontalRule: () => void
}

export interface UseEditorReturn {
  editorElement: Ref<HTMLElement | null>
  editorView: Ref<EditorView | null>
  bubbleMenu: BubbleMenuState
  bubbleMenuElement: Ref<HTMLElement | null>
  commands: EditorCommands
}

/**
 * ProseMirror editor composable with markdown support
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useEditor } from '@/composables/useEditor'
 * 
 * const { editorElement, bubbleMenu, commands } = useEditor()
 * </script>
 * 
 * <template>
 *   <div ref="editorElement" class="editor"></div>
 *   <div v-if="bubbleMenu.show.value" ref="bubbleMenu.element.value">
 *     <!-- Bubble menu buttons -->
 *   </div>
 * </template>
 * ```
 */
export function useEditor(): UseEditorReturn {
  const schema = createEditorSchema()
  const editorElement = ref<HTMLElement | null>(null)
  const editorView = shallowRef<EditorView | null>(null)

  // Bubble menu state
  const bubbleMenu: BubbleMenuState = {
    show: ref(false),
    visible: ref(false),
    position: ref({ top: 0, left: 0 }),
    element: ref<HTMLElement | null>(null),
    showTimer: { current: null },
  }

  // ──────────────────────────────────────────────────────────────────────
  // EDITOR COMMANDS
  // ──────────────────────────────────────────────────────────────────────

  const commands: EditorCommands = {
    toggleStrong() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = toggleMark(schema.marks.strong)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    toggleEm() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = toggleMark(schema.marks.em)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    toggleCode() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = toggleMark(schema.marks.code)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    toggleStrikethrough() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = toggleMark(schema.marks.strikethrough)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    toggleHighlight() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = toggleMark(schema.marks.highlight)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    makeHeading(level: number) {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = setBlockType(schema.nodes.heading, { level })
      command(view.state, view.dispatch, view)
      view.focus()
    },

    makeParagraph() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = setBlockType(schema.nodes.paragraph)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    makeBlockquote() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = wrapIn(schema.nodes.blockquote)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    makeCodeBlock() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const command = setBlockType(schema.nodes.code_block)
      command(view.state, view.dispatch, view)
      view.focus()
    },

    insertHorizontalRule() {
      if (!editorView.value) return
      const view = editorView.value as EditorView
      const { state, dispatch } = view
      
      // Get the position at the end of the current block
      const { $from } = state.selection
      const endOfBlock = $from.after()
      
      // Create hr node and paragraphs
      const hrNode = schema.nodes.horizontal_rule.create()
      const paragraphBelow = schema.nodes.paragraph.create()
      
      // Insert hr and paragraph at the end of current block
      const transaction = state.tr.insert(endOfBlock, [hrNode, paragraphBelow])
      
      // Move cursor into the new paragraph after the hr
      const cursorPos = endOfBlock + hrNode.nodeSize + 1
      transaction.setSelection(Selection.near(transaction.doc.resolve(cursorPos)))
      
      dispatch(transaction)
      view.focus()
    },
  }

  // ──────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────

  onMounted(() => {
    if (!editorElement.value) return

    const state = EditorState.create({
      schema,
      plugins: [
        history(),
        buildInputRules(schema),
        keymap(buildKeymap(schema)),
        keymap(baseKeymap),
        horizontalRuleSkipPlugin(schema),
      ],
    })

    editorView.value = new EditorView(editorElement.value, {
      state,
      dispatchTransaction(transaction) {
        if (!editorView.value) return
        const view = editorView.value as EditorView
        const newState = view.state.apply(transaction)
        view.updateState(newState)

        // Update bubble menu on selection change
        if (transaction.selectionSet) {
          updateBubbleMenu(view, bubbleMenu)
        }
      },
    })

    // Handle right-click to show bubble menu
    const handleContextMenu = (event: MouseEvent) => {
      if (!editorView.value) return
      
      // Check if there's a selection
      const { empty } = editorView.value.state.selection
      
      if (!empty) {
        // Prevent browser context menu
        event.preventDefault()
        // Show bubble menu immediately (no delay for right-click)
        showBubbleMenuImmediately(editorView.value, bubbleMenu)
      }
    }

    editorElement.value.addEventListener('contextmenu', handleContextMenu)

    // Store cleanup function
    ;(editorElement.value as any).__contextMenuCleanup = () => {
      editorElement.value?.removeEventListener('contextmenu', handleContextMenu)
    }
  })

  onBeforeUnmount(() => {
    // Clear any pending show timer
    if (bubbleMenu.showTimer.current) {
      clearTimeout(bubbleMenu.showTimer.current)
      bubbleMenu.showTimer.current = null
    }

    // Clean up context menu listener
    if (editorElement.value && (editorElement.value as any).__contextMenuCleanup) {
      ;(editorElement.value as any).__contextMenuCleanup()
    }

    if (editorView.value) {
      editorView.value.destroy()
    }
  })

  return {
    editorElement,
    editorView,
    bubbleMenu,
    bubbleMenuElement: bubbleMenu.element,
    commands,
  }
}
