<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Loader from '@/components/base/Loader.vue'
import type { RuneInfo } from '@/composables/useCodex'
import type { SearchResult, SearchServiceResult, SearchOptions } from '@/interfaces/search'

interface Props {
  searchRunes?: (query: string, options?: SearchOptions) => Promise<SearchServiceResult>
  isDirectory: (runeTitle: string) => boolean
  codexTitle: string | null
}

interface Emits {
  (e: 'runeClick', rune: RuneInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement>()
const searchQuery = ref('')
const selectedIndex = ref(0)
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const caseSensitive = ref(false)
const exactPhrase = ref(false)

const isFtsEnabled = __APP_CONFIG__.global.featureFlags.ftsSearch

const displayResults = computed(() => {
  // Filter out directories since they can't be opened
  return searchResults.value.filter((result) => !props.isDirectory(result.title))
})

// Format search query to support prefix matching (only if exact phrase is not enabled)
function formatQueryForPrefixMatching(query: string): string {
  // If exact phrase matching is enabled, don't modify the query
  if (exactPhrase.value) {
    return query
  }

  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
  if (terms.length === 0) return ''

  return terms
    .map((term) => {
      if ((term.startsWith('"') && term.endsWith('"')) || term.includes('*')) {
        return term
      }
      return term + '*'
    })
    .join(' ')
}

async function performSearch(query: string) {
  if (!query.trim() || !props.searchRunes) {
    searchResults.value = []
    return
  }

  if (!isFtsEnabled) {
    isSearching.value = false
    return
  }

  isSearching.value = true
  try {
    const formattedQuery = formatQueryForPrefixMatching(query)
    const result = await props.searchRunes(formattedQuery, {
      limit: 50,
      highlight: true,
      caseSensitive: caseSensitive.value,
      exact: exactPhrase.value,
    })
    searchResults.value = result.results
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

watch(searchQuery, (newQuery) => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }

  selectedIndex.value = 0

  if (!newQuery.trim()) {
    searchResults.value = []
    isSearching.value = false
    return
  }

  if (isFtsEnabled && props.searchRunes) {
    isSearching.value = true
    searchResults.value = []

    searchDebounceTimer.value = setTimeout(() => {
      performSearch(newQuery)
    }, 300)
  } else {
    isSearching.value = false
  }
})

watch(displayResults, (newResults, oldResults) => {
  if (newResults.length !== oldResults?.length || selectedIndex.value >= newResults.length) {
    if (newResults.length === 0) {
      selectedIndex.value = 0
    } else if (selectedIndex.value >= newResults.length) {
      selectedIndex.value = Math.max(0, newResults.length - 1)
    }
  }
})

watch(caseSensitive, () => {
  // Retrigger search when case sensitivity changes
  if (searchQuery.value.trim() && props.searchRunes) {
    if (searchDebounceTimer.value) {
      clearTimeout(searchDebounceTimer.value)
    }
    searchDebounceTimer.value = setTimeout(() => {
      performSearch(searchQuery.value)
    }, 100)
  }
})

watch(exactPhrase, () => {
  // Retrigger search when exact phrase matching changes
  if (searchQuery.value.trim() && props.searchRunes) {
    if (searchDebounceTimer.value) {
      clearTimeout(searchDebounceTimer.value)
    }
    searchDebounceTimer.value = setTimeout(() => {
      performSearch(searchQuery.value)
    }, 100)
  }
})

function handleKeydown(event: KeyboardEvent) {
  // Only handle arrow keys here - Enter is handled directly on buttons
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()

    const currentLength = displayResults.value.length
    if (currentLength === 0) return

    if (selectedIndex.value < 0) selectedIndex.value = 0
    if (selectedIndex.value >= currentLength) selectedIndex.value = currentLength - 1

    if (event.key === 'ArrowDown') {
      if (selectedIndex.value < currentLength - 1) {
        selectedIndex.value = selectedIndex.value + 1
      } else {
        selectedIndex.value = 0
      }
      // Focus the selected button when using arrow keys
      nextTick(() => {
        const buttons = document.querySelectorAll('.search-result-item')
        if (buttons[selectedIndex.value]) {
          ;(buttons[selectedIndex.value] as HTMLElement).focus()
        }
      })
    } else if (event.key === 'ArrowUp') {
      if (selectedIndex.value > 0) {
        selectedIndex.value = selectedIndex.value - 1
      } else {
        selectedIndex.value = currentLength - 1
      }
      // Focus the selected button when using arrow keys
      nextTick(() => {
        const buttons = document.querySelectorAll('.search-result-item')
        if (buttons[selectedIndex.value]) {
          ;(buttons[selectedIndex.value] as HTMLElement).focus()
        }
      })
    }
    return
  } else if (event.key === 'Enter') {
    // Only handle Enter if we're in the search input, not on a button
    // (buttons handle their own Enter events)
    if (event.target === inputRef.value) {
      event.preventDefault()
      const currentLength = displayResults.value.length
      if (currentLength > 0 && selectedIndex.value >= 0 && selectedIndex.value < currentLength) {
        handleSelect(displayResults.value[selectedIndex.value])
      }
    }
    return
  }
}

function handleSelect(result: SearchResult) {
  // Create RuneInfo from the search result
  const rune: RuneInfo = {
    uuid: result.uuid,
    title: result.title,
    last_updated: '', // Search results don't include last_updated
  }
  emit('runeClick', rune)
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

// Focus input when panel becomes active
watch(
  () => props.codexTitle,
  () => {
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.focus()
      }
    })
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  nextTick(() => {
    inputRef.value?.focus()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
})
</script>

<template>
  <div class="search-panel">
    <div class="search-input-wrapper">
      <div class="search-input-container">
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search..."
          autocomplete="off"
          spellcheck="false"
          @keydown="handleKeydown"
        />
        <button
          :class="['case-sensitive-button', { active: caseSensitive }]"
          :title="
            caseSensitive ? 'Case-sensitive matching enabled' : 'Case-sensitive matching disabled'
          "
          @click="caseSensitive = !caseSensitive"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <text
              x="2"
              y="14"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="14"
              font-weight="600"
              fill="currentColor"
              text-rendering="optimizeLegibility"
            >
              Aa
            </text>
          </svg>
        </button>
        <button
          :class="['exact-phrase-button', { active: exactPhrase }]"
          :title="exactPhrase ? 'Exact phrase matching enabled' : 'Exact phrase matching disabled'"
          @click="exactPhrase = !exactPhrase"
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
            <path
              d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"
            />
            <path
              d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"
            />
          </svg>
        </button>
      </div>
    </div>
    <div v-if="displayResults.length > 0" class="search-results">
      <button
        v-for="(result, index) in displayResults"
        :key="result.uuid"
        :class="['search-result-item', { selected: index === selectedIndex }]"
        @click="handleSelect(result)"
        @mouseenter="selectedIndex = index"
        @keydown.enter="handleSelect(result)"
      >
        <div class="search-result-content">
          <div class="search-result-header">
            <span
              v-if="getDisplayTitle(result.title).path"
              class="search-result-path"
              v-html="getDisplayTitle(result.title).path"
            />
            <span class="search-result-filename" v-html="getDisplayTitle(result.title).name" />
          </div>
          <div v-if="result.snippet" class="search-result-snippet" v-html="result.snippet" />
        </div>
      </button>
    </div>
    <div v-else-if="isSearching && searchQuery.trim()" class="search-empty">
      <Loader message="Searching..." width="10rem" />
    </div>
    <div v-else-if="searchQuery.trim()" class="search-empty">
      <span>No results found</span>
    </div>
    <div v-else class="search-empty">
      <span>Start typing to search...</span>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.search-input-wrapper {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
  min-width: 0;
}

.search-input-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  width: 100%;
}

