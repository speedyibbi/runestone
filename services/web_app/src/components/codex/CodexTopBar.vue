<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import CodexTabs, { type Tab } from '@/components/codex/CodexTabs.vue'
import CommandPalette from '@/components/codex/CommandPalette.vue'
import type { RuneInfo } from '@/composables/useCodex'
import type { PreviewMode } from '@/composables/useEditor'
import type { SearchServiceResult, SearchOptions } from '@/interfaces/search'

const isSyncEnabled = __APP_CONFIG__.global.featureFlags.sync

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  previewMode: PreviewMode
  rightSidebarCollapsed: boolean
  codexTitle: string | null
  modelValue?: boolean
  canNavigateBack: boolean
  canNavigateForward: boolean
  runes: RuneInfo[]
  isDirectory: (runeTitle: string) => boolean
  searchRunes: (query: string, options?: SearchOptions) => Promise<SearchServiceResult>
  isSyncing?: boolean
}

interface Emits {
  (e: 'tabClick', tab: Tab): void
  (e: 'tabClose', tab: Tab): void
  (e: 'update:tabs', tabs: Tab[]): void
  (e: 'togglePreview'): void
  (e: 'toggleRightSidebar'): void
  (e: 'openRune', runeId: string): void
  (e: 'update:modelValue', value: boolean): void
  (e: 'navigateBack'): void
  (e: 'navigateForward'): void
  (e: 'command', command: string): void
  (e: 'exportRune'): void
  (e: 'exportCodex'): void
  (e: 'sync'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  isSyncing: false,
})

const emit = defineEmits<Emits>()

const showCommandPalette = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const shortcutKey = computed(() => {
  if (typeof navigator !== 'undefined') {
    return navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac')
      ? '⌘P'
      : 'Ctrl+P'
  }
  return 'Ctrl+P'
})

function handleCommandPaletteSelect(runeId: string) {
  emit('openRune', runeId)
}

function handleCommandPaletteCommand(command: string) {
  emit('command', command)
}

function getPreviewButtonTitle(): string {
  if (props.previewMode === 'preview') {
    return 'Switch to Split View'
  } else if (props.previewMode === 'split') {
    return 'Switch to Edit Mode'
  } else {
    return 'Switch to Preview Mode'
  }
}

const showExportDropdown = ref(false)
const exportButtonRef = ref<HTMLElement | null>(null)
const exportDropdownRef = ref<HTMLElement | null>(null)

function toggleExportDropdown() {
  showExportDropdown.value = !showExportDropdown.value
}

function handleExportRune() {
  emit('exportRune')
  showExportDropdown.value = false
}

