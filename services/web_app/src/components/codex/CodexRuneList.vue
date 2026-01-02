<script lang="ts" setup>
import { ref, computed } from 'vue'
import type { RuneInfo } from '@/composables/useCodex'
import type { TreeNode } from '@/components/codex/CodexLeftSidebar.vue'
import CodexRuneActions from '@/components/codex/CodexRuneActions.vue'
import CodexRuneTreeNode from '@/components/codex/CodexRuneTreeNode.vue'
import CodexRuneItem from '@/components/codex/CodexRuneItem.vue'

type EditingState =
  | { type: 'creating-rune'; parentPath: string }
  | { type: 'creating-directory'; parentPath: string }
  | { type: 'renaming'; runeId: string }
  | null

interface Props {
  runeTree: TreeNode[]
  currentRuneId: string | null
  expandedDirectories: Set<string>
  selectedDirectory: string
  isDirectory: (title: string) => boolean
  editingState: EditingState
}

interface Emits {
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

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedDirectoryName = computed(() => {
  if (!props.selectedDirectory) return ''
  const parts = props.selectedDirectory.split('/').filter((p) => p)
  return parts[parts.length - 1] || ''
})

const newRuneName = ref('')
const showNewRuneInput = ref(false)

function handleNewRune() {
  showNewRuneInput.value = true
  emit('createRune')
}

function handleNewDirectory() {
  emit('createDirectory')
}

function handleSort() {
  emit('sort')
}

function handleCollapse() {
  emit('collapseAll')
}
</script>

<template>
  <div class="sidebar-section">
    <CodexRuneActions
      @new-rune="handleNewRune"
      @new-directory="handleNewDirectory"
      @sort="handleSort"
      @collapse="handleCollapse"
    />
    <div class="section-header">
      <div class="section-title-row">
        <span class="section-title">Runes</span>
        <div class="selected-directory-wrapper" :class="{ 'has-selection': selectedDirectory }">
          <Transition name="directory-indicator-fade">
            <div v-if="selectedDirectory" class="selected-directory-indicator">
              <span class="selected-directory-text" :title="selectedDirectory">
                In: {{ selectedDirectoryName }}
              </span>
              <button
                class="clear-selection-button"
                @click="emit('clearSelection')"
                title="Clear selection (Ctrl/Cmd+Click directory to select)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <div class="rune-list">
      <TransitionGroup name="rune-item-fade" tag="div" class="rune-tree-container">
        <CodexRuneTreeNode
          v-for="node in runeTree"
          :key="node.rune.uuid"
          :node="node"
          :current-rune-id="currentRuneId"
          :expanded-directories="expandedDirectories"
          :selected-directory="selectedDirectory"
          :is-directory="isDirectory"
          :editing-state="editingState"
          @rune-click="(rune, event) => emit('runeClick', rune, event)"
          @rune-double-click="emit('runeDoubleClick', $event)"
          @rune-context-menu="(event, rune) => emit('runeContextMenu', event, rune)"
          @edit-submit="emit('edit-submit', $event)"
          @edit-cancel="emit('edit-cancel')"
        />
      </TransitionGroup>
      <!-- Placeholder for creating at root level -->
      <Transition name="rune-item-fade">
        <CodexRuneItem
          v-if="
            editingState &&
            (editingState.type === 'creating-rune' || editingState.type === 'creating-directory') &&
            editingState.parentPath === ''
          "
          :rune="null"
          :active="false"
          :is-directory="editingState.type === 'creating-directory'"
          :level="0"
          :is-creating="true"
          :parent-path="''"
          @edit-submit="emit('edit-submit', $event)"
          @edit-cancel="emit('edit-cancel')"
        />
      </Transition>
      <div v-if="runeTree.length === 0 && !editingState" class="empty-rune-list">
        <p>No runes yet</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem 0.75rem 1rem;
  margin-bottom: 0.25rem;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-height: 1.5rem;
}

.section-title {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
}

.selected-directory-wrapper {
  min-width: 0;
  overflow: hidden;
  max-width: 0;
  transition: max-width 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.selected-directory-wrapper.has-selection {
  max-width: 15rem;
}

.selected-directory-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-overlay-subtle);
  border-radius: 4px;
  font-size: 0.6875rem;
  white-space: nowrap;
}

.selected-directory-text {
  color: var(--color-accent);
  font-weight: 500;
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-selection-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  transition: all 0.15s;
  opacity: 0.6;
}

.clear-selection-button:hover {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  opacity: 1;
}

.rune-list {
  padding: 0 0.5rem;
  position: relative;
}

.rune-tree-container {
  position: relative;
  display: flex;
  flex-direction: column;
}

.empty-rune-list {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.6;
}

.rune-item-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.rune-item-fade-leave-active {
  transition:
    opacity 0.3s cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  position: absolute !important;
  width: 100%;
  pointer-events: none;
}

.rune-item-fade-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.rune-item-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.rune-item-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.rune-item-fade-enter-to,
.rune-item-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.directory-indicator-fade-enter-active {
  transition:
    opacity 0.2s cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.directory-indicator-fade-leave-active {
  transition:
    opacity 0.15s cubic-bezier(0.25, 0.1, 0.25, 1),
    transform 0.15s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.directory-indicator-fade-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.directory-indicator-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.directory-indicator-fade-enter-to,
.directory-indicator-fade-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
