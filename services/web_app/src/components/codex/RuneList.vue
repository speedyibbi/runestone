<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{
  selectRune: [runeId: string]
}>()

const props = defineProps<{
  selectedRuneId: string | null
  isLoadingRune: boolean
}>()

const sessionStore = useSessionStore()
const toast = useToast()

const runes = computed(() => sessionStore.listRunes())
const currentCodex = computed(() => sessionStore.getCurrentCodex())
const isCreating = ref(false)
const newRuneTitle = ref('')
const createInput = ref<HTMLInputElement>()
const renamingRuneId = ref<string | null>(null)
const renameTitle = ref('')
const isRenamingCodex = ref(false)
const codexTitleInput = ref<HTMLInputElement>()
const codexRenameTitle = ref('')

function selectRune(runeId: string) {
  emit('selectRune', runeId)
}

function showCreateForm() {
  isCreating.value = true
  newRuneTitle.value = ''
  // Focus the input in next tick
  setTimeout(() => {
    createInput.value?.focus()
  }, 50)
}

async function createRune() {
  const title = newRuneTitle.value.trim() || 'Untitled Rune'
  
  try {
    const content = `# ${title}\n\n`
    const runeId = await sessionStore.createRune(title, content)
    
    isCreating.value = false
    newRuneTitle.value = ''
    
    // Auto-select the newly created rune
    emit('selectRune', runeId)
  } catch (error) {
    console.error('Failed to create rune:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to create rune')
  }
}

function cancelCreate() {
  isCreating.value = false
  newRuneTitle.value = ''
}

function startRename(runeId: string, currentTitle: string, event: Event) {
  event.stopPropagation()
  renamingRuneId.value = runeId
  renameTitle.value = currentTitle
  // Focus the input in next tick
  setTimeout(() => {
    const input = document.querySelector('.rename-input') as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  }, 50)
}

async function confirmRename(runeId: string) {
  const newTitle = renameTitle.value.trim()
  if (!newTitle || newTitle === runes.value.find(r => r.uuid === runeId)?.title) {
    cancelRename()
    return
  }
  
  try {
    await sessionStore.updateRune(runeId, { title: newTitle })
    renamingRuneId.value = null
    renameTitle.value = ''
  } catch (error) {
    console.error('Failed to rename rune:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to rename rune')
  }
}

function cancelRename() {
  renamingRuneId.value = null
  renameTitle.value = ''
}

async function deleteRune(runeId: string, event: Event) {
  event.stopPropagation()
  
  const rune = runes.value.find(r => r.uuid === runeId)
  if (!rune) return
  
  try {
    await sessionStore.deleteRune(runeId)
    toast.success(`Deleted "${rune.title}"`)
    
    // If we deleted the selected rune, clear selection or select another
    if (props.selectedRuneId === runeId) {
      const remainingRunes = runes.value.filter(r => r.uuid !== runeId)
      emit('selectRune', remainingRunes[0]?.uuid || '')
    }
  } catch (error) {
    console.error('Failed to delete rune:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to delete rune')
  }
}

function startCodexRename() {
  if (!currentCodex.value) return
  isRenamingCodex.value = true
  codexRenameTitle.value = currentCodex.value.title
  // Focus the input in next tick
  setTimeout(() => {
    codexTitleInput.value?.focus()
    codexTitleInput.value?.select()
  }, 50)
}

async function confirmCodexRename() {
  const newTitle = codexRenameTitle.value.trim()
  if (!newTitle || newTitle === currentCodex.value?.title) {
    cancelCodexRename()
    return
  }
  
  try {
    await sessionStore.renameCodex(newTitle)
    isRenamingCodex.value = false
    codexRenameTitle.value = ''
  } catch (error) {
    console.error('Failed to rename codex:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to rename codex')
  }
}

function cancelCodexRename() {
  isRenamingCodex.value = false
  codexRenameTitle.value = ''
}
</script>

