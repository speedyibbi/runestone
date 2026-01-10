<script setup lang="ts" generic="T">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { EditorView } from '@codemirror/view'

export interface AutocompleteOption<T> {
  id: string | number
  data: T
  render?: (option: T) => string | { path?: string; name: string }
  disabled?: boolean
}

interface Props<T> {
  options: AutocompleteOption<T>[]
  visible: boolean
  editorView: EditorView | null
  position?: { top: number; left: number }
  searchQuery?: string
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props<T>>(), {
  emptyMessage: 'No options available',
})

const emit = defineEmits<{
  select: [option: AutocompleteOption<T>]
  close: []
  hover: []
  leave: []
}>()

const highlightedIndex = ref(0)
const dropdownRef = ref<HTMLDivElement | null>(null)
const computedPosition = ref({ top: 0, left: 0 })

// Expose filtered options (can be overridden by parent via computed)
const filteredOptions = computed(() => props.options)

// Check if a key is a typing character (alphanumeric or common special chars)
function isTypingKey(key: string): boolean {
  if (key.length === 1) {
    const charCode = key.charCodeAt(0)
    return (
      (charCode >= 48 && charCode <= 57) || // 0-9
      (charCode >= 65 && charCode <= 90) || // A-Z
      (charCode >= 97 && charCode <= 122) || // a-z
      charCode === 32 || // space
      (charCode >= 33 && charCode <= 47) || // !"#$%&'()*+,-./
      (charCode >= 58 && charCode <= 64) || // :;<=>?@
      (charCode >= 91 && charCode <= 96) || // [\]^_`
      (charCode >= 123 && charCode <= 126) // {|}~
    )
  }
  return false
}

// Calculate dropdown position - smart positioning like bubble menu
function calculatePosition() {
  if (!props.position) {
    return { top: 0, left: 0 }
  }

  const { top, left } = props.position
  const dropdown = dropdownRef.value

  if (!dropdown) {
    return { top, left }
  }

  const dropdownRect = dropdown.getBoundingClientRect()
  const dropdownWidth = dropdownRect.width || 320
  const dropdownHeight = dropdownRect.height || 200

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const padding = 16

  const viewportTop = top - window.scrollY
  const viewportLeft = left - window.scrollX

  const offsetX = 0
  const offsetY = 4

  let finalTop = top + offsetY
  let finalLeft = left - dropdownWidth / 2

  const viewportFinalTop = finalTop - window.scrollY
  const viewportFinalLeft = finalLeft - window.scrollX

  // Adjust horizontal position
  if (viewportFinalLeft < padding) {
    finalLeft = window.scrollX + padding
  } else if (viewportFinalLeft + dropdownWidth > viewportWidth - padding) {
    finalLeft = window.scrollX + viewportWidth - dropdownWidth - padding
  }

  // Check available space - prefer below
  const spaceBelow = viewportHeight - viewportTop - padding
  const spaceAbove = viewportTop - padding

  if (spaceBelow >= dropdownHeight) {
    finalTop = top
    const viewportBottom = finalTop - window.scrollY + dropdownHeight
    if (viewportBottom > viewportHeight - padding) {
      finalTop = window.scrollY + viewportHeight - dropdownHeight - padding
    }
  } else if (spaceAbove >= dropdownHeight) {
    finalTop = top - dropdownHeight - offsetY * 2
    const viewportTopAbove = finalTop - window.scrollY
    if (viewportTopAbove < padding) {
      finalTop = window.scrollY + padding
    }
  } else {
    if (spaceBelow > spaceAbove) {
      finalTop = top
      const viewportBottom = finalTop - window.scrollY + dropdownHeight
      if (viewportBottom > viewportHeight - padding) {
        finalTop = window.scrollY + viewportHeight - dropdownHeight - padding
      }
    } else {
      finalTop = top - dropdownHeight - offsetY * 2
      const viewportTopAbove = finalTop - window.scrollY
      if (viewportTopAbove < padding) {
        finalTop = window.scrollY + padding
      }
    }
  }

  return { top: finalTop, left: finalLeft }
}

// Update position when visible or position changes
watch(
  [() => props.visible, () => props.position],
  () => {
    if (props.visible) {
      computedPosition.value = calculatePosition()
      nextTick(() => {
        computedPosition.value = calculatePosition()
      })
    }
  },
  { immediate: true },
)

// Reset when dropdown opens/closes
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      highlightedIndex.value = 0
      nextTick(() => {
        computedPosition.value = calculatePosition()
      })
    }
  },
)

// Handle keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
    case 'Tab':
      event.preventDefault()
      emit('close')
      break
    case 'Enter':
      event.preventDefault()
      if (filteredOptions.value.length > 0 && highlightedIndex.value >= 0) {
        const selectedOption = filteredOptions.value[highlightedIndex.value]
        if (selectedOption && !selectedOption.disabled) {
          handleSelect(selectedOption)
        }
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (
        filteredOptions.value.length > 0 &&
        highlightedIndex.value < filteredOptions.value.length - 1
      ) {
        highlightedIndex.value++
        scrollToHighlighted()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (filteredOptions.value.length > 0 && highlightedIndex.value > 0) {
        highlightedIndex.value--
        scrollToHighlighted()
      }
      break
    default:
      if (!isTypingKey(event.key)) {
        emit('close')
      }
      break
  }
}

