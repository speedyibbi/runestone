<script lang="ts" setup>
import type { RuneInfo } from '@/composables/useCodex'

interface TreeItem {
  rune: RuneInfo
  level: number
  isDirectory: boolean
}

interface Props {
  codexTitle?: string
  isLoading?: boolean
  treeItems?: TreeItem[]
  currentRuneId?: string | null
  expandedDirectories?: Set<string>
  selectedDirectory?: string | null
  showCreateForm?: boolean
  showCreateDirectoryForm?: boolean
  showSearchForm?: boolean
  newRuneTitle?: string
  newDirectoryName?: string
  searchQuery?: string
  isCreating?: boolean
}

interface Emits {
  (e: 'new-file'): void
  (e: 'new-directory'): void
  (e: 'refresh'): void
  (e: 'search'): void
  (e: 'collapse'): void
  (e: 'select-rune', runeId: string): void
  (e: 'select-directory', dirName: string | null): void
  (e: 'toggle-directory', dirName: string): void
  (e: 'create-rune', title: string): void
  (e: 'update:newRuneTitle', value: string): void
  (e: 'update:newDirectoryName', value: string): void
  (e: 'update:searchQuery', value: string): void
  (e: 'update:showCreateForm', value: boolean): void
  (e: 'update:showCreateDirectoryForm', value: boolean): void
  (e: 'update:showSearchForm', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  treeItems: () => [],
  expandedDirectories: () => new Set(),
  selectedDirectory: null,
  showCreateForm: false,
  showCreateDirectoryForm: false,
  showSearchForm: false,
  newRuneTitle: '',
  newDirectoryName: '',
  searchQuery: '',
  isCreating: false,
})

const emit = defineEmits<Emits>()

function getDirectoryName(rune: RuneInfo): string {
  return rune.title.endsWith('/') ? rune.title.slice(0, -1) : rune.title
}

function handleItemClick(item: TreeItem) {
  if (item.rune.uuid === 'temp-new-file' || item.rune.uuid === 'temp-new-directory') {
    return
  }

  if (item.isDirectory) {
    // Toggle directory expansion
    emit('toggle-directory', item.rune.title)
    
    // Select the directory (parent will clear selection when collapsing)
    emit('select-directory', item.rune.title)
  } else {
    // For files, select the rune and clear directory selection
    emit('select-directory', null)
    emit('select-rune', item.rune.uuid)
  }
}
</script>

<template>
  <aside class="sidebar">
    <!-- Header -->
    <div class="header">
      <div class="header-inner">
        <h2 class="title">{{ codexTitle || 'Runes' }}</h2>
        <div class="header-actions">
          <button class="action-button" @click="emit('new-file')" title="New File">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button class="action-button" @click="emit('new-directory')" title="New Directory">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <path d="M12 11v6" />
              <path d="M9 14h6" />
            </svg>
          </button>
          <button class="action-button" @click="emit('refresh')" title="Refresh Explorer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
          </button>
          <button class="action-button" @click="emit('search')" title="Search Files">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <button class="action-button" @click="emit('collapse')" title="Collapse Folders">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18-6-6 6-6" />
              <path d="M21 6v12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="list">
      <div v-if="isLoading" class="empty">
        <span>Loading...</span>
      </div>
      <div v-else class="list-content">
        <div class="items">
          <!-- Empty state with transition -->
          <Transition name="fade">
            <div v-if="treeItems.length === 0 && !showCreateForm && !showSearchForm && !showCreateDirectoryForm" class="empty">
              <span>No runes yet</span>
            </div>
          </Transition>
          
          <!-- Search input in list -->
          <Transition name="create-input">
            <div v-if="showSearchForm" class="create-item">
              <input
                :value="searchQuery"
                type="text"
                placeholder="Search files..."
                class="create-input-inline"
                @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
                @keydown.escape="emit('update:showSearchForm', false)"
              />
            </div>
          </Transition>
          
          <!-- Create directory input in list -->
          <Transition name="create-input">
            <div v-if="showCreateDirectoryForm" class="create-item">
              <input
                :value="newDirectoryName"
                type="text"
                placeholder="Directory name"
                class="create-input-inline"
                @input="emit('update:newDirectoryName', ($event.target as HTMLInputElement).value)"
                @keydown.enter="emit('create-rune', newDirectoryName.trim() + '/')"
                @keydown.escape="emit('update:showCreateDirectoryForm', false)"
                @blur="!newDirectoryName.trim() && emit('update:showCreateDirectoryForm', false)"
              />
            </div>
          </Transition>
          
          <!-- Create input in list (like VS Code) -->
          <Transition name="create-input">
            <div v-if="showCreateForm" class="create-item">
              <input
                :value="newRuneTitle"
                type="text"
                placeholder="File name"
                :disabled="isCreating"
                class="create-input-inline"
                @input="emit('update:newRuneTitle', ($event.target as HTMLInputElement).value)"
                @keydown.enter="!isCreating && emit('create-rune', newRuneTitle.trim())"
                @keydown.escape="emit('update:showCreateForm', false)"
                @blur="!newRuneTitle.trim() && emit('update:showCreateForm', false)"
              />
            </div>
          </Transition>
          
          <!-- Tree items -->
          <template v-if="treeItems.length > 0">
            <button
              v-for="item in treeItems"
              :key="item.rune.uuid"
              :class="[
                'item',
                { 
                  'is-active': item.rune.uuid === currentRuneId && !item.isDirectory,
                  'is-directory-selected': item.isDirectory && selectedDirectory === item.rune.title,
                  'is-temp': item.rune.uuid === 'temp-new-file' || item.rune.uuid === 'temp-new-directory',
                  'is-directory': item.isDirectory,
                  'is-expanded': item.isDirectory && expandedDirectories.has(item.rune.title)
                }
              ]"
              :style="{ paddingLeft: (0.5 + item.level * 1) + 'rem' }"
              @click="handleItemClick(item)"
              :disabled="item.rune.uuid === 'temp-new-file' || item.rune.uuid === 'temp-new-directory'"
            >
              <svg 
                v-if="item.isDirectory"
                class="item-icon chevron-icon" 
                :class="{ 'is-expanded': expandedDirectories.has(item.rune.title) }"
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span 
                v-else
                class="item-icon chevron-spacer"
              ></span>
              <svg 
                v-if="item.isDirectory"
                class="item-icon directory-icon" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <svg 
                v-else
                class="item-icon" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span class="item-title">{{ item.isDirectory ? getDirectoryName(item.rune) : item.rune.title }}</span>
            </button>
          </template>
          <div v-else-if="showSearchForm && searchQuery.trim()" class="empty-search">
            <span>No files found</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 17.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-background);
  border-right: 1px solid var(--color-overlay-border);
}

