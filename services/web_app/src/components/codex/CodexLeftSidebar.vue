<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue'
import FadeTransition from '@/components/base/FadeTransition.vue'
import CodexRuneList from '@/components/codex/CodexRuneList.vue'
import CodexSearchPanel from '@/components/codex/CodexSearchPanel.vue'
import CodexGraphPanel from '@/components/codex/CodexGraphPanel.vue'
import type { RuneInfo } from '@/composables/useCodex'
import type { SearchServiceResult, SearchOptions } from '@/interfaces/search'

export interface TreeNode {
  rune: RuneInfo
  children: TreeNode[]
  level: number
  parentPath: string
}

type EditingState =
  | { type: 'creating-rune'; parentPath: string }
  | { type: 'creating-directory'; parentPath: string }
  | { type: 'renaming'; runeId: string }
  | null

interface Props {
  collapsed: boolean
  activePanel: 'files' | 'search' | 'graph'
  codexTitle: string | null
  runeTree: TreeNode[]
  currentRuneId: string | null
  expandedDirectories: Set<string>
  selectedDirectory: string
  isDirectory: (title: string) => boolean
  editingState: EditingState
  isRenamingCodex?: boolean
  searchRunes?: (query: string, options?: SearchOptions) => Promise<SearchServiceResult>
}

interface Emits {
  (e: 'update:collapsed', value: boolean): void
  (e: 'runeClick', rune: RuneInfo, event?: MouseEvent): void
  (e: 'runeDoubleClick', rune: RuneInfo): void
  (e: 'runeContextMenu', event: MouseEvent, rune: RuneInfo): void
  (e: 'createRune'): void
  (e: 'createDirectory'): void
  (e: 'clearSelection'): void
  (e: 'collapseAll'): void
  (e: 'sort'): void
  (e: 'edit-submit', value: string): void
  (e: 'edit-cancel'): void
  (e: 'codexTitleContextMenu', event: MouseEvent): void
  (e: 'codex-title-edit-submit', value: string): void
  (e: 'codex-title-edit-cancel'): void
  (e: 'openGraph'): void
}

const props = withDefaults(defineProps<Props>(), {
  isRenamingCodex: false,
})

const emit = defineEmits<Emits>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement>()

watch(
  () => props.isRenamingCodex,
  (isRenaming) => {
    if (isRenaming) {
      inputValue.value = props.codexTitle || ''
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
)

function handleSubmit() {
  const value = inputValue.value.trim()
  if (value) {
    emit('codex-title-edit-submit', value)
  } else {
    emit('codex-title-edit-cancel')
  }
}

function handleCancel() {
  emit('codex-title-edit-cancel')
}

function handleBlur() {
  handleSubmit()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleSubmit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}
</script>

<template>
  <aside class="left-sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div
        class="sidebar-title"
        :class="{ editing: isRenamingCodex }"
        @contextmenu.prevent="emit('codexTitleContextMenu', $event)"
      >
        <h2 v-if="!isRenamingCodex">{{ codexTitle || 'Codex' }}</h2>
        <div v-else class="codex-title-input-wrapper">
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="codex-title-input"
            @keydown="handleKeydown"
            @blur="handleBlur"
          />
        </div>
      </div>
      <button class="sidebar-toggle" @click="emit('update:collapsed', !collapsed)">
        <svg
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
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>
    <FadeTransition>
      <div v-if="!collapsed" class="sidebar-content">
        <CodexRuneList
          v-if="activePanel === 'files'"
          :rune-tree="runeTree"
          :current-rune-id="currentRuneId"
          :expanded-directories="expandedDirectories"
          :selected-directory="selectedDirectory"
          :is-directory="isDirectory"
          :editing-state="editingState"
          @rune-click="(rune: RuneInfo, event?: MouseEvent) => emit('runeClick', rune, event)"
          @rune-double-click="emit('runeDoubleClick', $event)"
          @rune-context-menu="
            (event: MouseEvent, rune: RuneInfo) => emit('runeContextMenu', event, rune)
          "
          @create-rune="emit('createRune')"
          @create-directory="emit('createDirectory')"
          @clear-selection="emit('clearSelection')"
          @collapse-all="emit('collapseAll')"
          @sort="emit('sort')"
          @edit-submit="emit('edit-submit', $event)"
          @edit-cancel="emit('edit-cancel')"
        />
        <CodexSearchPanel
          v-else-if="activePanel === 'search'"
          :search-runes="searchRunes"
          :is-directory="isDirectory"
          :codex-title="codexTitle"
          @rune-click="(rune: RuneInfo) => emit('runeClick', rune)"
        />
        <CodexGraphPanel v-else-if="activePanel === 'graph'" @open-graph="emit('openGraph')" />
      </div>
    </FadeTransition>
  </aside>
</template>

<style scoped>
.left-sidebar {
  width: 15rem;
  min-width: 11.25rem;
  max-width: 20rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-right: 1px solid var(--color-overlay-subtle);
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.left-sidebar.collapsed {
  width: 0;
  min-width: 0;
  max-width: 0;
  border-right: none;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 3.5rem;
  min-height: 3.5rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
  gap: 0.5rem;
}

.sidebar-title {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  position: relative;
  padding-left: 0.5rem;
  margin-left: -0.5rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 0.125rem;
  height: 0;
  background: var(--color-accent);
  border-radius: 1px;
  transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
}

.sidebar-title:hover:not(.editing)::before {
  height: 60%;
  opacity: 1;
}

.sidebar-title:hover:not(.editing) h2 {
  opacity: 1;
  color: var(--color-foreground);
  transform: translateX(0.125rem);
}

.sidebar-title h2 {
  font-size: 1rem;
  font-weight: 400;
  color: var(--color-foreground);
  margin: 0;
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
  padding: 0.25rem 0;
  transition:
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.codex-title-input-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 1.5em;
}

.codex-title-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  color: var(--color-foreground);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 400;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
  height: 1.5em;
  letter-spacing: -0.015em;
  transition: all 0.15s ease;
}

.sidebar-title.editing .codex-title-input {
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.sidebar-title.editing .codex-title-input:focus {
  background: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  margin: 0;
  box-shadow: 0 0 0 2px var(--color-selection);
}

.sidebar-toggle {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
}

.sidebar-toggle:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 0 0.75rem 0;
  width: 100%;
}

.sidebar-content::-webkit-scrollbar {
  width: 0.25rem;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 2px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}
</style>
