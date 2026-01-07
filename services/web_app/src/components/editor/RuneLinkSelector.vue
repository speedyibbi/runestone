<script setup lang="ts">
import { computed } from 'vue'
import type { EditorView } from '@codemirror/view'
import type { RuneInfo } from '@/composables/useCodex'
import EditorAutocomplete, { type AutocompleteOption } from '@/components/editor/EditorAutocomplete.vue'

interface Props {
  runes: RuneInfo[]
  isDirectory: (title: string) => boolean
  visible: boolean
  editorView: EditorView | null
  position?: { top: number; left: number }
  searchQuery?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [rune: RuneInfo]
  close: []
  hover: []
  leave: []
}>()

// Get display title split into path and name (like CommandPalette)
function getDisplayTitle(title: string): { path: string; name: string } {
  if (!title.includes('/')) {
    return { path: '', name: title }
  }

  const parts = title.split('/').filter((p) => p)
  const name = parts[parts.length - 1]
  const path = parts.slice(0, -1).join('/') + '/'

  return { path, name }
}

// Filter runes based on search query from editor
const filteredRunes = computed(() => {
  const query = (props.searchQuery || '').toLowerCase().trim()
  
  if (!query) {
    return props.runes.filter((rune) => !props.isDirectory(rune.title))
  }

  return props.runes.filter((rune) => {
    if (props.isDirectory(rune.title)) return false
    const title = rune.title.toLowerCase()
    return title.includes(query)
  })
})

// Convert runes to autocomplete options
const autocompleteOptions = computed<AutocompleteOption<RuneInfo>[]>(() => {
  return filteredRunes.value.map((rune) => ({
    id: rune.uuid,
    data: rune,
    render: (rune: RuneInfo) => getDisplayTitle(rune.title),
  }))
})

// Handle option selection
function handleSelect(option: AutocompleteOption<RuneInfo>) {
  emit('select', option.data)
  // Close is handled by EditorAutocomplete
}
</script>

<template>
  <EditorAutocomplete
    :options="autocompleteOptions"
    :visible="visible"
    :editor-view="editorView"
    :position="position"
    :search-query="searchQuery"
    @select="handleSelect"
    @close="emit('close')"
    @hover="emit('hover')"
    @leave="emit('leave')"
  >
    <template #option="{ option }">
      <div class="rune-item-content">
        <span
          v-if="getDisplayTitle(option.data.title).path"
          class="rune-item-path"
        >
          {{ getDisplayTitle(option.data.title).path }}
        </span>
        <span class="rune-item-name">
          {{ getDisplayTitle(option.data.title).name }}
        </span>
      </div>
    </template>
  </EditorAutocomplete>
</template>

<style scoped>
.rune-item-content {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  width: 100%;
  overflow: hidden;
}

.rune-item-path {
  color: var(--color-muted);
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.5;
  font-weight: 400;
  flex-shrink: 0;
}

.rune-item-name {
  color: var(--color-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* Highlighted state - override autocomplete styles */
:deep(.editor-autocomplete-item-highlighted) .rune-item-name {
  color: var(--color-accent);
}
</style>
