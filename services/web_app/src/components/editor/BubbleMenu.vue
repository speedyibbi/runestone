<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import type { EditorView } from '@codemirror/view'
import { EditorSelection, type ChangeSpec } from '@codemirror/state'
import { previewModeField } from '@/utils/editor/livePreview'
import {
  toggleWrap,
  setHeading,
  toggleListType,
  toggleLinePrefix,
  insertBlock,
  insertInline,
  insertAtCursor,
} from '@/utils/editor/keyboardShortcuts'
import { isInLinkUrlField } from '@/utils/editor/linkDetection'
import type { RuneInfo } from '@/composables/useCodex'
import RuneLinkSelector from '@/components/editor/RuneLinkSelector.vue'

const props = defineProps<{
  editorView: EditorView | null
  runes?: RuneInfo[]
  isDirectory?: (title: string) => boolean
}>()

// Create a local ref that tracks the editor view
const editorViewRef = ref<EditorView | null>(props.editorView)

// Check if editor is in preview mode
function isInPreviewMode(): boolean {
  const view = editorViewRef.value
  if (!view) return false
  try {
    return view.state.field(previewModeField) || false
  } catch {
    return false
  }
}

// Watch the prop and update local ref
watch(
  () => props.editorView,
  (newView, oldView) => {
    // Clean up old listeners if editor view changed
    if (oldView && cleanupFn) {
      cleanupFn()
      cleanupFn = null
    }

    editorViewRef.value = newView
    if (newView) {
      setupBubbleMenu()
      // Don't check immediately on setup - wait for user interaction
    }
  },
)

// Note: Preview mode is checked directly in event handlers since
// CodeMirror state fields aren't reactive in Vue's reactivity system

