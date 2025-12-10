<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="menuRef"
      class="bubble-menu"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }"
    >
      <div class="bubble-menu-content">
        <!-- Text Formatting -->
        <div class="menu-section">
          <button @click="applyFormat('bold')" title="Bold (Cmd+B)" class="menu-btn">
            <strong>B</strong>
          </button>
          <button @click="applyFormat('italic')" title="Italic (Cmd+I)" class="menu-btn">
            <em>I</em>
          </button>
          <button @click="applyFormat('strikethrough')" title="Strikethrough" class="menu-btn">
            <s>S</s>
          </button>
          <button @click="applyFormat('code')" title="Inline Code (Cmd+E)" class="menu-btn">
            <code>&lt;/&gt;</code>
          </button>
        </div>

        <div class="menu-divider"></div>

        <!-- Headings -->
        <div class="menu-section">
          <button @click="applyHeading(1)" title="Heading 1" class="menu-btn">H1</button>
          <button @click="applyHeading(2)" title="Heading 2" class="menu-btn">H2</button>
          <button @click="applyHeading(3)" title="Heading 3" class="menu-btn">H3</button>
          <button @click="applyHeading(4)" title="Heading 4" class="menu-btn">H4</button>
          <button @click="applyHeading(5)" title="Heading 5" class="menu-btn">H5</button>
          <button @click="applyHeading(6)" title="Heading 6" class="menu-btn">H6</button>
        </div>

        <div class="menu-divider"></div>

        <!-- Lists -->
        <div class="menu-section">
          <button @click="applyList('numbered')" title="Numbered List" class="menu-btn">1.</button>
          <button @click="applyList('bullet')" title="Bullet List" class="menu-btn">•</button>
          <button @click="applyList('task')" title="Task List" class="menu-btn">☑</button>
        </div>

        <div class="menu-divider"></div>

        <!-- Links & Media -->
        <div class="menu-section">
          <button @click="insertLink" title="Link (Cmd+K)" class="menu-btn">🔗</button>
          <button @click="insertImage" title="Image" class="menu-btn">🖼</button>
        </div>

        <div class="menu-divider"></div>

        <!-- Code & Math -->
        <div class="menu-section">
          <button @click="insertCodeBlock" title="Code Block" class="menu-btn">{ }</button>
          <button @click="insertInlineMath" title="Inline Math" class="menu-btn">$x$</button>
          <button @click="insertBlockMath" title="Block Math" class="menu-btn">$$</button>
        </div>

        <div class="menu-divider"></div>

        <!-- Other -->
        <div class="menu-section">
          <button @click="insertBlockquote" title="Blockquote" class="menu-btn">"</button>
          <button @click="insertTable" title="Table" class="menu-btn">⊞</button>
          <button @click="insertHR" title="Horizontal Rule" class="menu-btn">―</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import {
  toggleWrap,
  setHeading,
  toggleListType,
  toggleLinePrefix,
  insertBlock,
  insertInline,
  insertAtCursor,
} from '@/utils/editor/keyboardShortcuts'

const props = defineProps<{
  editorView: EditorView | null
}>()

// Create a local ref that tracks the editor view
const editorViewRef = ref<EditorView | null>(props.editorView)

// Watch the prop and update local ref
watch(
  () => props.editorView,
  (newView) => {
    editorViewRef.value = newView
    if (newView && !cleanupFn) {
      setupBubbleMenu()
    }
  }
)

// Initialize on mount
onMounted(() => {
  if (props.editorView) {
    editorViewRef.value = props.editorView
    setupBubbleMenu()
  }
})

// ============================================================================
// EDITOR ACTIONS
// ============================================================================

// Apply text formatting
function applyFormat(type: 'bold' | 'italic' | 'strikethrough' | 'code'): void {
  const view = editorViewRef.value
  if (!view) return

  const markers = {
    bold: '**',
    italic: '*',
    strikethrough: '~~',
    code: '`',
  }
  toggleWrap(view as EditorView, markers[type])
  view.focus()
}

