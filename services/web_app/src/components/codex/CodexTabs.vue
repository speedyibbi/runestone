<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

export interface Tab {
  id: string
  runeId?: string
  title: string
  hasUnsavedChanges: boolean
}

interface Props {
  tabs: Tab[]
  activeTabId: string | null
}

interface Emits {
  (e: 'tabClick', tab: Tab): void
  (e: 'tabClose', tab: Tab): void
  (e: 'update:tabs', tabs: Tab[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const draggedTabId = ref<string | null>(null)
const draggedOverTabId = ref<string | null>(null)
const isDragging = ref(false)
const isDraggingAfterLast = ref(false)
const tabsContainerRef = ref<HTMLElement | null>(null)
const showFadeRight = ref(false)
let resizeObserver: ResizeObserver | null = null

function checkScrollable() {
  if (tabsContainerRef.value) {
    const container = tabsContainerRef.value
    showFadeRight.value = container.scrollWidth > container.clientWidth
  }
}

onMounted(() => {
  checkScrollable()
  if (tabsContainerRef.value) {
    tabsContainerRef.value.addEventListener('scroll', checkScrollable)
    // Watch for resize
    resizeObserver = new ResizeObserver(checkScrollable)
    resizeObserver.observe(tabsContainerRef.value)
  }
})

onUnmounted(() => {
  if (tabsContainerRef.value) {
    tabsContainerRef.value.removeEventListener('scroll', checkScrollable)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// Watch for tabs changes to update scrollable state
watch(
  () => props.tabs,
  () => {
    nextTick(() => {
      checkScrollable()
    })
  },
  { deep: true },
)

function handleTabDragStart(event: DragEvent, tabId: string) {
  isDragging.value = true
  draggedTabId.value = tabId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
  }
}

function handleTabDragOver(event: DragEvent, tabId: string) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  if (draggedTabId.value && draggedTabId.value !== tabId) {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    if (event.clientX < midpoint) {
      draggedOverTabId.value = tabId
      isDraggingAfterLast.value = false
    } else {
      const currentIndex = props.tabs.findIndex((t) => t.id === tabId)
      const nextTab = props.tabs[currentIndex + 1]
      if (nextTab) {
        draggedOverTabId.value = nextTab.id
        isDraggingAfterLast.value = false
      } else {
        draggedOverTabId.value = null
        isDraggingAfterLast.value = true
      }
    }
  }
}

function handleTabDrop(event: DragEvent, targetTabId: string) {
  event.preventDefault()
  if (!draggedTabId.value || draggedTabId.value === targetTabId) {
    draggedTabId.value = null
    draggedOverTabId.value = null
    isDraggingAfterLast.value = false
    isDragging.value = false
    return
  }

  const draggedIndex = props.tabs.findIndex((t) => t.id === draggedTabId.value)

  if (draggedIndex === -1) {
    draggedTabId.value = null
    draggedOverTabId.value = null
    isDraggingAfterLast.value = false
    isDragging.value = false
    return
  }

  let insertIndex: number

  if (isDraggingAfterLast.value) {
    insertIndex = props.tabs.length
  } else {
    const targetIndex = props.tabs.findIndex((t) => t.id === targetTabId)
    if (targetIndex === -1) {
      draggedTabId.value = null
      draggedOverTabId.value = null
      isDraggingAfterLast.value = false
      isDragging.value = false
      return
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    insertIndex = event.clientX < midpoint ? targetIndex : targetIndex + 1
  }

  const newTabs = [...props.tabs]
  const [draggedTab] = newTabs.splice(draggedIndex, 1)
  const finalIndex = draggedIndex < insertIndex ? insertIndex - 1 : insertIndex
  newTabs.splice(finalIndex, 0, draggedTab)
  emit('update:tabs', newTabs)

  draggedTabId.value = null
  draggedOverTabId.value = null
  isDraggingAfterLast.value = false
  setTimeout(() => {
    isDragging.value = false
  }, 100)
}

function handleTabDragEnd() {
  draggedTabId.value = null
  draggedOverTabId.value = null
  isDraggingAfterLast.value = false
  setTimeout(() => {
    isDragging.value = false
  }, 100)
}

function handleContainerDragOver(event: DragEvent) {
  if (!draggedTabId.value) return

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  const container = event.currentTarget as HTMLElement
  const tabs = container.querySelectorAll('.tab')
  if (tabs.length === 0) return

  const lastTab = tabs[tabs.length - 1] as HTMLElement
  const lastTabRect = lastTab.getBoundingClientRect()

  if (event.clientX > lastTabRect.right) {
    draggedOverTabId.value = null
    isDraggingAfterLast.value = true
  }
}

function handleContainerDrop(event: DragEvent) {
  if (!draggedTabId.value || !isDraggingAfterLast.value) return

  event.preventDefault()

  const draggedIndex = props.tabs.findIndex((t) => t.id === draggedTabId.value)
  if (draggedIndex === -1) return

  const newTabs = [...props.tabs]
  const [draggedTab] = newTabs.splice(draggedIndex, 1)
  newTabs.push(draggedTab)
  emit('update:tabs', newTabs)

  draggedTabId.value = null
  draggedOverTabId.value = null
  isDraggingAfterLast.value = false
  setTimeout(() => {
    isDragging.value = false
  }, 100)
}

function handleTabClick(tab: Tab) {
  if (isDragging.value) return
  emit('tabClick', tab)
}

function handleTabClose(event: MouseEvent, tab: Tab) {
  event.stopPropagation()
  emit('tabClose', tab)
}
</script>

<template>
  <div
    ref="tabsContainerRef"
    class="document-tabs"
    @dragover="handleContainerDragOver"
    @drop="handleContainerDrop"
  >
    <TransitionGroup name="tab" tag="div" class="tabs-container">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="tab"
        :class="{
          active: tab.id === activeTabId,
          dragging: tab.id === draggedTabId,
          'drag-over': tab.id === draggedOverTabId,
        }"
        draggable="true"
        @dragstart="handleTabDragStart($event, tab.id)"
        @dragover="handleTabDragOver($event, tab.id)"
        @drop="handleTabDrop($event, tab.id)"
        @dragend="handleTabDragEnd"
        @click="handleTabClick(tab)"
      >
        <span class="tab-title">{{ tab.title || 'Untitled' }}</span>
        <span v-if="tab.hasUnsavedChanges" class="tab-dot"></span>
        <button class="tab-close" title="Close" @click.stop="handleTabClose($event, tab)">
          <svg
            xmlns="http://www.w3.org/2000/svg"
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
    </TransitionGroup>
    <div v-if="showFadeRight" class="tabs-fade-right"></div>
  </div>
</template>

<style scoped>
.document-tabs {
  display: flex;
  align-items: flex-end;
  gap: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
  min-width: 0;
  position: relative;
  scroll-behavior: smooth;
}

.document-tabs::-webkit-scrollbar {
  display: none;
}

.tabs-fade-right {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 2rem;
  background: linear-gradient(to right, transparent, var(--color-background));
  pointer-events: none;
  opacity: 0.8;
  z-index: 1;
}

.tabs-container {
  display: flex;
  align-items: flex-end;
  gap: 0;
  height: 100%;
  position: relative;
  width: max-content;
  min-width: 100%;
}

.document-tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-overlay-subtle);
  cursor: grab;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-muted);
  position: relative;
  font-weight: 400;
  letter-spacing: -0.01em;
  min-width: 6.25rem;
  max-width: 11.25rem;
  user-select: none;
  height: 2rem;
}

.tab::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-foreground);
  transform: scaleX(0);
  transition: transform 0.15s ease;
}

