<script lang="ts" setup>
import CodexTabs, { type Tab } from './CodexTabs.vue'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  isPreviewMode: boolean
  rightSidebarCollapsed: boolean
}

interface Emits {
  (e: 'tabClick', tab: Tab): void
  (e: 'tabClose', tab: Tab): void
  (e: 'update:tabs', tabs: Tab[]): void
  (e: 'togglePreview'): void
  (e: 'toggleRightSidebar'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
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
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  height: 3.5rem;
  min-height: 3.5rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
  background: transparent;
}

.top-bar-left {
  display: flex;
  align-items: flex-end;
  gap: 0;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.top-bar-right {
  display: flex;
  align-items: center;
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
  border-radius: 0.375rem;
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
