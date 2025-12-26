<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import type { EditorView } from '@codemirror/view'
import { useEditor } from '@/composables/useEditor'
import { useCodex, type RuneInfo } from '@/composables/useCodex'
import KeyboardShortcuts from '@/components/editor/KeyboardShortcuts.vue'
import BubbleMenu from '@/components/editor/BubbleMenu.vue'

const route = useRoute()

// Editor setup
const editorElement = ref<HTMLElement>()
const editorViewRef = ref<EditorView | null>(null) as import('vue').Ref<EditorView | null>

const {
  runes,
  currentRune,
  currentCodex,
  isLoadingRune,
  hasOpenRune,
  openRune,
  createRune,
  refreshRuneList,
  isDirectory,
  saveCurrentRune,
  isSavingRune,
  hasUnsavedChanges,
  error,
  createAutoSaveCallback,
  renameRune,
  deleteRune,
  duplicateRune,
  closeRune,
} = useCodex(editorViewRef, { autoSave: true })

// Get auto-save callback and create editor with it
const autoSaveCallback = createAutoSaveCallback()
const { editorView, isPreviewMode, togglePreview } = useEditor(
  editorElement,
  autoSaveCallback,
)

// Update editorViewRef when editorView becomes available
watch(editorView, (view) => {
  editorViewRef.value = view as EditorView | null
}, { immediate: true })

// Computed
const currentRuneId = computed(() => currentRune.value?.uuid ?? null)

// Watch route changes for runeId
watch(
  () => route.params.runeId,
  (newRuneId) => {
    if (newRuneId && typeof newRuneId === 'string') {
      openRune(newRuneId)
    }
  },
)

// Save functionality
const lastSaveTime = ref<Date | null>(null)
const showSaveStatus = ref(false)

async function handleManualSave() {
  if (!hasOpenRune.value) {
    console.warn('Cannot save: No rune is open')
    return
  }
  
  if (!editorView.value) {
    console.warn('Cannot save: Editor view is not available')
    return
  }
  
  if (!currentRune.value) {
    console.warn('Cannot save: Current rune is null')
    return
  }
  
  // Get content directly from editor to verify it's available
  const content = editorView.value.state.doc.toString()
  // Force mark as dirty to ensure save happens (manual save should always save)
  // This ensures the save will proceed even if auto-save thinks it's clean
  currentRune.value.isDirty = true
  
  try {
    await saveCurrentRune(false) // false = show notification
    lastSaveTime.value = new Date()
    showSaveStatus.value = true
    // Hide status after 3 seconds
    setTimeout(() => {
      showSaveStatus.value = false
    }, 3000)
  } catch (err) {
    console.error('Error saving rune:', err)
    showSaveStatus.value = true
    // Keep error visible longer
    setTimeout(() => {
      if (!hasUnsavedChanges.value && !isSavingRune.value) {
        showSaveStatus.value = false
      }
    }, 5000)
  }
}

// Keyboard shortcut handler for Cmd/Ctrl+S (fallback for non-editor areas)
function handleKeydown(event: KeyboardEvent) {
  // Cmd/Ctrl+S for manual save
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    // Don't intercept if user is typing in an input/textarea
    const target = event.target as HTMLElement
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable ||
                         target.closest('input') ||
                         target.closest('textarea')
    
    if (isInputField) {
      return
    }
    
    // ALWAYS prevent default FIRST to stop browser save dialog
    // This must happen before any other logic
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    
    // Only save if we have a rune open
    if (hasOpenRune.value) {
      handleManualSave()
    }
  }
}

// Handle save event from CodeMirror editor
function handleEditorSave(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  
  if (hasOpenRune.value) {
    handleManualSave()
  }
}

// Watch for auto-save completion to show status briefly
watch(isSavingRune, (isSaving) => {
  if (!isSaving && hasOpenRune.value && !hasUnsavedChanges.value && !error.value) {
    // Auto-save just completed successfully
    lastSaveTime.value = new Date()
    showSaveStatus.value = true
    setTimeout(() => {
      showSaveStatus.value = false
    }, 2000) // Shorter for auto-save
  }
})

// Computed property for save status text
const saveStatusText = computed(() => {
  // Always show when saving
  if (isSavingRune.value) {
    return 'Saving...'
  }
  
  // Always show errors
  if (error.value) {
    return 'Error saving'
  }
  
  // Always show unsaved changes
  if (hasUnsavedChanges.value) {
    return 'Unsaved changes'
  }
  
  // Only show "saved" status briefly after manual save or if explicitly shown
  if (showSaveStatus.value && lastSaveTime.value) {
    const now = new Date()
    const diffMs = now.getTime() - lastSaveTime.value.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    
    if (diffSecs < 1) {
      return 'Saved just now'
    } else if (diffSecs < 60) {
      return 'Saved just now'
    } else {
      return 'Saved'
    }
  }
  
  // Don't show status when everything is saved and no recent activity
  return ''
})