// Apply heading
function applyHeading(level: number): void {
  const view = editorViewRef.value
  if (!view) return

  setHeading(view as EditorView, level)
  view.focus()
}

// Apply list
function applyList(targetType: 'numbered' | 'bullet' | 'task'): void {
  const view = editorViewRef.value
  if (!view) return

  toggleListType(view as EditorView, targetType)
  view.focus()
}

// Insert link
function insertLink(): void {
  const view = editorViewRef.value
  if (!view) return

  insertInline(view as EditorView, '[', '](url)', 'link text')
  view.focus()
}

// Insert image
function insertImage(): void {
  const view = editorViewRef.value
  if (!view) return

  insertInline(view as EditorView, '![', '](url)', 'alt text')
  view.focus()
}

// Insert code block
function insertCodeBlock(): void {
  const view = editorViewRef.value
  if (!view) return

  insertBlock(view as EditorView, '```', '```', 'code')
  view.focus()
}

// Insert inline math
function insertInlineMath(): void {
  const view = editorViewRef.value
  if (!view) return

  insertInline(view as EditorView, '$', '$', 'equation')
  view.focus()
}

// Insert block math
function insertBlockMath(): void {
  const view = editorViewRef.value
  if (!view) return

  insertBlock(view as EditorView, '$$', '$$', 'equation')
  view.focus()
}

// Insert blockquote
function insertBlockquote(): void {
  const view = editorViewRef.value
  if (!view) return

  toggleLinePrefix(view as EditorView, '>')
  view.focus()
}