// Initialize on mount
onMounted(() => {
  if (props.editorView && !cleanupFn) {
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

// Rune link selector state
const showRuneLinkSelector = ref(false)
const runeLinkSelectorPosition = ref({ top: 0, left: 0 })
const runeLinkSelectorSearchQuery = ref('')
let typingTimeout: ReturnType<typeof setTimeout> | null = null
const isHoveringDropdown = ref(false)
let lastLinkStart = -1 // Track link start position to avoid unnecessary position updates

// Calculate position for rune link selector - smart positioning like bubble menu
function calculateRuneLinkSelectorPosition(): { top: number; left: number } {
  const view = editorViewRef.value
  if (!view) return { top: 0, left: 0 }

  const linkInfo = isInLinkUrlField(view as EditorView)
  if (!linkInfo) return { top: 0, left: 0 }

  // Get coordinates for the link text (prioritize showing under the link text)
  // Use the start of the link bracket '[' as a stable anchor point
  const linkBracketStart = linkInfo.linkStart // Position of '['
  const linkTextStart = linkInfo.linkStart + 1 // Position after '['
  const linkTextEnd = linkInfo.linkStart + 1 + linkInfo.linkText.length // Position before ']'
  
  // Get coordinates - use bracket start as primary anchor for stability
  const bracketCoords = view.coordsAtPos(linkBracketStart)
  const linkTextStartCoords = view.coordsAtPos(linkTextStart)
  const linkTextEndCoords = view.coordsAtPos(linkTextEnd)
  
  // Get cursor coordinates as fallback
  const cursorCoords = view.coordsAtPos(linkInfo.cursorPos)
  
  // Prefer using bracket or link text coordinates for stability
  if (bracketCoords && linkTextEndCoords) {
    // Use bracket start for horizontal position (more stable)
    // Use link text end for vertical position (shows below the link text)
    const centerX = bracketCoords.left + (linkTextEndCoords.right - bracketCoords.left) / 2
    const linkTextBottom = linkTextEndCoords.bottom + window.scrollY

    return {
      top: linkTextBottom + 4,
      left: centerX + window.scrollX,
    }
  } else if (linkTextStartCoords && linkTextEndCoords) {
    // Fallback to link text coordinates
    const centerX = (linkTextStartCoords.left + linkTextEndCoords.right) / 2
    const linkTextBottom = linkTextEndCoords.bottom + window.scrollY

    return {
      top: linkTextBottom + 4,
      left: centerX + window.scrollX,
    }
  } else if (cursorCoords) {
    // Fallback to cursor position
    return {
      top: cursorCoords.bottom + window.scrollY + 4,
      left: cursorCoords.left + window.scrollX + 4,
    }
  }
  
  return { top: 0, left: 0 }
}

// Check if we should show the rune link selector
function checkAndShowRuneLinkSelector(view: EditorView): void {
  if (!props.runes || props.runes.length === 0 || !props.isDirectory) {
    // Hide if no runes available
    if (showRuneLinkSelector.value) {
      showRuneLinkSelector.value = false
    }
    return
  }

  const linkInfo = isInLinkUrlField(view)
  if (linkInfo) {
    // Cursor is in link URL field
    // Clear any existing timeout - we want to keep it visible while in link field
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }

    // Only update position if link start position changed (prevents jitter while typing in URL)
    if (linkInfo.linkStart !== lastLinkStart) {
      runeLinkSelectorPosition.value = calculateRuneLinkSelectorPosition()
      lastLinkStart = linkInfo.linkStart
    }
    
    // Always update search query from URL text
    runeLinkSelectorSearchQuery.value = linkInfo.urlText || ''
    
    // Show dropdown only if there are results (component will handle filtering)
    // The component will hide itself if filteredRunes is empty
    showRuneLinkSelector.value = true
  } else {
    // Cursor is not in link URL field
    // Clear timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
    
    // Reset link start tracking
    lastLinkStart = -1
    
    // Only hide if we're not hovering (user might be selecting)
    if (!isHoveringDropdown.value) {
      showRuneLinkSelector.value = false
    } else {
      // User is hovering but cursor moved out - set a timeout to hide after they stop hovering
      typingTimeout = setTimeout(() => {
        if (!isHoveringDropdown.value) {
          showRuneLinkSelector.value = false
        }
        typingTimeout = null
      }, 500) // Hide 500ms after leaving hover
    }
  }
}

// Insert link
function insertLink(): void {
  const view = editorViewRef.value
  if (!view) return

  // Just insert the link template, dropdown will appear when user types in URL field
  insertInline(view as EditorView, '[', '](url)', 'link text')
  view.focus()
}

// Handle rune selection from the selector
function handleRuneSelect(rune: RuneInfo): void {
  const view = editorViewRef.value
  if (!view) return

  const linkInfo = isInLinkUrlField(view as EditorView)
  if (!linkInfo) {
    showRuneLinkSelector.value = false
    return
  }

  const { state } = view
  const line = state.doc.lineAt(linkInfo.cursorPos)
  const lineText = line.text
  const lineStart = line.from

  // Find the full markdown link: [text](url)
  const linkPattern = /\[([^\]]+?)\]\(([^)]*?)\)/g
  let match
  let fullLinkStart = -1
  let fullLinkEnd = -1

  while ((match = linkPattern.exec(lineText)) !== null) {
    const matchStart = lineStart + match.index
    const matchEnd = matchStart + match[0].length
    
    // Check if cursor is in this link's URL
    if (linkInfo.cursorPos >= matchStart && linkInfo.cursorPos <= matchEnd) {
      fullLinkStart = matchStart
      fullLinkEnd = matchEnd
      break
    }
  }

  if (fullLinkStart === -1) {
    showRuneLinkSelector.value = false
    return
  }

  // Replace the entire markdown link with wiki link
  const wikiLink = `[[${rune.title}]]`
  const changes: ChangeSpec[] = [{
    from: fullLinkStart,
    to: fullLinkEnd,
    insert: wikiLink,
  }]

  // Place cursor after the wiki link
  const newPos = fullLinkStart + wikiLink.length
  const newSelection = EditorSelection.cursor(newPos)

  view.dispatch({
    changes,
    selection: newSelection,
  })

  view.focus()
  showRuneLinkSelector.value = false
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
  // Don't show bubble menu in preview mode
  if (isInPreviewMode()) {
    hideBubbleMenu()
    return
  }

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
      // Don't show if in preview mode
      if (isInPreviewMode()) {
        isVisible.value = false
        return
      }

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
  // Don't show bubble menu in preview mode
  if (isInPreviewMode()) {
    return
  }

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
  
  // Listen to editor changes for rune link selector
  const handleEditorChanges = () => {
    if (view && !isInPreviewMode()) {
      // Use requestAnimationFrame to debounce and avoid immediate closing
      requestAnimationFrame(() => {
        if (view) {
          checkAndShowRuneLinkSelector(view as EditorView)
        }
      })
    }
  }

  // Hide menu when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    // Don't hide if clicking inside the bubble menu
    const target = event.target as HTMLElement
    if (target.closest('.bubble-menu')) {
      return
    }

    // Close rune link selector on any click outside (the selector handles its own click outside)
    // This is just a backup in case the selector's handler doesn't catch it

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
    if (event.key === 'Escape') {
      if (isVisible.value) {
        event.preventDefault()
        hideBubbleMenu()
      }
      // Also close rune link selector if open
      if (showRuneLinkSelector.value) {
        event.preventDefault()
        showRuneLinkSelector.value = false
      }
    }
  }

  // Hide menu when user starts typing (except for shortcuts)
  const handleInput = () => {
    // Don't show menu in preview mode
    if (isInPreviewMode()) {
      hideBubbleMenu()
      return
    }
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
  view.dom.addEventListener('input', handleEditorChanges)
  view.dom.addEventListener('contextmenu', handleContextMenu)
  view.dom.addEventListener('blur', hideBubbleMenu)
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', handleResize)
  window.addEventListener('blur', handleWindowBlur)
  

  // Clean up function
  cleanupFn = () => {
    if (view && view.dom) {
      view.dom.removeEventListener('mouseup', checkSelection)
      view.dom.removeEventListener('keyup', checkSelection)
      view.dom.removeEventListener('keydown', handleKeyDown)
      view.dom.removeEventListener('input', handleInput)
      view.dom.removeEventListener('input', handleEditorChanges)
      view.dom.removeEventListener('contextmenu', handleContextMenu)
      view.dom.removeEventListener('blur', hideBubbleMenu)
    }
    document.removeEventListener('mousedown', handleClickOutside)
    document.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('scroll', handleScroll, true)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('blur', handleWindowBlur)
    hideBubbleMenu()
    
    // Clear typing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
  }
}

