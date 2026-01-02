<script lang="ts" setup>
import { computed } from 'vue'
import type { RuneInfo } from '@/composables/useCodex'
import type { TreeNode } from '@/components/codex/CodexLeftSidebar.vue'
import CodexRuneItem from '@/components/codex/CodexRuneItem.vue'

type EditingState =
  | { type: 'creating-rune'; parentPath: string }
  | { type: 'creating-directory'; parentPath: string }
  | { type: 'renaming'; runeId: string }
  | null

interface Props {
  node: TreeNode
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
  (e: 'edit-submit', value: string): void
  (e: 'edit-cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function getDisplayName(node: TreeNode): string {
  const fullTitle = node.rune.title
  if (node.parentPath === '') {
    return fullTitle
  }
  if (fullTitle.startsWith(node.parentPath)) {
    return fullTitle.slice(node.parentPath.length)
  }
  return fullTitle
}

const isEditing = computed(() => {
  return (
    props.editingState?.type === 'renaming' && props.editingState.runeId === props.node.rune.uuid
  )
})

const showCreatePlaceholder = computed(() => {
  if (!props.editingState) return false
  if (
    props.editingState.type === 'creating-rune' ||
    props.editingState.type === 'creating-directory'
  ) {
    return (
      props.editingState.parentPath === props.node.rune.title &&
      props.isDirectory(props.node.rune.title)
    )
  }
  return false
})

const isExpanded = computed(() => {
  return (
    props.isDirectory(props.node.rune.title) && props.expandedDirectories.has(props.node.rune.title)
  )
})

function handleRuneClick(rune: RuneInfo | null, event?: MouseEvent) {
  if (rune) {
    emit('runeClick', rune, event)
  }
}

function handleRuneDoubleClick(rune: RuneInfo | null) {
  if (rune) {
    emit('runeDoubleClick', rune)
  }
}

function handleRuneContextMenu(event: MouseEvent, rune: RuneInfo | null) {
  if (rune) {
    emit('runeContextMenu', event, rune)
  }
}
</script>

<template>
  <div class="tree-node">
    <CodexRuneItem
      :rune="node.rune"
      :active="currentRuneId === node.rune.uuid"
      :is-directory="isDirectory(node.rune.title)"
      :display-name="getDisplayName(node)"
      :level="node.level"
      :expanded="isDirectory(node.rune.title) && expandedDirectories.has(node.rune.title)"
      :has-children="node.children.length > 0"
      :selected="isDirectory(node.rune.title) && selectedDirectory === node.rune.title"
      :is-editing="isEditing"
      :parent-path="node.parentPath"
      @click="handleRuneClick"
      @dblclick="handleRuneDoubleClick"
      @contextmenu="handleRuneContextMenu"
      @edit-submit="emit('edit-submit', $event)"
      @edit-cancel="emit('edit-cancel')"
    />
    <!-- Recursively render children if directory is expanded -->
    <Transition name="directory-expand">
      <div v-if="isDirectory(node.rune.title) && isExpanded" class="children-wrapper">
        <div class="children-container">
          <TransitionGroup name="rune-item-fade" tag="div" class="children-list">
            <CodexRuneTreeNode
              v-for="child in node.children"
              :key="child.rune.uuid"
              :node="child"
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
          <!-- Placeholder for creating new item in this directory -->
          <Transition name="rune-item-fade">
            <CodexRuneItem
              v-if="showCreatePlaceholder"
              :rune="null"
              :active="false"
              :is-directory="editingState?.type === 'creating-directory'"
              :level="node.level + 1"
              :is-creating="true"
              :parent-path="node.rune.title"
              @edit-submit="emit('edit-submit', $event)"
              @edit-cancel="emit('edit-cancel')"
            />
          </Transition>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tree-node {
  position: relative;
  display: flex;
  flex-direction: column;
}

.children-wrapper {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
}

.directory-expand-enter-active {
  transition: grid-template-rows 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  grid-template-rows: 0fr;
}

.directory-expand-enter-to {
  grid-template-rows: 1fr;
}

.directory-expand-leave-active {
  transition: grid-template-rows 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  grid-template-rows: 1fr;
}

.directory-expand-leave-to {
  grid-template-rows: 0fr;
}

.children-container {
  position: relative;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.children-list {
  display: flex;
  flex-direction: column;
  position: relative;
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
</style>
