<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue'
import type { RuneInfo } from '@/composables/useCodex'

interface Props {
  rune: RuneInfo | null // null for placeholder items
  active: boolean
  isDirectory: boolean
  displayName?: string
  level?: number
  expanded?: boolean
  hasChildren?: boolean
  selected?: boolean
  isEditing?: boolean
  isCreating?: boolean
  parentPath?: string
  dragOver?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  displayName: undefined,
  level: 0,
  expanded: false,
  hasChildren: false,
  selected: false,
  isEditing: false,
  isCreating: false,
  parentPath: '',
  dragOver: false,
})

interface Emits {
  (e: 'click', rune: RuneInfo | null, event?: MouseEvent): void
  (e: 'dblclick', rune: RuneInfo | null): void
  (e: 'contextmenu', event: MouseEvent, rune: RuneInfo | null): void
  (e: 'edit-submit', value: string): void
  (e: 'edit-cancel'): void
  (e: 'drag-start', rune: RuneInfo | null, event: DragEvent): void
  (e: 'drag-end', event: DragEvent): void
  (e: 'drag-over', rune: RuneInfo | null, event: DragEvent): void
  (e: 'drop', rune: RuneInfo | null, event: DragEvent): void
}

const emit = defineEmits<Emits>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement>()

// Debounce click to prevent it from firing on double-click
let clickTimeout: ReturnType<typeof setTimeout> | null = null
const CLICK_DEBOUNCE_MS = 200

function handleClick(event: MouseEvent) {
  if (props.isEditing || props.isCreating) return

  if (clickTimeout) {
    clearTimeout(clickTimeout)
    clickTimeout = null
    return
  }

  clickTimeout = setTimeout(() => {
    emit('click', props.rune, event)
    clickTimeout = null
  }, CLICK_DEBOUNCE_MS)
}

function handleDoubleClick() {
  if (props.isEditing || props.isCreating) return

  if (clickTimeout) {
    clearTimeout(clickTimeout)
    clickTimeout = null
  }
  emit('dblclick', props.rune)
}

watch(
  () => props.isEditing || props.isCreating,
  (isEdit) => {
    if (isEdit) {
      if (props.rune && props.isEditing) {
        // Renaming: extract just the name part (without parent path)
        const fullTitle = props.rune.title
        const name =
          props.parentPath && fullTitle.startsWith(props.parentPath)
            ? fullTitle.slice(props.parentPath.length)
            : fullTitle
        // Remove trailing / for directories
        inputValue.value = props.isDirectory && name.endsWith('/') ? name.slice(0, -1) : name
      } else {
        inputValue.value = ''
      }
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
  { immediate: true },
)

function handleContextMenu(event: MouseEvent, rune: RuneInfo | null) {
  event.preventDefault()
  emit('contextmenu', event, rune)
}

function handleSubmit() {
  const value = inputValue.value.trim()
  if (value) {
    emit('edit-submit', value)
  } else {
    emit('edit-cancel')
  }
}

function handleCancel() {
  emit('edit-cancel')
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
  } else if (event.key === '/') {
    event.preventDefault()
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.value.includes('/')) {
    target.value = target.value.replace(/\//g, '')
    inputValue.value = target.value
  }
}

function handleDragStart(event: DragEvent) {
  if (props.isEditing || props.isCreating || !props.rune) return
  
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', props.rune.uuid)
    // Add a visual indicator
    if (event.dataTransfer.setDragImage) {
      const dragImage = document.createElement('div')
      dragImage.textContent = props.displayName || props.rune.title
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      document.body.appendChild(dragImage)
      event.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => document.body.removeChild(dragImage), 0)
    }
  }
  emit('drag-start', props.rune, event)
}

function handleDragEnd(event: DragEvent) {
  emit('drag-end', event)
}

function handleDragOver(event: DragEvent) {
  // Only allow dropping on directories (not files)
  if (!props.isDirectory || props.isEditing || props.isCreating) {
    return
  }
  
  // Prevent default to allow drop
  event.preventDefault()
  event.stopPropagation()
  
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  
  emit('drag-over', props.rune, event)
}

