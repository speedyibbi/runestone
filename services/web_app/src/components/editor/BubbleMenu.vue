<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="menuRef"
      class="bubble-menu"
      :class="{ 'is-positioned': isPositioned, 'is-hiding': isHiding }"
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
          <button @click="applyList('numbered')" title="Numbered List" class="menu-btn">
            <span class="icon-text">1.</span>
          </button>
          <button @click="applyList('bullet')" title="Bullet List" class="menu-btn">
            <span class="icon-text">•</span>
          </button>
          <button @click="applyList('task')" title="Task List" class="menu-btn">
            <span class="icon-text">✓</span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <!-- Links & Media -->
        <div class="menu-section">
          <button @click="insertLink" title="Link (Cmd+K)" class="menu-btn">
            <span class="icon-text">⧉</span>
          </button>
          <button @click="insertImage" title="Image" class="menu-btn">
            <span class="icon-text">◫</span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <!-- Code & Math -->
        <div class="menu-section">
          <button @click="insertCodeBlock" title="Code Block" class="menu-btn">
            <code class="icon-code">{ }</code>
          </button>
          <button @click="insertInlineMath" title="Inline Math" class="menu-btn">
            <span class="icon-math">x</span>
          </button>
          <button @click="insertBlockMath" title="Block Math" class="menu-btn">
            <span class="icon-math">∑</span>
          </button>
        </div>

        <div class="menu-divider"></div>

        <!-- Other -->
        <div class="menu-section">
          <button @click="insertBlockquote" title="Blockquote" class="menu-btn">
            <span class="icon-text">❝</span>
          </button>
          <button @click="insertTable" title="Table" class="menu-btn">
            <span class="icon-text">⊞</span>
          </button>
          <button @click="insertHR" title="Horizontal Rule" class="menu-btn">
            <span class="icon-text">―</span>
          </button>
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
  },
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
const isPositioned = ref(false) // Track if position is calculated
const isHiding = ref(false) // Track if menu is hiding (for fade-out animation)
const position = ref({ top: 0, left: 0 })
let selectionTimeout: ReturnType<typeof setTimeout> | null = null
let hideTimeout: ReturnType<typeof setTimeout> | null = null
let cleanupFn: (() => void) | null = null
let isRightClickMenu = false
let rightClickPosition = { x: 0, y: 0 } // Store right-click position for cursor tracking

// Smart positioning that keeps menu on-screen
function calculateMenuPosition(targetX: number, targetY: number): { top: number; left: number } {
  const menu = menuRef.value
  if (!menu) {
    // Return basic position if menu not yet rendered
    return { top: targetY, left: targetX }
  }

  // Get menu dimensions
  const menuRect = menu.getBoundingClientRect()
  const menuWidth = menuRect.width || 400 // fallback width
  const menuHeight = menuRect.height || 50 // fallback height

  // Get viewport dimensions
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  // Padding from screen edges
  const padding = 16

  // Calculate ideal position (top-left of cursor with offset)
  const offsetX = 12 // offset from cursor
  const offsetY = 12 // offset from cursor
  
  let left = targetX + offsetX
  let top = targetY - menuHeight - offsetY // Position above cursor

  // Convert to viewport coordinates for checking
  const viewportLeft = left - scrollX
  const viewportTop = top - scrollY

  // Check and adjust horizontal position
  if (viewportLeft < padding) {
    // Too far left - move right
    left = scrollX + padding
  } else if (viewportLeft + menuWidth > viewportWidth - padding) {
    // Too far right - move left
    left = targetX - menuWidth - offsetX
    
    // Still too far left? Align to right edge
    if (left - scrollX < padding) {
      left = scrollX + viewportWidth - menuWidth - padding
    }
  }

  // Check and adjust vertical position
  if (viewportTop < padding) {
    // Not enough space above - try below
    top = targetY + offsetY
    
    // Still off-screen? Align to top
    if (top - scrollY < padding) {
      top = scrollY + padding
    }
  }
  
  // Check if menu goes below viewport
  const viewportBottom = top - scrollY + menuHeight
  if (viewportBottom > viewportHeight - padding) {
    // Too far down - move up
    top = scrollY + viewportHeight - menuHeight - padding
    
    // Ensure it doesn't go above viewport
    if (top - scrollY < padding) {
      top = scrollY + padding
    }
  }

  return { top, left }
}

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
  hideBubbleMenu()

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
        // Get selection position
        const centerX = (coords.left + endCoords.right) / 2
        const topY = coords.top + window.scrollY

        // Set initial position at target
        position.value = { top: topY, left: centerX }
        
        // Show menu (will be invisible until positioned)
        isVisible.value = true
        isPositioned.value = false
        isRightClickMenu = false

        // Wait for next frame to calculate final position with menu dimensions
        requestAnimationFrame(() => {
          position.value = calculateMenuPosition(centerX, topY)
          // Show menu after positioning
          requestAnimationFrame(() => {
            isPositioned.value = true
          })
        })
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

  // Store right-click position for cursor tracking
  rightClickPosition = { x: event.clientX, y: event.clientY }

  // Set initial position at mouse
  position.value = { top: event.pageY, left: event.pageX }
  
  // Show menu (will be invisible until positioned)
  isVisible.value = true
  isPositioned.value = false
  isRightClickMenu = true

  // Wait for next frame to calculate final position with menu dimensions
  requestAnimationFrame(() => {
    position.value = calculateMenuPosition(event.pageX, event.pageY)
    // Show menu after positioning
    requestAnimationFrame(() => {
      isPositioned.value = true
    })
  })
}

