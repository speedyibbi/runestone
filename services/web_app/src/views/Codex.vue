<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useEditor } from '@/composables/useEditor'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import KeyboardShortcuts from '@/components/editor/KeyboardShortcuts.vue'
import BubbleMenu from '@/components/editor/BubbleMenu.vue'
import RuneList from '@/components/codex/RuneList.vue'

const sessionStore = useSessionStore()
const toast = useToast()

const editorElement = ref<HTMLElement>()
const { getContent, setContent, editorView, isPreviewMode, togglePreview } = useEditor(editorElement)

const selectedRuneId = ref<string | null>(null)
const isSidebarCollapsed = ref(false)
const isLoadingRune = ref(false)
const isSaving = ref(false)
const lastSavedContent = ref<string>('')
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const saveStatusTimeout = ref<number | null>(null)
const autoSaveTimeout = ref<number | null>(null)
const lastCheckContent = ref<string>('')

async function handleRuneSelect(runeId: string) {
  if (selectedRuneId.value === runeId) {
    // Already selected, do nothing
    return
  }
  
  // Cancel pending auto-save
  cancelAutoSave()
  
  if (selectedRuneId.value && hasUnsavedChanges()) {
    try {
      await saveRune()
    } catch (error) {
      // Error already handled in saveRune, but ask user if they want to continue
      const shouldContinue = confirm('Failed to save current rune. Switch anyway?')
      if (!shouldContinue) {
        return
      }
    }
  }
  
  selectedRuneId.value = runeId
  isLoadingRune.value = true
  
  try {
    // Fetch rune content from session store
    const content = await sessionStore.getRune(runeId)
    
    // Load content into editor
    setContent(content)
    
    // Store as last saved content
    lastSavedContent.value = content
    lastCheckContent.value = content
    saveStatus.value = 'idle'
  } catch (error) {
    console.error('Failed to load rune:', error)
    toast.error('Failed to load rune: ' + (error instanceof Error ? error.message : String(error)))
    
    // Clear selection and editor on error
    selectedRuneId.value = null
    setContent('')
    lastSavedContent.value = ''
    lastCheckContent.value = ''
  } finally {
    isLoadingRune.value = false
  }
}

function hasUnsavedChanges(): boolean {
  const currentContent = getContent()
  return currentContent !== lastSavedContent.value
}

async function saveRune() {
  if (!selectedRuneId.value) {
    return
  }
  
  if (isSaving.value) {
    return // Already saving
  }
  
  const currentContent = getContent()
  
  // Don't save if content hasn't changed
  if (currentContent === lastSavedContent.value) {
    return
  }
  
  isSaving.value = true
  saveStatus.value = 'saving'
  
  try {
    await sessionStore.updateRune(selectedRuneId.value, {
      content: currentContent
    })
    
    lastSavedContent.value = currentContent
    saveStatus.value = 'saved'
    
    // Clear "Saved" status after 2 seconds
    if (saveStatusTimeout.value) {
      clearTimeout(saveStatusTimeout.value)
    }
    saveStatusTimeout.value = window.setTimeout(() => {
      saveStatus.value = 'idle'
      saveStatusTimeout.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to save rune:', error)
    toast.error('Failed to save: ' + (error instanceof Error ? error.message : String(error)))
    saveStatus.value = 'error'
    
    // Clear error status after 3 seconds
    if (saveStatusTimeout.value) {
      clearTimeout(saveStatusTimeout.value)
    }
    saveStatusTimeout.value = window.setTimeout(() => {
      saveStatus.value = 'idle'
      saveStatusTimeout.value = null
    }, 3000)
    
    throw error
  } finally {
    isSaving.value = false
  }
}

function scheduleAutoSave() {
  // Cancel existing auto-save timer
  cancelAutoSave()
  
  // Schedule auto-save after 2 seconds of inactivity
  autoSaveTimeout.value = window.setTimeout(() => {
    if (selectedRuneId.value && hasUnsavedChanges()) {
      saveRune()
    }
    autoSaveTimeout.value = null
  }, 2000)
}

function cancelAutoSave() {
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value)
    autoSaveTimeout.value = null
  }
}