function handleDrop(event: DragEvent) {
  // Only allow dropping on directories (not files)
  if (!props.isDirectory || props.isEditing || props.isCreating) {
    return
  }
  
  event.preventDefault()
  event.stopPropagation()
  
  emit('drop', props.rune, event)
}
</script>

<template>
  <div
    class="rune-item"
    :class="{
      active,
      directory: isDirectory,
      selected,
      editing: isEditing,
      creating: isCreating,
      'drag-over': dragOver,
    }"
    :style="{ paddingLeft: `${0.875 + level * 1.25}rem` }"
    :title="
      isEditing || isCreating
        ? undefined
        : isDirectory
          ? 'Click to expand/collapse • Double-click to select for creating items'
          : undefined
    "
    :draggable="!isEditing && !isCreating && rune !== null"
    @click="handleClick"
    @dblclick="handleDoubleClick"
    @contextmenu="handleContextMenu($event, rune)"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- Expand/collapse icon for directories - always visible for directories -->
    <span v-if="isDirectory && !isEditing && !isCreating" class="expand-icon">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="{ expanded }"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </span>
    <span v-else class="expand-icon-spacer"></span>
    <span class="rune-icon">
      <svg
        v-if="isDirectory"
        xmlns="http://www.w3.org/2000/svg"
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
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    </span>
    <span v-if="!isEditing && !isCreating" class="rune-title">{{
      displayName || (rune?.title ?? '')
    }}</span>
    <div v-if="isEditing || isCreating" class="rune-input-wrapper">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="rune-input"
        @keydown="handleKeydown"
        @input="handleInput"
        @blur="handleBlur"
      />
    </div>
  </div>
</template>

<style scoped>
.rune-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  margin: 0.0625rem 0;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.01em;
  will-change: transform;
}

.rune-item:hover {
  background: var(--color-overlay-subtle);
}

.rune-item.active {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  font-weight: 500;
}

.rune-item.directory {
  color: var(--color-accent);
  font-weight: 500;
}

.rune-item.selected {
  background: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-selection);
}

.rune-item[draggable='true'] {
  cursor: grab;
}

.rune-item[draggable='true']:active {
  cursor: grabbing;
}

.rune-item.drag-over {
  background: var(--color-overlay-light);
  border: 2px dashed var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-selection);
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 0.75rem;
  height: 0.75rem;
  color: var(--color-muted);
  opacity: 0.6;
  margin-right: 0.25rem;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-icon svg {
  width: 0.75rem;
  height: 0.75rem;
}

.expand-icon svg.expanded {
  transform: rotate(90deg);
}

.expand-icon-spacer {
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.25rem;
  flex-shrink: 0;
}

.rune-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-muted);
  opacity: 0.7;
}

.rune-icon svg {
  width: 100%;
  height: 100%;
}

.rune-item.active .rune-icon {
  color: var(--color-foreground);
  opacity: 1;
}

.rune-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.5;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  min-width: 0;
  height: 1.5em;
  display: flex;
  align-items: center;
}

.rune-input-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 1.5em;
  margin-left: 0;
}

.rune-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  background: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  font-family: inherit;
  font-weight: inherit;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
  height: 1.5em;
}

/* When editing (renaming), no layout shift - input matches text position exactly */
.rune-item.editing .rune-input-wrapper {
  padding: 0;
  margin: 0;
  transition: none;
}

.rune-item.editing .rune-input {
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.rune-item.editing .rune-input:focus {
  background: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  margin: 0;
  box-shadow: 0 0 0 2px var(--color-selection);
  transition: all 0.15s ease;
}

/* When creating, allow smooth transition */
.rune-item.creating .rune-input-wrapper {
  transition: all 0.2s ease;
}

.rune-input:focus {
  box-shadow: 0 0 0 2px var(--color-selection);
}
</style>
