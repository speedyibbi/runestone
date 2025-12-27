<script lang="ts" setup>
import FadeTransition from '@/components/base/FadeTransition.vue'
import CodexRuneList from './CodexRuneList.vue'
import CodexSearchPanel from './CodexSearchPanel.vue'
import CodexGraphPanel from './CodexGraphPanel.vue'
import type { RuneInfo } from '@/composables/useCodex'

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
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <aside class="left-sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="sidebar-title">
        <h2>{{ codexTitle || 'Codex' }}</h2>
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
          @rune-click="(rune, event) => emit('runeClick', rune, event)"
          @rune-double-click="emit('runeDoubleClick', $event)"
          @rune-context-menu="(event, rune) => emit('runeContextMenu', event, rune)"
          @create-rune="emit('createRune')"
          @create-directory="emit('createDirectory')"
          @clear-selection="emit('clearSelection')"
          @collapse-all="emit('collapseAll')"
          @sort="emit('sort')"
          @edit-submit="emit('edit-submit', $event)"
          @edit-cancel="emit('edit-cancel')"
        />
        <CodexSearchPanel v-else-if="activePanel === 'search'" />
        <CodexGraphPanel v-else-if="activePanel === 'graph'" />
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
  border-radius: 0.375rem;
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
  border-radius: 0.125rem;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}
</style>