function checkForChanges() {
  if (!selectedRuneId.value || isSaving.value) {
    return
  }
  
  const currentContent = getContent()
  
  // If content changed since last check, schedule auto-save
  if (currentContent !== lastCheckContent.value) {
    lastCheckContent.value = currentContent
    scheduleAutoSave()
  }
}

function handleKeyboardShortcut(event: KeyboardEvent) {
  // Ctrl+S or Cmd+S to save
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    cancelAutoSave()
    saveRune()
  }
}

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

let contentCheckInterval: number | null = null

onMounted(() => {
  window.addEventListener('keydown', handleKeyboardShortcut)
  
  // Check for content changes every 500ms
  contentCheckInterval = window.setInterval(checkForChanges, 500)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardShortcut)
  
  if (contentCheckInterval) {
    clearInterval(contentCheckInterval)
  }
  
  cancelAutoSave()
  
  if (saveStatusTimeout.value) {
    clearTimeout(saveStatusTimeout.value)
  }
})
</script>

<template>
  <main>
    <!-- Sidebar with Rune List -->
    <aside class="sidebar" :class="{ collapsed: isSidebarCollapsed }">
      <RuneList 
        :selectedRuneId="selectedRuneId"
        :isLoadingRune="isLoadingRune"
        @selectRune="handleRuneSelect"
      />
    </aside>
    
    <!-- Sidebar Toggle Button -->
    <button 
      class="sidebar-toggle"
      @click="toggleSidebar"
      :title="isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
    >
      <svg v-if="isSidebarCollapsed" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m9 18 6-6-6-6"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>
    
    <!-- Editor Panel -->
    <div class="editor-panel" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
      <!-- Empty State Overlay -->
      <Transition name="fade">
        <div v-if="!selectedRuneId && !isLoadingRune" class="state-overlay">
          <p class="empty-message">Select a rune to begin editing</p>
        </div>
      </Transition>
      
      <!-- Editor (always rendered) -->
      <div class="editor-container" :class="{ 'visible': selectedRuneId && !isLoadingRune }">
        <div ref="editorElement" class="editor"></div>
      </div>
      
      <!-- Save Status Indicator -->
      <Transition name="fade">
        <div v-if="selectedRuneId && saveStatus !== 'idle'" class="save-status">
          <span v-if="saveStatus === 'saving'">Saving...</span>
          <span v-else-if="saveStatus === 'saved'">Saved</span>
          <span v-else-if="saveStatus === 'error'" class="error">Save failed</span>
        </div>
      </Transition>
      
      <!-- Preview Toggle Button -->
      <div v-if="selectedRuneId && !isLoadingRune" class="preview-toggle-container">
        <button 
          class="preview-toggle" 
          @click="togglePreview"
          :class="{ 'is-preview': isPreviewMode }"
          :title="isPreviewMode ? 'Exit Preview (Ctrl+E)' : 'Enter Preview (Ctrl+E)'"
        >
          <svg v-if="isPreviewMode" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
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

/* Sidebar */
.sidebar {
  width: 17.5rem;
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}

.sidebar.collapsed {
  width: 0;
  opacity: 0;
  pointer-events: none;
}

/* Sidebar Toggle */
.sidebar-toggle {
  position: fixed;
  left: 17.5rem;
  top: 0.625rem;
  z-index: 200;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 3px;
  padding: 0.25rem;
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  opacity: 0.5;
  outline: none;
  user-select: none;
}

.sidebar-toggle:hover {
  background: var(--color-overlay-light);
  opacity: 1;
  color: var(--color-foreground);
}

.sidebar-toggle:active {
  background: var(--color-overlay-medium);
}

.sidebar-toggle svg {
  width: 0.875rem;
  height: 0.875rem;
}

.sidebar.collapsed ~ .sidebar-toggle {
  left: 0.625rem;
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
  background: var(--color-background);
  z-index: 10;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes loading-pulse {
  0% {
    background-position: -150% 0, -150% 0;
  }
  50% {
    background-position: 250% 0, -150% 0;
  }
  100% {
    background-position: 250% 0, 250% 0;
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
  transition: opacity 0.3s ease-in-out;
}

.save-status .error {
  color: var(--color-error);
  opacity: 1;
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
  box-shadow: 0 0 0 2px var(--color-overlay-border), 0 8px 24px var(--color-modal-shadow);
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

/* Fade transition for editor */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