// Hide bubble menu with fade-out animation
function hideBubbleMenu() {
  if (selectionTimeout) {
    clearTimeout(selectionTimeout)
    selectionTimeout = null
  }
  
  // Clear any pending hide timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  
  // Start fade-out animation
  isHiding.value = true
  isPositioned.value = false
  
  // Wait for fade-out to complete before removing from DOM
  hideTimeout = setTimeout(() => {
    isRightClickMenu = false
    isVisible.value = false
    isHiding.value = false
    hideTimeout = null
  }, 150) // Match CSS transition duration
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

  // Hide menu on window resize
  const handleResize = () => {
    hideBubbleMenu()
  }

  // Hide menu on window blur (switching tabs)
  const handleWindowBlur = () => {
    hideBubbleMenu()
  }

  // Hide menu on escape key
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isVisible.value) {
      event.preventDefault()
      hideBubbleMenu()
    }
  }

  // Hide menu when user starts typing (except for shortcuts)
  const handleInput = () => {
    if (isVisible.value) {
      hideBubbleMenu()
    }
  }

  // Hide right-click menu when cursor moves away
  const handleMouseMove = (event: MouseEvent) => {
    // Only for right-click menus
    if (!isRightClickMenu || !isVisible.value) {
      return
    }

    // Don't hide if cursor is over the menu
    const target = event.target as HTMLElement
    if (target.closest('.bubble-menu')) {
      return
    }

    // Calculate distance from right-click position
    const deltaX = event.clientX - rightClickPosition.x
    const deltaY = event.clientY - rightClickPosition.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Hide if cursor moved more than 50px away
    if (distance > 50) {
      hideBubbleMenu()
    }
  }

  // Add event listeners
  view.dom.addEventListener('mouseup', checkSelection)
  view.dom.addEventListener('keyup', checkSelection)
  view.dom.addEventListener('keydown', handleKeyDown)
  view.dom.addEventListener('input', handleInput)
  view.dom.addEventListener('contextmenu', handleContextMenu)
  view.dom.addEventListener('blur', hideBubbleMenu)
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', handleResize)
  window.addEventListener('blur', handleWindowBlur)

  // Clean up function
  cleanupFn = () => {
    view.dom.removeEventListener('mouseup', checkSelection)
    view.dom.removeEventListener('keyup', checkSelection)
    view.dom.removeEventListener('keydown', handleKeyDown)
    view.dom.removeEventListener('input', handleInput)
    view.dom.removeEventListener('contextmenu', handleContextMenu)
    view.dom.removeEventListener('blur', hideBubbleMenu)
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('blur', handleWindowBlur)
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
  pointer-events: auto;
  opacity: 0;
  transform: scale(0.96);
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
  font-family: var(--font-primary);
}

.bubble-menu.is-positioned {
  opacity: 1;
  transform: scale(1);
}

.bubble-menu.is-hiding {
  opacity: 0;
  transform: scale(0.96);
  pointer-events: none;
}

.bubble-menu-content {
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 8px;
  padding: 0.25rem;
  box-shadow: 0 20px 60px var(--color-modal-shadow);
  display: flex;
  gap: 0.125rem;
  align-items: center;
  min-height: 2.25rem;
  max-width: 90vw;
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
}

/* Hide scrollbar but keep functionality */
.bubble-menu-content::-webkit-scrollbar {
  height: 0;
  width: 0;
}

.menu-section {
  display: flex;
  gap: 0.125rem;
  align-items: center;
}

.menu-divider {
  width: 1px;
  height: 1.25rem;
  background: var(--color-overlay-border);
  margin: 0 0.375rem;
  flex-shrink: 0;
}

.menu-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-foreground);
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  font-family: var(--font-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1;
  transition: background-color 0.15s ease,
              transform 0.1s ease;
  white-space: nowrap;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  outline: none;
}

.menu-btn:hover {
  background: var(--color-overlay-light);
}

.menu-btn:active {
  background: var(--color-overlay-medium);
  transform: scale(0.96);
}

.menu-btn:focus-visible {
  background: var(--color-overlay-light);
  box-shadow: 0 0 0 2px var(--color-overlay-border);
}

/* Button content styling */
.menu-btn strong {
  font-weight: 700;
  font-size: 0.875rem;
}

.menu-btn em {
  font-style: italic;
  font-weight: 600;
  font-size: 0.875rem;
}

.menu-btn s {
  text-decoration: line-through;
  font-weight: 600;
  font-size: 0.875rem;
}

/* Icon styling */
.icon-text {
  font-size: 1rem;
  line-height: 1;
  font-weight: 400;
}

.icon-code {
  font-family: var(--font-code);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
}

.icon-math {
  font-family: var(--font-primary);
  font-size: 0.95rem;
  font-weight: 500;
  font-style: italic;
}

/* Special styling for specific buttons */
.menu-btn[title*="Heading"] {
  font-family: var(--font-primary);
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Task list checkmark */
.menu-btn[title*="Task"] .icon-text {
  font-weight: 600;
  font-size: 0.95rem;
}

/* Link icon */
.menu-btn[title*="Link"] .icon-text {
  font-size: 0.9rem;
}

/* Image icon */
.menu-btn[title*="Image"] .icon-text {
  font-size: 0.95rem;
}

/* Table icon */
.menu-btn[title*="Table"] .icon-text {
  font-size: 1.05rem;
}

/* Quote icon */
.menu-btn[title*="Blockquote"] .icon-text {
  font-size: 1.1rem;
  line-height: 0.8;
}

</style>