// Cleanup on unmount
onUnmounted(() => {
  if (cleanupFn) {
    cleanupFn()
  }
})
</script>

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
          <button @click="applyFormat('bold')" title="Bold" class="menu-btn">
            <strong>B</strong>
          </button>
          <button
            @click="applyFormat('italic')"
            title="Italic
          "
            class="menu-btn"
          >
            <em>I</em>
          </button>
          <button @click="applyFormat('strikethrough')" title="Strikethrough" class="menu-btn">
            <s>S</s>
          </button>
          <button @click="applyFormat('code')" title="Inline Code" class="menu-btn">
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
          <button @click="insertLink" title="Link" class="menu-btn">
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

    <!-- Rune Link Selector -->
    <RuneLinkSelector
      v-if="runes && isDirectory"
      :runes="runes"
      :is-directory="isDirectory"
      :visible="showRuneLinkSelector"
      :editor-view="editorViewRef as EditorView | null"
      :position="runeLinkSelectorPosition"
      :search-query="runeLinkSelectorSearchQuery"
      @select="handleRuneSelect"
      @close="showRuneLinkSelector = false"
      @hover="isHoveringDropdown = true"
      @leave="isHoveringDropdown = false"
    />
  </Teleport>
</template>

<style scoped>
.bubble-menu {
  position: fixed;
  z-index: 1000;
  pointer-events: auto;
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1),
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
  box-shadow: 0 2px 6px -1px var(--color-modal-shadow);
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
  transition:
    background-color 0.15s ease,
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
  color: var(--color-accent);
}

.menu-btn:active {
  background: var(--color-overlay-medium);
  color: var(--color-accent);
  transform: scale(0.96);
}

.menu-btn:focus-visible {
  background: var(--color-overlay-light);
  color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
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
.menu-btn[title*='Heading'] {
  font-family: var(--font-primary);
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Task list checkmark */
.menu-btn[title*='Task'] .icon-text {
  font-weight: 600;
  font-size: 0.95rem;
}

/* Link icon */
.menu-btn[title*='Link'] .icon-text {
  font-size: 0.9rem;
}

/* Image icon */
.menu-btn[title*='Image'] .icon-text {
  font-size: 0.95rem;
}

/* Table icon */
.menu-btn[title*='Table'] .icon-text {
  font-size: 1.05rem;
}

/* Quote icon */
.menu-btn[title*='Blockquote'] .icon-text {
  font-size: 1.1rem;
  line-height: 0.8;
}
</style>