<template>
  <div class="rune-list">
    <!-- Notebook Title -->
    <div class="notebook-header" :class="{ renaming: isRenamingCodex }">
      <span 
        v-if="!isRenamingCodex"
        class="notebook-title" 
        :title="currentCodex?.title"
      >
        {{ currentCodex?.title || 'Untitled Codex' }}
      </span>
      
      <input
        v-else
        ref="codexTitleInput"
        v-model="codexRenameTitle"
        type="text"
        class="codex-title-input"
        @keyup.enter="confirmCodexRename"
        @keyup.esc="cancelCodexRename"
        @blur="confirmCodexRename"
      />
      
      <button 
        v-if="!isRenamingCodex"
        class="codex-edit-btn"
        @click="startCodexRename"
        title="Rename Codex"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="m15 5 4 4"/>
        </svg>
      </button>
    </div>
    
    <!-- Toolbar -->
    <div class="toolbar">
      <span class="toolbar-label">RUNES</span>
      <button 
        class="icon-btn" 
        :class="{ active: isCreating }"
        @click="isCreating ? cancelCreate() : showCreateForm()"
        :title="isCreating ? 'Cancel' : 'New Rune'"
      >
        <svg v-if="!isCreating" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"/>
          <path d="M12 5v14"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    
    <!-- Create Rune Form (Fixed height container to prevent layout shift) -->
    <div class="create-form-container" :class="{ open: isCreating }">
      <div class="create-form">
        <div class="input-wrapper">
          <svg class="file-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <input
            v-model="newRuneTitle"
            type="text"
            placeholder="Untitled Rune"
            @keyup.enter="createRune"
            @keyup.esc="cancelCreate"
            class="rune-input"
            ref="createInput"
          />
        </div>
        <div class="action-buttons">
          <button @click="createRune" class="btn-confirm" title="Create (Enter)">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Tree View -->
    <div class="tree-container">
      <div v-if="runes.length === 0 && !isCreating" class="empty-state">
        <p>No runes yet</p>
      </div>
      
      <div
        v-for="rune in runes"
        :key="rune.uuid"
        class="tree-item"
        :class="{ 
          active: rune.uuid === selectedRuneId, 
          loading: rune.uuid === selectedRuneId && isLoadingRune,
          renaming: renamingRuneId === rune.uuid 
        }"
        @click="renamingRuneId !== rune.uuid && selectRune(rune.uuid)"
      >
        <svg class="file-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        
        <!-- Normal Display -->
        <span 
          v-if="renamingRuneId !== rune.uuid" 
          class="item-name"
          :title="rune.title"
        >
          {{ rune.title }}
        </span>
        
        <!-- Rename Input -->
        <input
          v-else
          v-model="renameTitle"
          type="text"
          class="rename-input"
          @click.stop
          @keyup.enter="confirmRename(rune.uuid)"
          @keyup.esc="cancelRename"
          @blur="confirmRename(rune.uuid)"
        />
        
        <!-- Actions (shown on hover or when active) -->
        <div 
          v-if="renamingRuneId !== rune.uuid" 
          class="item-actions"
          @click.stop
        >
          <button 
            class="action-btn" 
            @click="startRename(rune.uuid, rune.title, $event)"
            title="Rename (F2)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </button>
          <button 
            class="action-btn delete" 
            @click="deleteRune(rune.uuid, $event)"
            title="Delete (Del)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rune-list {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border-right: 1px solid var(--color-overlay-border);
  font-family: var(--font-primary);
}

/* Notebook Header */
.notebook-header {
  padding: 1.25rem 1.125rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-overlay-border);
  position: relative;
}

.notebook-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.codex-title-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  font-size: 0.9375rem;
  font-weight: 500;
  font-family: var(--font-primary);
  padding: 0;
  outline: none;
  min-width: 0;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.codex-title-input:focus {
  background: transparent;
}

.codex-edit-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
}

.notebook-header:hover .codex-edit-btn {
  opacity: 0.5;
  pointer-events: auto;
}

