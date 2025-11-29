import { ref, shallowRef, onMounted, onBeforeUnmount, nextTick, type Ref } from 'vue'
import { EditorState } from 'prosemirror-state'
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
  return new Schema({
    nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
    marks: basicSchema.spec.marks,
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
  // Order matters: check bold before italic to avoid conflicts

  // Bold: **text**
  rules.push(markInputRule(/\*\*([^*]+)\*\*$/, schema.marks.strong))

  // Bold: __text__
  rules.push(markInputRule(/__([^_]+)__$/, schema.marks.strong))

  // Italic: *text* (checked after bold to avoid conflicts)
  rules.push(markInputRule(/\*([^*]+)\*$/, schema.marks.em))

  // Italic: _text_
  rules.push(markInputRule(/_([^_]+)_$/, schema.marks.em))

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

  // Code block: ``` space
  rules.push(textblockTypeInputRule(/^```\s/, schema.nodes.code_block))

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
  const keys: { [key: string]: any } = {
    // History
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,

    // Text formatting
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-`': toggleMark(schema.marks.code),

    // Block formatting
    'Shift-Ctrl-1': setBlockType(schema.nodes.heading, { level: 1 }),
    'Shift-Ctrl-2': setBlockType(schema.nodes.heading, { level: 2 }),
    'Shift-Ctrl-3': setBlockType(schema.nodes.heading, { level: 3 }),
    'Shift-Ctrl-0': setBlockType(schema.nodes.paragraph),
    'Shift-Ctrl->': wrapIn(schema.nodes.blockquote),
  }

  return keys
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
  makeHeading: (level: number) => void
  makeParagraph: () => void
  makeBlockquote: () => void
  makeCodeBlock: () => void
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