/* Header */
.header {
  flex-shrink: 0;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-overlay-border);
  background: var(--color-overlay-subtle);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-accent);
  margin: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: var(--font-primary);
  opacity: 0.8;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.action-button {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  transition: all 0.1s ease;
  border-radius: 3px;
  opacity: 0.7;
  flex-shrink: 0;
}

.action-button:hover {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  opacity: 1;
}

.action-button:active {
  background: var(--color-overlay-medium);
}

/* List */
.list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--color-overlay-border) transparent;
}

.list::-webkit-scrollbar {
  width: 2px;
}

.list::-webkit-scrollbar-track {
  background: transparent;
}

.list::-webkit-scrollbar-thumb {
  background: var(--color-overlay-border);
  border-radius: 4px;
}

.list::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-hover);
}

.list-content {
  position: relative;
  min-height: 0;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: var(--color-accent);
  font-size: 0.8125rem;
  opacity: 0.6;
  font-family: var(--font-primary);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

/* Fade transition for empty state */
.fade-enter-active {
  transition: opacity 0.2s ease;
}

.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.items {
  display: flex;
  flex-direction: column;
  padding: 0.125rem 0;
}

/* Create Item (inline in list) */
.create-item {
  padding: 0.25rem 0.5rem;
  display: flex;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
}

.create-input-inline {
  width: 100%;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--color-overlay-border);
  border-radius: 2px;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  font-family: var(--font-primary);
  outline: none;
  transition: all 0.1s ease;
}

.create-input-inline::placeholder {
  color: var(--color-accent);
  opacity: 0.6;
}

.create-input-inline:focus {
  border-color: var(--color-foreground);
  background: var(--color-overlay-subtle);
}

.create-input-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Create Input Transition */
.create-input-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.2s ease, padding 0.2s ease, margin 0.2s ease;
}

.create-input-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease, max-height 0.15s ease, padding 0.15s ease, margin 0.15s ease;
}

.create-input-enter-from {
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.98);
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}

.create-input-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 3rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  margin-top: 0;
  margin-bottom: 0;
}

.create-input-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 3rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  margin-top: 0;
  margin-bottom: 0;
}

.create-input-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.98);
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}

/* Item */
.item {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition: background-color 0.1s ease;
  text-align: left;
  font-family: var(--font-primary);
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.75rem;
}

.item:hover {
  background: var(--color-overlay-light);
}

.item.is-active {
  background: var(--color-overlay-medium);
}

.item.is-temp {
  opacity: 0.6;
  cursor: default;
}

.item.is-temp:hover {
  background: transparent;
}

.empty-search {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: var(--color-accent);
  font-size: 0.8125rem;
  opacity: 0.6;
  font-family: var(--font-primary);
}

.item-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-accent);
  opacity: 0.7;
  flex-shrink: 0;
}

.item.is-active .item-icon {
  opacity: 1;
  color: var(--color-foreground);
}

.item.is-directory {
  cursor: pointer;
}

.item.is-directory:hover {
  background: var(--color-overlay-light);
}

.directory-icon {
  color: var(--color-accent);
  opacity: 0.8;
}

.chevron-icon {
  width: 0.6rem;
  height: 0.6rem;
  color: var(--color-accent);
  opacity: 0.6;
  margin-right: 0.125rem;
  transition: transform 0.15s ease;
  transform: rotate(-90deg);
}

.chevron-icon.is-expanded {
  transform: rotate(0deg);
}

.chevron-spacer {
  width: 0.6rem;
  height: 0.6rem;
  margin-right: 0.125rem;
  flex-shrink: 0;
}

.item.is-directory-selected {
  background: var(--color-overlay-medium);
}

.item.is-directory-selected:hover {
  background: var(--color-overlay-medium);
}

.item-title {
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--color-foreground);
  letter-spacing: -0.01em;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
</style>