.codex-edit-btn:hover {
  background: var(--color-overlay-light);
  opacity: 1;
}

.codex-edit-btn:active {
  background: var(--color-overlay-medium);
}

/* Toolbar */
.toolbar {
  padding: 0.625rem 1.125rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.toolbar-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--color-muted);
  text-transform: uppercase;
  opacity: 0.6;
}

.icon-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.icon-btn:hover {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  opacity: 1;
}

.icon-btn:active {
  background: var(--color-overlay-medium);
}

.icon-btn.active {
  color: var(--color-error);
  opacity: 1;
}

.icon-btn.active:hover {
  background: var(--color-error-bg);
}

/* Create Form Container - Fixed height to prevent layout shift */
.create-form-container {
  flex-shrink: 0;
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.create-form-container.open {
  max-height: 2.75rem;
  opacity: 1;
}

.create-form {
  padding: 0.5rem 1.125rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.75rem;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-overlay-light);
  border-radius: 4px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  background: var(--color-overlay-medium);
  border-color: var(--color-overlay-border);
}

.rune-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  outline: none;
  font-family: var(--font-primary);
  font-weight: 400;
}

.rune-input::placeholder {
  color: var(--color-muted);
  opacity: 0.5;
}

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.btn-confirm {
  padding: 0.375rem;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s ease;
  color: var(--color-success);
  opacity: 0.7;
}

.btn-confirm:hover {
  background: var(--color-success-bg);
  opacity: 1;
}

.btn-confirm:active {
  opacity: 0.8;
}

/* Tree Container */
.tree-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.375rem 0;
}

.tree-container::-webkit-scrollbar {
  width: 8px;
}

.tree-container::-webkit-scrollbar-track {
  background: transparent;
}

.tree-container::-webkit-scrollbar-thumb {
  background: var(--color-overlay-border);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.tree-container::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-hover);
}

.empty-state {
  padding: 2rem 1.125rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.5;
  font-weight: 400;
}

/* Tree Items */
.tree-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.125rem;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  min-height: 2rem;
  border-radius: 0;
  position: relative;
}

.tree-item:hover {
  background: var(--color-overlay-subtle);
}

.tree-item.active {
  background: var(--color-overlay-light);
}

.tree-item.renaming {
  background: var(--color-overlay-light);
  cursor: default;
}

.tree-item.active .item-name {
  color: var(--color-foreground);
  font-weight: 500;
}

/* Loading pulse on bottom border */
.tree-item.loading::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: 
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%),
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%);
  background-size: 40% 100%, 40% 100%;
  background-position: -150% 0, -150% 0;
  background-repeat: no-repeat;
  animation: loading-pulse 2s ease-in-out infinite;
  pointer-events: none;
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

.file-icon {
  flex-shrink: 0;
  color: var(--color-muted);
  opacity: 0.5;
  transition: all 0.15s ease;
}

.tree-item:hover .file-icon {
  opacity: 0.8;
}

.tree-item.active .file-icon {
  color: var(--color-foreground);
  opacity: 1;
}

.item-name {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
  line-height: 1.5;
  min-width: 0;
  transition: color 0.15s ease;
}

.tree-item:hover .item-name {
  color: var(--color-foreground);
}

/* Rename Input */
.rename-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  font-family: var(--font-primary);
  padding: 0;
  outline: none;
  min-width: 0;
  line-height: 1.5;
  transition: all 0.2s ease;
}

.rename-input:focus {
  background: transparent;
}

/* Item Actions */
.item-actions {
  display: none;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  padding-left: 0.5rem;
  flex-shrink: 0;
}

.tree-item:hover .item-actions,
.tree-item.active .item-actions {
  display: flex;
}

.action-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s ease;
  flex-shrink: 0;
  opacity: 0.5;
}

.action-btn:hover {
  background: var(--color-overlay-medium);
  color: var(--color-foreground);
  opacity: 1;
}

.action-btn:active {
  opacity: 0.7;
}

.action-btn.delete:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
}
</style>