.tab:hover {
  color: var(--color-foreground);
  background: var(--color-overlay-subtle);
}

.tab:hover::after {
  transform: scaleX(1);
}

.tab.active {
  color: var(--color-foreground);
  background: transparent;
  border-bottom-color: transparent;
}

.tab.active::after {
  transform: scaleX(1);
}

.tab.dragging {
  opacity: 0.5;
  cursor: grabbing;
  transition: opacity 0.15s ease !important;
}

.tab.drag-over {
  transform: translateX(0.25rem);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

.tab-dot {
  width: 0.3125rem;
  height: 0.3125rem;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
  opacity: 0.8;
}

.tab-close {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s ease;
  opacity: 0;
  margin-left: 0.25rem;
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}

.tab:hover .tab-close {
  opacity: 0.6;
}

.tab-close:hover {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  opacity: 1;
}

.tab-close svg {
  width: 100%;
  height: 100%;
}

/* Tab enter/leave animations */
.tab-enter-active {
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    padding-right 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute !important;
  z-index: 0;
  pointer-events: none;
}

.tab-enter-from {
  opacity: 0;
  transform: translateX(-0.75rem) scale(0.96);
}

.tab-leave-to {
  opacity: 0;
  transform: translateX(0.5rem) scale(0.98);
  max-width: 0 !important;
  min-width: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  overflow: hidden;
  margin: 0;
}

.tab-enter-to,
.tab-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.tab-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