function handleExportCodex() {
  emit('exportCodex')
  showExportDropdown.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (
    exportButtonRef.value &&
    exportDropdownRef.value &&
    !exportButtonRef.value.contains(event.target as Node) &&
    !exportDropdownRef.value.contains(event.target as Node)
  ) {
    showExportDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="top-bar">
    <div class="top-bar-left">
      <CodexTabs
        :tabs="tabs"
        :active-tab-id="activeTabId"
        @tab-click="emit('tabClick', $event)"
        @tab-close="emit('tabClose', $event)"
        @update:tabs="emit('update:tabs', $event)"
      />
    </div>
    <div class="top-bar-center">
      <div class="history-buttons">
        <button
          class="history-button"
          :class="{ disabled: !canNavigateBack }"
          :disabled="!canNavigateBack"
          @click="emit('navigateBack')"
          title="Go back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
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
        <button
          class="history-button"
          :class="{ disabled: !canNavigateForward }"
          :disabled="!canNavigateForward"
          @click="emit('navigateForward')"
          title="Go forward"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
      <button
        class="command-palette-trigger"
        @click="showCommandPalette = true"
        title="Search (Ctrl+P / Cmd+P)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span class="command-palette-trigger-text">{{ codexTitle || 'Search...' }}</span>
        <kbd class="command-palette-shortcut">{{ shortcutKey }}</kbd>
      </button>
    </div>
    <div class="top-bar-right">
      <button
        class="icon-button"
        @click="emit('toggleRightSidebar')"
        :class="{ active: !rightSidebarCollapsed }"
        :title="rightSidebarCollapsed ? 'Show Outline' : 'Hide Outline'"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        class="icon-button"
        @click="emit('togglePreview')"
        :class="{ active: previewMode !== 'edit' }"
        :title="getPreviewButtonTitle()"
      >
        <svg
          v-if="previewMode === 'preview'"
          xmlns="http://www.w3.org/2000/svg"
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
          v-else-if="previewMode === 'split'"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
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
      <button
        v-if="isSyncEnabled"
        class="icon-button"
        :class="{ active: isSyncing }"
        :disabled="isSyncing"
        @click="emit('sync')"
        title="Sync Codex"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m17 18-1.535 1.605a5 5 0 0 1-8-1.5" />
          <path d="M17 22v-4h-4" />
          <path d="M20.996 15.251A4.5 4.5 0 0 0 17.495 8h-1.79a7 7 0 1 0-12.709 5.607" />
          <path d="M7 10v4h4" />
          <path d="m7 14 1.535-1.605a5 5 0 0 1 8 1.5" />
        </svg>
      </button>
      <div class="export-dropdown-wrapper">
        <button
          ref="exportButtonRef"
          class="icon-button"
          :class="{ active: showExportDropdown }"
          @click="toggleExportDropdown"
          title="Export"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <Transition name="dropdown-fade">
          <div v-if="showExportDropdown" ref="exportDropdownRef" class="export-dropdown">
            <button class="export-dropdown-item" @click="handleExportRune">Export Rune</button>
            <button class="export-dropdown-item" @click="handleExportCodex">Export Codex</button>
          </div>
        </Transition>
      </div>
    </div>
    <CommandPalette
      v-model:show="showCommandPalette"
      :codex-title="codexTitle"
      :runes="runes"
      :is-directory="isDirectory"
      :search-runes="searchRunes"
      @select="handleCommandPaletteSelect"
      @command="handleCommandPaletteCommand"
    />
  </header>
</template>

<style scoped>
.top-bar {
  display: grid;
  grid-template-columns: 1fr 35% min-content;
  padding: 0;
  height: 3.5rem;
  min-height: 3.5rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
  background: transparent;
}

.top-bar-left {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 0;
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.top-bar-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0 1rem;
  position: relative;
  z-index: 1;
  gap: 0.5rem;
}

.history-buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.history-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s ease;
  opacity: 0.6;
}

.history-button svg {
  width: 0.875rem;
  height: 0.875rem;
}

.history-button:hover:not(.disabled) {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.history-button.disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.command-palette-trigger {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-overlay-subtle);
  border: 1px solid var(--color-overlay-medium);
  border-radius: 6px;
  padding: 0.4rem 0.875rem;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  max-width: 20rem;
  font-size: 0.75rem;
  font-family: var(--font-primary);
  font-weight: 400;
  overflow: hidden;
  min-width: 0;
}

.command-palette-trigger:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
}

.command-palette-trigger svg {
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s ease;
  width: 0.875rem;
  height: 0.875rem;
}

.command-palette-trigger:hover svg {
  opacity: 0.7;
}

.command-palette-trigger-text {
  flex: 1;
  text-align: left;
  opacity: 0.5;
  transition: opacity 0.15s ease;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.command-palette-trigger:hover .command-palette-trigger-text {
  opacity: 0.8;
}

.command-palette-shortcut {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.375rem;
  background: var(--color-overlay-subtle);
  border: 1px solid var(--color-overlay-border);
  border-radius: 4px;
  font-size: 0.675rem;
  font-family: var(--font-code);
  color: var(--color-muted);
  opacity: 0.4;
  min-width: 1.75rem;
  transition: all 0.15s ease;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.command-palette-trigger:hover .command-palette-shortcut {
  opacity: 0.6;
  background: var(--color-overlay-light);
}

.top-bar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-right: 1.5rem;
}

.icon-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
}

.icon-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.icon-button.active {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.export-dropdown-wrapper {
  position: relative;
}

.export-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 1000;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-subtle);
  border-radius: 8px;
  box-shadow: 0 2px 8px -2px var(--color-modal-shadow);
  padding: 0.25rem;
  min-width: 10rem;
}

.export-dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-foreground);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.export-dropdown-item:hover {
  background: var(--color-overlay-subtle);
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.15s ease-in-out,
    transform 0.15s ease-in-out;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button svg {
  width: 1rem;
  height: 1rem;
}
</style>
