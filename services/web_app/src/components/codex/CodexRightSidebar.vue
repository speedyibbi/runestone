<script lang="ts" setup>
import FadeTransition from '@/components/base/FadeTransition.vue'

export interface Heading {
  level: number
  text: string
  position: number
  line: number
}

interface Props {
  collapsed: boolean
  headings: Heading[]
}

interface Emits {
  (e: 'update:collapsed', value: boolean): void
  (e: 'headingClick', heading: Heading): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <aside class="right-sidebar" :class="{ collapsed }">
    <div class="sidebar-header">
      <div class="sidebar-title">
        <h3>Outline</h3>
      </div>
      <button class="sidebar-toggle" @click="emit('update:collapsed', true)" title="Close Outline">
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
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <FadeTransition>
      <div v-if="!collapsed" class="sidebar-content">
        <div class="sidebar-section">
          <div v-if="headings.length === 0" class="empty-headings">
            <p>No headings found</p>
          </div>
          <div v-else class="headings-list">
            <button
              v-for="(heading, index) in headings"
              :key="index"
              class="heading-item"
              :class="`heading-level-${heading.level}`"
              @click="emit('headingClick', heading)"
            >
              <span class="heading-text">{{ heading.text }}</span>
            </button>
          </div>
        </div>
      </div>
    </FadeTransition>
  </aside>
</template>

<style scoped>
.right-sidebar {
  width: 15rem;
  min-width: 11.25rem;
  max-width: 20rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-left: 1px solid var(--color-overlay-subtle);
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.right-sidebar.collapsed {
  width: 0;
  min-width: 0;
  max-width: 0;
  border-left: none;
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

.sidebar-title h3 {
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

.sidebar-section {
  margin-bottom: 2rem;
}

.headings-list {
  padding: 0 0.5rem;
}

.heading-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  cursor: pointer;
  padding: 0.5rem 0.875rem;
  margin: 0.0625rem 0;
  border-radius: 0.375rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.8125rem;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.heading-item:hover {
  background: var(--color-overlay-subtle);
}

.heading-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.5;
}

.heading-level-1 {
  padding-left: 0.875rem;
  font-weight: 600;
}

.heading-level-2 {
  padding-left: 1.5rem;
  font-weight: 500;
}

.heading-level-3 {
  padding-left: 2.125rem;
  font-weight: 400;
}

.heading-level-4 {
  padding-left: 2.75rem;
  font-weight: 400;
  font-size: 0.75rem;
}

.heading-level-5 {
  padding-left: 3.375rem;
  font-weight: 400;
  font-size: 0.75rem;
}

.heading-level-6 {
  padding-left: 4rem;
  font-weight: 400;
  font-size: 0.75rem;
}

.empty-headings {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.6;
}
</style>
