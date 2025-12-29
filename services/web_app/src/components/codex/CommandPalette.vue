<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Modal from '@/components/base/Modal.vue'
import type { RuneInfo } from '@/composables/useCodex'

interface Props {
  show: boolean
  runes: RuneInfo[]
  isDirectory: (runeTitle: string) => boolean
  codexTitle?: string | null
}

interface Emits {
  (e: 'update:show', show: boolean): void
  (e: 'select', runeId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement>()

const filteredRunes = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.runes.filter((rune) => !props.isDirectory(rune.title)).slice(0, 10)
  }

  const query = searchQuery.value.toLowerCase().trim()
  const results: Array<{ rune: RuneInfo; score: number }> = []

  for (const rune of props.runes) {
    // Skip directories
    if (props.isDirectory(rune.title)) continue

    const title = rune.title.toLowerCase()
    const parts = rune.title.split('/')
    const fileName = parts[parts.length - 1].toLowerCase()

    let score = 0

    // Exact match gets highest score
    if (title === query) {
      score = 1000
    }
    // Starts with query
    else if (title.startsWith(query)) {
      score = 500
    }
    // Filename starts with query
    else if (fileName.startsWith(query)) {
      score = 400
    }
    // Contains query
    else if (title.includes(query)) {
      score = 300
    }
    // Filename contains query
    else if (fileName.includes(query)) {
      score = 200
    }
    // Fuzzy match (all characters in order)
    else if (isFuzzyMatch(query, title)) {
      score = 100
    }

    if (score > 0) {
      results.push({ rune, score })
    }
  }

  // Sort by score (descending), then by title
  return results
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      return a.rune.title.localeCompare(b.rune.title)
    })
    .slice(0, 10)
    .map((r) => r.rune)
})

function isFuzzyMatch(query: string, text: string): boolean {
  let queryIndex = 0
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      queryIndex++
    }
  }
  return queryIndex === query.length
}

const displayRunes = computed(() => filteredRunes.value)

watch(
  () => props.show,
  (show) => {
    if (show) {
      searchQuery.value = ''
      selectedIndex.value = 0
      // Wait for modal to fully open, then focus input
      nextTick(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            inputRef.value?.focus()
          }, 50)
        })
      })
    }
  },
)

watch(displayRunes, (newRunes, oldRunes) => {
  // Only adjust index if list actually changed and index is out of bounds
  if (newRunes.length !== oldRunes?.length || selectedIndex.value >= newRunes.length) {
    if (newRunes.length === 0) {
      selectedIndex.value = 0
    } else if (selectedIndex.value >= newRunes.length) {
      selectedIndex.value = Math.max(0, newRunes.length - 1)
    }
  }
})

function handleKeydown(event: KeyboardEvent) {
  if (!props.show) return

  // Handle arrow keys and enter
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
    // Always prevent default for these keys
    event.preventDefault()
    event.stopPropagation()

    const currentLength = displayRunes.value.length
    if (currentLength === 0) return

    // Ensure selectedIndex is within valid bounds
    if (selectedIndex.value < 0) selectedIndex.value = 0
    if (selectedIndex.value >= currentLength) selectedIndex.value = currentLength - 1

    if (event.key === 'ArrowDown') {
      // Move down, wrap to top if at bottom
      if (selectedIndex.value < currentLength - 1) {
        selectedIndex.value = selectedIndex.value + 1
      } else {
        selectedIndex.value = 0 // Wrap to top
      }
    } else if (event.key === 'ArrowUp') {
      // Move up, wrap to bottom if at top
      if (selectedIndex.value > 0) {
        selectedIndex.value = selectedIndex.value - 1
      } else {
        selectedIndex.value = currentLength - 1 // Wrap to bottom
      }
    } else if (event.key === 'Enter') {
      // Clamp index to valid range before selecting
      const clampedIndex = Math.max(0, Math.min(selectedIndex.value, currentLength - 1))
      if (displayRunes.value[clampedIndex]) {
        handleSelect(displayRunes.value[clampedIndex].uuid)
      }
    }
    return
  }
}

function handleSelect(runeId: string) {
  emit('select', runeId)
  close()
}

function close() {
  emit('update:show', false)
}

function handleModalCancel() {
  close()
}

function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) {
    // Try fuzzy highlighting
    return text
  }

  const before = text.substring(0, index)
  const match = text.substring(index, index + query.length)
  const after = text.substring(index + query.length)

  return `${before}<mark>${match}</mark>${after}`
}