// Watch for editor element to set up save listener
watch(editorElement, (element) => {
  if (element) {
    // Listen for save events from CodeMirror editor
    // This handles Cmd/Ctrl+S when the editor is focused
    element.addEventListener('editor-save', handleEditorSave)
  }
}, { immediate: true })

onMounted(() => {
  refreshRuneList()
  
  const runeId = route.params.runeId as string | undefined
  if (runeId) {
    openRune(runeId)
  }
  
  // Add keyboard event listener with capture phase to catch it early
  // This ensures we prevent default before the browser handles it
  window.addEventListener('keydown', handleKeydown, { capture: true })
})

onUnmounted(() => {
  // Remove keyboard event listener
  window.removeEventListener('keydown', handleKeydown, { capture: true })
  
  // Remove editor save event listener
  if (editorElement.value) {
    editorElement.value.removeEventListener('editor-save', handleEditorSave)
  }
})
</script>

<template>
  <main>
    <!-- Editor Panel -->
    <div class="editor-panel">
      <!-- Empty State -->
      <div v-if="!hasOpenRune && !isLoadingRune" class="state-overlay">
        <p class="empty-message">Select or create a rune to begin</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="isLoadingRune" class="state-overlay">
        <p class="empty-message">Loading rune...</p>
      </div>

      <!-- Editor -->
      <div class="editor-container" :class="{ visible: hasOpenRune && !isLoadingRune }">
        <div ref="editorElement" class="editor"></div>
      </div>

      <!-- Save Status Indicator -->
      <div v-if="hasOpenRune && saveStatusText" class="save-status" :class="{ 'has-error': error }">
        <span>{{ saveStatusText }}</span>
      </div>

      <!-- Preview Toggle Button -->
      <div v-if="hasOpenRune" class="preview-toggle-container">
        <button
          class="preview-toggle"
          @click="togglePreview"
          :class="{ 'is-preview': isPreviewMode }"
          :title="isPreviewMode ? 'Exit Preview (Ctrl+E)' : 'Enter Preview (Ctrl+E)'"
        >
          <svg
            v-if="isPreviewMode"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <KeyboardShortcuts />
      <BubbleMenu :editor-view="editorView" />
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

/* Editor Panel */
.editor-panel {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow-x: hidden;
  overflow-y: scroll;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.editor-panel::-webkit-scrollbar {
  display: none;
}

/* State Overlay (for empty state) */
.state-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes loading-pulse {
  0% {
    background-position:
      -150% 0,
      -150% 0;
  }
  50% {
    background-position:
      250% 0,
      -150% 0;
  }
  100% {
    background-position:
      250% 0,
      250% 0;
  }
}

.empty-message {
  color: var(--color-accent);
  font-size: 0.9rem;
  margin: 0;
}

.editor-container {
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
}

.editor-container.visible {
  opacity: 1;
  pointer-events: auto;
}

.editor {
  flex: 1;
  width: 100%;
  max-width: 75rem;
}

/* Save Status Indicator */
.save-status {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.375rem 0.875rem;
  background: var(--color-overlay-light);
  border: 1px solid var(--color-overlay-border);
  border-radius: 3px;
  color: var(--color-muted);
  font-size: 0.8125rem;
  z-index: 100;
  font-family: var(--font-primary);
  pointer-events: none;
  opacity: 0.8;
  transition: all 0.3s ease-in-out;
  backdrop-filter: blur(8px);
}

.save-status.has-error {
  color: var(--color-error);
  border-color: var(--color-error);
  opacity: 1;
  background: var(--color-overlay-medium);
}

.preview-toggle-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 100;
  font-family: var(--font-primary);
}

.preview-toggle {
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 8px;
  padding: 0.5rem;
  color: var(--color-accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 8px 24px var(--color-modal-shadow);
  outline: none;
  user-select: none;
  opacity: 0.7;
}

.preview-toggle:hover {
  background: var(--color-overlay-light);
  opacity: 1;
  transform: scale(1.05);
  box-shadow: 0 12px 32px var(--color-modal-shadow);
}

.preview-toggle:active {
  transform: scale(0.98);
  background: var(--color-overlay-medium);
}

.preview-toggle:focus-visible {
  box-shadow:
    0 0 0 2px var(--color-overlay-border),
    0 8px 24px var(--color-modal-shadow);
  opacity: 1;
}

.preview-toggle.is-preview {
  opacity: 1;
  background: var(--color-overlay-light);
}

.preview-toggle svg {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
}
</style>
