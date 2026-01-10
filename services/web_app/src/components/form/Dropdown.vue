<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface Option {
  label: string
  value: string | number
  disabled?: boolean
}

interface Props {
  modelValue: string | number | (string | number)[] | null
  options: Option[]
  placeholder?: string
  multiple?: boolean
  disabled?: boolean
  maxHeight?: string
  maxVisibleItems?: number
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select an option...',
  multiple: false,
  disabled: false,
  maxHeight: '12rem',
  maxVisibleItems: 5,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | (string | number)[] | null]
  change: [value: string | number | (string | number)[] | null]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)
const optionsListRef = ref<HTMLUListElement | null>(null)
const highlightedIndex = ref(-1)

// Compute selected values array for easier handling
const selectedValues = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    return []
  }
  return Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
})

// Compute display text for the trigger button
const displayText = computed(() => {
  if (selectedValues.value.length === 0) {
    return props.placeholder
  }
  if (props.multiple) {
    if (selectedValues.value.length === 1) {
      const option = props.options.find((opt) => opt.value === selectedValues.value[0])
      return option?.label || String(selectedValues.value[0])
    }
    return `${selectedValues.value.length} selected`
  } else {
    const option = props.options.find((opt) => opt.value === selectedValues.value[0])
    return option?.label || String(selectedValues.value[0])
  }
})

// Check if an option is selected
const isSelected = (value: string | number) => {
  return selectedValues.value.includes(value)
}

// Handle option click
function handleOptionClick(option: Option) {
  if (option.disabled) return

  if (props.multiple) {
    const currentValues = [...selectedValues.value]
    const index = currentValues.indexOf(option.value)

    if (index > -1) {
      // Deselect
      currentValues.splice(index, 1)
    } else {
      // Select
      currentValues.push(option.value)
    }

    const newValue = currentValues.length > 0 ? currentValues : null
    emit('update:modelValue', newValue)
    emit('change', newValue)
  } else {
    // Single select
    const newValue = option.value
    emit('update:modelValue', newValue)
    emit('change', newValue)
    isOpen.value = false
  }
}

// Toggle dropdown
function toggleDropdown() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    highlightedIndex.value = -1
    nextTick(() => {
      scrollToHighlighted()
    })
  }
}

// Close dropdown
function closeDropdown() {
  isOpen.value = false
  highlightedIndex.value = -1
}

// Handle keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      if (isOpen.value && highlightedIndex.value >= 0) {
        event.preventDefault()
        const option = props.options[highlightedIndex.value]
        if (option && !option.disabled) {
          handleOptionClick(option)
        }
      } else if (!isOpen.value) {
        event.preventDefault()
        toggleDropdown()
      }
      break
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault()
        closeDropdown()
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (!isOpen.value) {
        toggleDropdown()
      } else {
        highlightNext()
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (isOpen.value) {
        highlightPrevious()
      }
      break
    case 'Tab':
      if (isOpen.value) {
        closeDropdown()
      }
      break
  }
}

// Highlight next option
function highlightNext() {
  const enabledOptions = props.options.filter((opt) => !opt.disabled)
  if (enabledOptions.length === 0) return

  let currentIndex = highlightedIndex.value
  if (currentIndex < 0) {
    currentIndex = 0
  } else {
    const currentOption = props.options[currentIndex]
    if (!currentOption) {
      currentIndex = 0
    } else {
      const currentEnabledIndex = enabledOptions.findIndex(
        (opt) => opt.value === currentOption.value,
      )
      currentIndex = currentEnabledIndex >= 0 ? currentEnabledIndex + 1 : 0
    }
  }

  if (currentIndex >= enabledOptions.length) {
    currentIndex = 0
  }

  const targetOption = enabledOptions[currentIndex]
  if (targetOption) {
    highlightedIndex.value = props.options.findIndex((opt) => opt.value === targetOption.value)
    scrollToHighlighted()
  }
}

// Highlight previous option
function highlightPrevious() {
  const enabledOptions = props.options.filter((opt) => !opt.disabled)
  if (enabledOptions.length === 0) return

  let currentIndex = highlightedIndex.value
  if (currentIndex < 0) {
    currentIndex = enabledOptions.length - 1
  } else {
    const currentOption = props.options[currentIndex]
    if (!currentOption) {
      currentIndex = enabledOptions.length - 1
    } else {
      const currentEnabledIndex = enabledOptions.findIndex(
        (opt) => opt.value === currentOption.value,
      )
      currentIndex = currentEnabledIndex >= 0 ? currentEnabledIndex - 1 : enabledOptions.length - 1
    }
  }

  if (currentIndex < 0) {
    currentIndex = enabledOptions.length - 1
  }

  const targetOption = enabledOptions[currentIndex]
  if (targetOption) {
    highlightedIndex.value = props.options.findIndex((opt) => opt.value === targetOption.value)
    scrollToHighlighted()
  }
}

// Scroll to highlighted option
function scrollToHighlighted() {
  if (!optionsListRef.value || highlightedIndex.value < 0) return

  const optionElements = optionsListRef.value.querySelectorAll('.dropdown-option')
  const highlightedElement = optionElements[highlightedIndex.value] as HTMLElement

  if (highlightedElement) {
    highlightedElement.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }
}

