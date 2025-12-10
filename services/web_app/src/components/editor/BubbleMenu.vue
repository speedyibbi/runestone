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
        <div class="bubble-menu-placeholder">Menu</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, onMounted } from 'vue'
import type { EditorView } from '@codemirror/view'

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
  padding: var(--size-spacing-small) var(--size-spacing-medium);
  box-shadow: 0 4px 20px var(--color-modal-shadow);
  display: flex;
  gap: var(--size-spacing-tiny);
  align-items: center;
  min-height: 2rem;
}

.bubble-menu-placeholder {
  color: var(--color-foreground);
  font-size: 0.875rem;
  padding: 0 var(--size-spacing-small);
  user-select: none;
  opacity: 0.7;
  font-weight: 500;
  letter-spacing: 0.01em;
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
