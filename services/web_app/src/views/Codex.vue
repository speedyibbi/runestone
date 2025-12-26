<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useEditor } from '@/composables/useEditor'
import { useCodex, type RuneInfo } from '@/composables/useCodex'
import Explorer from '@/components/codex/Explorer.vue'
import KeyboardShortcuts from '@/components/editor/KeyboardShortcuts.vue'
import BubbleMenu from '@/components/editor/BubbleMenu.vue'

const route = useRoute()

// Editor setup
const editorElement = ref<HTMLElement>()
const { editorView, isPreviewMode, togglePreview } = useEditor(editorElement)

// Codex setup
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
} = useCodex(editorView)

// Sidebar state
const isSidebarCollapsed = ref(false)
const expandedDirectories = ref<Set<string>>(new Set())
const showCreateForm = ref(false)
const showCreateDirectoryForm = ref(false)
const showSearchForm = ref(false)
const newRuneTitle = ref('')
const newDirectoryName = ref('')
const searchQuery = ref('')
const isCreating = ref(false)

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

// Tree structure building
interface TreeItem {
  rune: RuneInfo
  level: number
  isDirectory: boolean
}

const treeItems = computed<TreeItem[]>(() => {
  const items: TreeItem[] = []
  const filteredRunes = searchQuery.value.trim()
    ? runes.value.filter((rune) =>
        rune.title.toLowerCase().includes(searchQuery.value.toLowerCase()),
      )
    : runes.value

  // Sort: directories first, then alphabetically
  const sortedRunes = [...filteredRunes].sort((a, b) => {
    const aIsDir = isDirectory(a.title)
    const bIsDir = isDirectory(b.title)

    if (aIsDir && !bIsDir) return -1
    if (!aIsDir && bIsDir) return 1
    return a.title.localeCompare(b.title)
  })

  for (const rune of sortedRunes) {
    const pathParts = rune.title.split('/')
    const level = pathParts.length - (isDirectory(rune.title) ? 2 : 1)

    // Check if this item should be visible based on expanded directories
    let shouldShow = true
    if (level > 0) {
      // Build parent path
      const parentParts = pathParts.slice(0, -1)
      if (isDirectory(rune.title)) {
        parentParts.pop() // Remove trailing empty string from directory path
      }

      // Check if all parent directories are expanded
      for (let i = 1; i <= parentParts.length; i++) {
        const parentPath = parentParts.slice(0, i).join('/') + '/'
        if (!expandedDirectories.value.has(parentPath)) {
          shouldShow = false
          break
        }
      }
    }

    if (shouldShow) {
      items.push({
        rune,
        level,
        isDirectory: isDirectory(rune.title),
      })
    }
  }

  return items
})

// Computed
const currentRuneId = computed(() => currentRune.value?.uuid ?? null)

// Explorer event handlers
function handleToggleDirectory(dirName: string) {
  if (expandedDirectories.value.has(dirName)) {
    expandedDirectories.value.delete(dirName)
  } else {
    expandedDirectories.value.add(dirName)
  }
}

function handleNewFile() {
  showCreateForm.value = true
  showCreateDirectoryForm.value = false
  showSearchForm.value = false
  newRuneTitle.value = ''
}

function handleNewDirectory() {
  showCreateDirectoryForm.value = true
  showCreateForm.value = false
  showSearchForm.value = false
  newDirectoryName.value = ''
}

function handleSearch() {
  showSearchForm.value = !showSearchForm.value
  if (!showSearchForm.value) {
    searchQuery.value = ''
  }
  showCreateForm.value = false
  showCreateDirectoryForm.value = false
}

function handleCollapse() {
  expandedDirectories.value.clear()
}

async function handleSelectRune(runeId: string) {
  try {
    await openRune(runeId)
  } catch (err) {
    console.error('Error opening rune:', err)
  }
}

async function handleCreateRune(title: string) {
  if (!title.trim()) return

  isCreating.value = true

  try {
    const runeId = await createRune(title.trim())

    // Reset forms
    showCreateForm.value = false
    showCreateDirectoryForm.value = false
    newRuneTitle.value = ''
    newDirectoryName.value = ''

    // Auto-open the newly created rune if it's not a directory
    if (!isDirectory(title.trim())) {
      await openRune(runeId)
    } else {
      // Auto-expand the directory
      expandedDirectories.value.add(title.trim())
    }
  } catch (err) {
    console.error('Error creating rune:', err)
  } finally {
    isCreating.value = false
  }
}

onMounted(() => {
  refreshRuneList()
  
  const runeId = route.params.runeId as string | undefined
  if (runeId) {
    handleSelectRune(runeId)
  }
})

// Watch route changes for runeId
watch(
  () => route.params.runeId,
  (newRuneId) => {
    if (newRuneId && typeof newRuneId === 'string') {
      handleSelectRune(newRuneId)
    }
  },
)
</script>

<template>
  <main>
    <!-- Sidebar -->
    <Explorer
      :class="['sidebar', { collapsed: isSidebarCollapsed }]"
      :tree-items="treeItems"
      :current-rune-id="currentRuneId"
      :is-loading="isLoadingRune"
      :codex-title="currentCodex?.title"
      :expanded-directories="expandedDirectories"
      :show-create-form="showCreateForm"
      :show-create-directory-form="showCreateDirectoryForm"
      :show-search-form="showSearchForm"
      :new-rune-title="newRuneTitle"
      :new-directory-name="newDirectoryName"
      :search-query="searchQuery"
      :is-creating="isCreating"
      @select-rune="handleSelectRune"
      @toggle-directory="handleToggleDirectory"
      @create-rune="handleCreateRune"
      @new-file="handleNewFile"
      @new-directory="handleNewDirectory"
      @search="handleSearch"
      @collapse="handleCollapse"
      @refresh="refreshRuneList"
      @update:new-rune-title="(val) => (newRuneTitle = val)"
      @update:new-directory-name="(val) => (newDirectoryName = val)"
      @update:search-query="(val) => (searchQuery = val)"
      @update:show-create-form="(val) => (showCreateForm = val)"
      @update:show-create-directory-form="(val) => (showCreateDirectoryForm = val)"
      @update:show-search-form="(val) => (showSearchForm = val)"
    />

    <!-- Sidebar Toggle Button -->
    <button
      class="sidebar-toggle"
      @click="toggleSidebar"
      :title="isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
    >
      <svg
        v-if="isSidebarCollapsed"
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>

    <!-- Editor Panel -->
    <div class="editor-panel" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
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

/* Sidebar */
.sidebar {
  width: 17.5rem;
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
  transition:
    width 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
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
