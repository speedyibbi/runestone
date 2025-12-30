<script lang="ts" setup>
import { computed } from 'vue'
import CodexTabs, { type Tab } from './CodexTabs.vue'
import CommandPalette from './CommandPalette.vue'
import type { RuneInfo } from '@/composables/useCodex'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  isPreviewMode: boolean
  rightSidebarCollapsed: boolean
  runes: RuneInfo[]
  isDirectory: (runeTitle: string) => boolean
  codexTitle: string | null
  modelValue?: boolean
  canNavigateBack: boolean
  canNavigateForward: boolean
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
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
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
        <button
          class="history-button"
          :class="{ disabled: !canNavigateForward }"
          :disabled="!canNavigateForward"
          @click="emit('navigateForward')"
          title="Go forward"
        >
          <svg
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
        </button>
      </div>
      <button
        class="command-palette-trigger"
        @click="showCommandPalette = true"
        title="Search (Ctrl+P / Cmd+P)"
      >
        <svg
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
          width="16"
          height="16"
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
        :class="{ active: isPreviewMode }"
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
    <CommandPalette
      v-model:show="showCommandPalette"
      :runes="runes"
      :is-directory="isDirectory"
      :codex-title="codexTitle"
      @select="handleCommandPaletteSelect"
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
</style>