// Handle option selection
function handleSelect(option: AutocompleteOption<T>) {
  emit('select', option)
  emit('close')
}

// Scroll to highlighted item
function scrollToHighlighted() {
  if (!dropdownRef.value) return

  requestAnimationFrame(() => {
    if (!dropdownRef.value) return
    const listContainer = dropdownRef.value.querySelector(
      '.editor-autocomplete-list',
    ) as HTMLElement
    if (!listContainer) return

    const items = listContainer.querySelectorAll('.editor-autocomplete-item')
    const highlightedItem = items[highlightedIndex.value] as HTMLElement
    if (!highlightedItem) return

    const containerRect = listContainer.getBoundingClientRect()
    const itemRect = highlightedItem.getBoundingClientRect()
    const containerScrollTop = listContainer.scrollTop

    const itemTop = itemRect.top - containerRect.top + containerScrollTop
    const itemBottom = itemTop + itemRect.height
    const visibleTop = containerScrollTop
    const visibleBottom = containerScrollTop + containerRect.height

    if (itemTop < visibleTop) {
      listContainer.scrollTop = itemTop - 8
    } else if (itemBottom > visibleBottom) {
      listContainer.scrollTop = itemBottom - containerRect.height + 8
    }
  })
}

// Reset highlighted index when options change
watch(
  () => filteredOptions.value.length,
  () => {
    highlightedIndex.value = 0
  },
)

// Handle click outside
function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && dropdownRef.value.contains(event.target as Node)) {
    return
  }

  setTimeout(() => {
    if (!props.visible) return
    emit('close')
  }, 50)
}

// Handle Escape key globally
function handleGlobalKeydown(event: KeyboardEvent) {
  if (!props.visible || filteredOptions.value.length === 0) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      emit('close')
    }
    return
  }

  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
    case 'Tab':
      event.preventDefault()
      emit('close')
      break
    case 'ArrowDown':
      event.preventDefault()
      if (highlightedIndex.value < filteredOptions.value.length - 1) {
        highlightedIndex.value++
        scrollToHighlighted()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (highlightedIndex.value > 0) {
        highlightedIndex.value--
        scrollToHighlighted()
      }
      break
    case 'Enter':
      event.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length) {
        const selectedOption = filteredOptions.value[highlightedIndex.value]
        if (selectedOption && !selectedOption.disabled) {
          handleSelect(selectedOption)
        }
      }
      break
    default:
      if (!isTypingKey(event.key)) {
        emit('close')
      }
      break
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  document.addEventListener('keydown', handleGlobalKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleGlobalKeydown, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dropdown">
      <div
        v-if="visible && filteredOptions.length > 0"
        ref="dropdownRef"
        class="editor-autocomplete"
        :style="{
          top: `${computedPosition.top}px`,
          left: `${computedPosition.left}px`,
        }"
        @keydown="handleKeydown"
        @mouseenter="emit('hover')"
        @mouseleave="emit('leave')"
        tabindex="-1"
      >
        <div class="editor-autocomplete-list">
          <button
            v-for="(option, index) in filteredOptions"
            :key="String(option.id)"
            class="editor-autocomplete-item"
            :class="{ 'editor-autocomplete-item-highlighted': index === highlightedIndex }"
            :disabled="option.disabled"
            @click="handleSelect(option)"
            @mouseenter="highlightedIndex = index"
          >
            <slot name="option" :option="option" :index="index">
              <span class="editor-autocomplete-item-label">
                {{
                  typeof option.render === 'function'
                    ? option.render(option.data)
                    : String(option.data)
                }}
              </span>
            </slot>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.editor-autocomplete {
  position: fixed;
  z-index: 2000;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px -2px var(--color-modal-shadow);
  width: 20rem;
  max-height: 25rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-autocomplete-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem;
  max-height: 23.75rem;
  min-height: 0;
}

.editor-autocomplete-item {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--color-foreground);
  font-family: var(--font-primary);
  font-size: 0.875rem;
  outline: none;
  display: block;
}

.editor-autocomplete-item:hover:not(:disabled) {
  background: var(--color-overlay-subtle);
}

.editor-autocomplete-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.editor-autocomplete-item-highlighted:not(:disabled) {
  background: var(--color-overlay-light);
}

.editor-autocomplete-item-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Scrollbar styling */
.editor-autocomplete-list::-webkit-scrollbar {
  width: 0.375rem;
}

.editor-autocomplete-list::-webkit-scrollbar-track {
  background: transparent;
}

.editor-autocomplete-list::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 2px;
}

.editor-autocomplete-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}

/* Dropdown transition */
.dropdown-enter-active {
  animation: dropdownFadeIn 0.15s ease-out;
}

.dropdown-leave-active {
  animation: dropdownFadeOut 0.1s ease-in;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdownFadeOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}
</style>