// Handle click outside
function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

// Watch for external changes to close dropdown
watch(
  () => props.modelValue,
  () => {
    if (!props.multiple && isOpen.value) {
      closeDropdown()
    }
  },
)

// Set up event listeners
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="dropdownRef"
    class="dropdown"
    :class="{ 'dropdown-open': isOpen, 'dropdown-disabled': disabled }"
  >
    <button
      type="button"
      class="dropdown-trigger"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="true"
      @click="toggleDropdown"
      @keydown="handleKeydown"
    >
      <span
        class="dropdown-text"
        :class="{
          'dropdown-placeholder': selectedValues.length === 0,
          'dropdown-text-selected': selectedValues.length > 0,
        }"
      >
        {{ displayText }}
      </span>
      <svg
        class="dropdown-icon"
        :class="{ 'dropdown-icon-open': isOpen }"
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
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Transition name="dropdown">
      <ul
        v-if="isOpen"
        ref="optionsListRef"
        class="dropdown-options"
        :style="{ maxHeight: maxHeight }"
        role="listbox"
        :aria-multiselectable="multiple"
      >
        <li
          v-for="(option, index) in options"
          :key="String(option.value)"
          class="dropdown-option"
          :class="{
            'dropdown-option-selected': isSelected(option.value),
            'dropdown-option-highlighted': index === highlightedIndex,
            'dropdown-option-disabled': option.disabled,
          }"
          role="option"
          :aria-selected="isSelected(option.value)"
          :aria-disabled="option.disabled"
          @click="handleOptionClick(option)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="dropdown-option-label">{{ option.label }}</span>
          <svg
            v-if="isSelected(option.value)"
            class="dropdown-option-check"
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
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </li>
        <li v-if="options.length === 0" class="dropdown-option dropdown-option-empty">
          <span class="dropdown-option-label">No options available</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  width: 100%;
  display: inline-block;
}

.dropdown-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0.875rem;
  background: var(--color-overlay-subtle);
  border: 1px solid var(--color-overlay-medium);
  border-radius: 6px;
  color: var(--color-muted);
  font-family: var(--font-primary);
  font-size: 0.75rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
  overflow: hidden;
  min-width: 0;
}

.dropdown-trigger:hover:not(:disabled) {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
}

.dropdown-trigger:hover:not(:disabled) .dropdown-text {
  opacity: 0.8;
}

.dropdown-trigger:hover:not(:disabled) .dropdown-icon {
  opacity: 0.7;
}

.dropdown-trigger:focus-visible {
  outline: none;
  border-color: var(--color-overlay-border);
}

.dropdown-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background-color: var(--color-overlay-subtle);
}

.dropdown-open .dropdown-trigger {
  border-color: var(--color-overlay-border);
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
}

.dropdown-open .dropdown-trigger .dropdown-text {
  opacity: 0.8;
}

.dropdown-text {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.dropdown-placeholder {
  opacity: 0.5;
}

.dropdown-text-selected {
  opacity: 0.8;
}

.dropdown-icon {
  flex-shrink: 0;
  color: var(--color-muted);
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.15s ease;
  opacity: 0.5;
  width: 0.75rem;
  height: 0.75rem;
}

.dropdown-icon-open {
  transform: rotate(180deg);
}

.dropdown-options {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  z-index: 1000;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  background-color: var(--color-background);
  border: 1px solid var(--color-overlay-subtle);
  border-radius: 8px;
  box-shadow: 0 2px 8px -2px var(--color-modal-shadow);
  overflow-y: auto;
  overflow-x: hidden;
  max-height: v-bind(maxHeight);
}

/* Scrollbar styling */
.dropdown-options::-webkit-scrollbar {
  width: 0.25rem;
}

.dropdown-options::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-options::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 2px;
}

.dropdown-options::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}

.dropdown-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.375rem 0.75rem;
  margin: 0.125rem 0;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.08s ease;
  color: var(--color-foreground);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  background: transparent;
}

.dropdown-option:hover:not(.dropdown-option-disabled) {
  background-color: var(--color-overlay-subtle);
}

.dropdown-option-highlighted:not(.dropdown-option-disabled) {
  background-color: var(--color-overlay-subtle);
}

.dropdown-option-selected {
  background-color: var(--color-overlay-subtle);
  color: var(--color-foreground);
}

.dropdown-option-selected.dropdown-option-highlighted {
  background-color: var(--color-overlay-light);
}

.dropdown-option-disabled {
  cursor: not-allowed;
  opacity: 0.5;
  color: var(--color-muted);
}

.dropdown-option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.dropdown-option-check {
  flex-shrink: 0;
  color: var(--color-accent);
  opacity: 0.7;
  width: 0.75rem;
  height: 0.75rem;
}

.dropdown-option-empty {
  cursor: default;
  color: var(--color-muted);
  font-style: italic;
  opacity: 0.4;
}

.dropdown-option-empty:hover {
  background-color: transparent;
}

/* Transition animations */
.dropdown-enter-active {
  animation: dropdownFadeIn 0.1s ease-out;
}

.dropdown-leave-active {
  animation: dropdownFadeOut 0.08s ease-in;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-0.25rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dropdownFadeOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-0.25rem);
  }
}
</style>