// Insert table
function insertTable(): void {
  const view = editorViewRef.value
  if (!view) return

  const { state } = view
  const { selection } = state
  const range = selection.main
  const line = state.doc.lineAt(range.from)
  const isAtLineStart = range.from === line.from

  const beforeNewline = isAtLineStart ? '' : '\n'
  const table = `${beforeNewline}| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: table },
    selection: EditorSelection.cursor(range.from + beforeNewline.length + 2),
  })
  view.focus()
}

// Insert horizontal rule
function insertHR(): void {
  const view = editorViewRef.value
  if (!view) return

  insertAtCursor(view as EditorView, '\n---\n')
  view.focus()
}

// ============================================================================
// MENU VISIBILITY & POSITIONING
// ============================================================================

const menuRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
const position = ref({ top: 0, left: 0 })
let selectionTimeout: ReturnType<typeof setTimeout> | null = null
let cleanupFn: (() => void) | null = null
let isRightClickMenu = false

// Handle selection changes
function handleSelectionChange() {
  // Don't interfere with right-click menu
  if (isRightClickMenu) {
    return
  }

  // Clear any existing timeout
  if (selectionTimeout) {
    clearTimeout(selectionTimeout)
    selectionTimeout = null
  }

  // Hide menu immediately when selection changes
  isVisible.value = false

  // Check if there's a valid selection
  const view = editorViewRef.value
  if (!view) return

  const selection = view.state.selection.main
  const hasSelection = !selection.empty

  if (hasSelection) {
    // Set timeout to show menu after 1 second
    selectionTimeout = setTimeout(() => {
      // Double-check selection is still valid
      const currentSelection = view.state.selection.main
      if (currentSelection.empty) {
        isVisible.value = false
        return
      }

      const coords = view.coordsAtPos(currentSelection.from)
      const endCoords = view.coordsAtPos(currentSelection.to)

      if (coords && endCoords) {
        // Position the menu at the center of the selection, accounting for scroll
        const centerX = (coords.left + endCoords.right) / 2
        const topY = coords.top + window.scrollY

        position.value = {
          top: topY,
          left: centerX,
        }
        isRightClickMenu = false
        isVisible.value = true
      }
    }, 1000)
  }
}

// Handle right-click (context menu)
function handleContextMenu(event: MouseEvent) {
  const view = editorViewRef.value
  if (!view) return

  // Prevent default browser context menu
  event.preventDefault()
  event.stopPropagation()

  // Clear any pending selection timeout
  if (selectionTimeout) {
    clearTimeout(selectionTimeout)
    selectionTimeout = null
  }

  // Position menu at mouse click location (accounting for page scroll)
  position.value = {
    top: event.pageY,
    left: event.pageX,
  }

  // Show menu immediately
  isRightClickMenu = true
  isVisible.value = true
}

// Hide bubble menu
function hideBubbleMenu() {
  if (selectionTimeout) {
    clearTimeout(selectionTimeout)
    selectionTimeout = null
  }
  isRightClickMenu = false
  isVisible.value = false
}

// Set up selection listener when editor is ready
function setupBubbleMenu() {
  const view = editorViewRef.value
  if (!view) {
    // Retry after a short delay if view isn't ready
    setTimeout(setupBubbleMenu, 100)
    return
  }

  // Listen to editor updates
  const checkSelection = () => {
    handleSelectionChange()
  }

  // Hide menu when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    // Don't hide if clicking inside the bubble menu
    const target = event.target as HTMLElement
    if (target.closest('.bubble-menu')) {
      return
    }

    // Hide menu when clicking outside
    if (!target.closest('.cm-editor')) {
      hideBubbleMenu()
    } else if (event.button !== 2) {
      // Hide on left-click inside editor (but not right-click)
      hideBubbleMenu()
    }
  }

  // Hide menu on scroll
  const handleScroll = () => {
    hideBubbleMenu()
  }

  // Add event listeners
  view.dom.addEventListener('mouseup', checkSelection)
  view.dom.addEventListener('keyup', checkSelection)
  view.dom.addEventListener('contextmenu', handleContextMenu)
  view.dom.addEventListener('blur', hideBubbleMenu)
  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
  
  // Clean up function
  cleanupFn = () => {
    view.dom.removeEventListener('mouseup', checkSelection)
    view.dom.removeEventListener('keyup', checkSelection)
    view.dom.removeEventListener('contextmenu', handleContextMenu)
    view.dom.removeEventListener('blur', hideBubbleMenu)
    document.removeEventListener('mousedown', handleClickOutside)
    window.removeEventListener('scroll', handleScroll, true)
    hideBubbleMenu()
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (cleanupFn) {
    cleanupFn()
  }
})
</script>

<style scoped>
.bubble-menu {
  position: fixed;
  z-index: 1000;
  transform: translate(-50%, -100%) translateY(-12px);
  pointer-events: auto;
  animation: bubbleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
}

.bubble-menu-content {
  background: var(--color-overlay-strong);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-overlay-border);
  border-radius: var(--size-radius-medium);
  padding: var(--size-spacing-small);
  box-shadow: 0 4px 20px var(--color-modal-shadow);
  display: flex;
  gap: 2px;
  align-items: center;
  min-height: 2rem;
  max-width: 90vw;
  overflow-x: auto;
  overflow-y: hidden;
}

.menu-section {
  display: flex;
  gap: 2px;
  align-items: center;
}

.menu-divider {
  width: 1px;
  height: 1.5rem;
  background: var(--color-overlay-border);
  margin: 0 4px;
}

.menu-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--size-radius-small);
  color: var(--color-foreground);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
}

.menu-btn:hover {
  background: var(--color-overlay-hover);
  border-color: var(--color-overlay-border);
}

.menu-btn:active {
  background: var(--color-overlay-active);
  transform: scale(0.95);
}

.menu-btn strong,
.menu-btn em,
.menu-btn s,
.menu-btn code {
  font-style: normal;
  text-decoration: none;
  font-weight: 600;
}

.menu-btn em {
  font-style: italic;
  font-weight: 500;
}

.menu-btn s {
  text-decoration: line-through;
}

.menu-btn code {
  font-family: var(--font-code);
  font-size: 0.8rem;
}

/* Arrow pointing down to selection */
.bubble-menu-content::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: var(--color-overlay-strong);
  border-right: 1px solid var(--color-overlay-border);
  border-bottom: 1px solid var(--color-overlay-border);
  transform: translateX(-50%) rotate(45deg);
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

@keyframes bubbleIn {
  0% {
    opacity: 0;
    transform: translate(-50%, -100%) translateY(-8px) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -100%) translateY(-12px) scale(1);
  }
}
</style>