.search-input {
  flex: 1;
  min-width: 0;
  background: var(--color-overlay-subtle);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: var(--color-foreground);
  font-size: 0.875rem;
  font-family: var(--font-primary);
  font-weight: 400;
  outline: none;
  transition: all 0.15s ease;
}

.search-input::placeholder {
  color: var(--color-muted);
  opacity: 0.5;
}

.search-input:focus {
  border-color: white;
}

.case-sensitive-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  min-width: 1.75rem;
}

.case-sensitive-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.case-sensitive-button.active {
  background: var(--color-overlay-light);
  color: var(--color-accent);
  opacity: 1;
}

.case-sensitive-button svg {
  width: 0.875rem;
  height: 0.875rem;
}

.exact-phrase-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  min-width: 1.75rem;
}

.exact-phrase-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.exact-phrase-button.active {
  background: var(--color-overlay-light);
  color: var(--color-accent);
  opacity: 1;
}

.exact-phrase-button svg {
  width: 0.875rem;
  height: 0.875rem;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem 0;
  min-height: 0;
}

.search-result-item {
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  padding: 0.5rem 1rem;
  margin: 0.125rem 0;
  cursor: pointer;
  transition: background-color 0.08s ease;
  color: var(--color-foreground);
  display: block;
  border-radius: 0;
}

.search-result-item:hover {
  background: var(--color-overlay-subtle);
}

.search-result-item.selected {
  background: var(--color-overlay-subtle);
}

.search-result-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.search-result-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.search-result-path {
  color: var(--color-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.5;
  font-weight: 400;
}

.search-result-filename {
  color: var(--color-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  font-weight: 400;
}

.search-result-snippet {
  color: var(--color-muted);
  font-size: 0.75rem;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  opacity: 0.7;
}

.search-result-content :deep(mark) {
  background: transparent;
  color: var(--color-foreground);
  padding: 0;
  font-weight: 500;
}

.search-result-snippet :deep(mark) {
  background: transparent;
  color: var(--color-foreground);
  padding: 0;
  font-weight: 500;
  opacity: 1;
}

.search-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  color: var(--color-muted);
  text-align: center;
  font-size: 0.8125rem;
  opacity: 0.5;
}

/* Scrollbar styling */
.search-results::-webkit-scrollbar {
  width: 0.25rem;
}

.search-results::-webkit-scrollbar-track {
  background: transparent;
}

.search-results::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 2px;
}

.search-results::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}
</style>