function getDisplayTitle(title: string): { path: string; name: string } {
  if (!title.includes('/')) {
    return { path: '', name: title }
  }

  const parts = title.split('/').filter((p) => p)
  const name = parts[parts.length - 1]
  const path = parts.slice(0, -1).join('/') + '/'

  return { path, name }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Modal
    :show="show"
    title=""
    :max-width="'36rem'"
    :confirm-text="''"
    :cancel-text="''"
    @update:show="emit('update:show', $event)"
    @cancel="handleModalCancel"
  >
    <template #default>
      <div class="command-palette-container">
        <div class="command-palette-search">
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            class="command-palette-input"
            :placeholder="codexTitle ? `Search in ${codexTitle}...` : 'Search...'"
            autocomplete="off"
            spellcheck="false"
            @keydown="handleKeydown"
          />
        </div>
        <div v-if="displayRunes.length > 0" class="command-palette-results">
          <button
            v-for="(rune, index) in displayRunes"
            :key="rune.uuid"
            :class="['command-palette-item', { selected: index === selectedIndex }]"
            @click="handleSelect(rune.uuid)"
            @mouseenter="selectedIndex = index"
          >
            <div class="command-palette-item-content">
              <span
                v-if="getDisplayTitle(rune.title).path"
                class="command-palette-item-path"
                v-html="highlightMatch(getDisplayTitle(rune.title).path, searchQuery)"
              />
              <span
                class="command-palette-item-filename"
                v-html="highlightMatch(getDisplayTitle(rune.title).name, searchQuery)"
              />
            </div>
          </button>
        </div>
        <div v-else-if="searchQuery.trim()" class="command-palette-empty">
          <span>No match</span>
        </div>
        <div v-else class="command-palette-empty">
          <span>Start typing to search...</span>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
:deep(.modal-dialog) {
  margin: 0 !important;
  margin-top: 1.5rem !important;
  padding: 0;
  inset: 0;
  top: 1.5rem !important;
  left: 50% !important;
  right: auto !important;
  bottom: auto !important;
  transform: translateX(-50%) !important;
  max-width: 36rem;
  width: calc(100% - 4rem);
  height: fit-content;
  max-height: calc(100vh - 3rem);
}

:deep(.modal-container) {
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--color-modal-shadow);
}

:deep(.modal-header) {
  display: none;
}

:deep(.modal-body) {
  padding: 0;
  max-height: calc(100vh - 6rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.command-palette-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 12rem;
  max-height: calc(100vh - 6rem);
}

.command-palette-search {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.search-icon {
  color: var(--color-muted);
  flex-shrink: 0;
  opacity: 0.5;
}

.command-palette-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-foreground);
  font-size: 0.9375rem;
  font-family: var(--font-primary);
  padding: 0;
  font-weight: 400;
}

.command-palette-input::placeholder {
  color: var(--color-muted);
  opacity: 0.4;
}

.command-palette-input:focus {
  outline: none;
}

.command-palette-results {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.25rem;
  min-height: 0;
  max-height: calc(100vh - 10rem);
}

.command-palette-item {
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  padding: 0.375rem 0.75rem;
  margin: 0.125rem 0;
  cursor: pointer;
  transition: background-color 0.08s ease;
  color: var(--color-foreground);
  display: block;
  border-radius: 6px;
}

.command-palette-item:hover {
  background: var(--color-overlay-subtle);
}

.command-palette-item.selected {
  background: var(--color-overlay-subtle);
}

.command-palette-item-content {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  line-height: 1.4;
}

.command-palette-item-path {
  color: var(--color-muted);
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.5;
  font-weight: 400;
}

.command-palette-item-filename {
  color: var(--color-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  font-weight: 400;
}

.command-palette-item-content :deep(mark) {
  background: transparent;
  color: var(--color-foreground);
  padding: 0;
  font-weight: 500;
}

.command-palette-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: var(--color-muted);
  text-align: center;
  font-size: 0.875rem;
  opacity: 0.4;
}

/* Scrollbar styling */
.command-palette-results::-webkit-scrollbar {
  width: 8px;
}

.command-palette-results::-webkit-scrollbar-track {
  background: transparent;
}

.command-palette-results::-webkit-scrollbar-thumb {
  background: var(--color-overlay-medium);
  border-radius: 4px;
}

.command-palette-results::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-strong);
}
</style>
