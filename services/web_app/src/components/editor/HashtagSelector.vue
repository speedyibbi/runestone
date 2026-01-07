<script setup lang="ts">
import { computed } from 'vue'
import type { EditorView } from '@codemirror/view'
import EditorAutocomplete, { type AutocompleteOption } from '@/components/editor/EditorAutocomplete.vue'

interface Props {
  hashtags: Map<string, number> // hashtag -> count
  visible: boolean
  editorView: EditorView | null
  position?: { top: number; left: number }
  searchQuery?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [hashtag: string]
  close: []
  hover: []
  leave: []
}>()

// Convert hashtags map to array of {tag, count} for sorting
const hashtagList = computed(() => {
  return Array.from(props.hashtags.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => {
      // Sort by count (descending), then by tag name (ascending)
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.tag.localeCompare(b.tag)
    })
})

// Filter hashtags based on search query from editor
const filteredHashtags = computed(() => {
  const query = (props.searchQuery || '').toLowerCase().trim()
  
  if (!query) {
    return hashtagList.value
  }

  return hashtagList.value.filter(({ tag }) => {
    const tagLower = tag.toLowerCase()
    return tagLower.includes(query)
  })
})

// Convert hashtags to autocomplete options
const autocompleteOptions = computed<AutocompleteOption<{ tag: string; count: number }>[]>(() => {
  return filteredHashtags.value.map(({ tag, count }) => ({
    id: tag,
    data: { tag, count },
    render: () => ({ path: '', name: tag }),
  }))
})

// Handle option selection
function handleSelect(option: AutocompleteOption<{ tag: string; count: number }>) {
  emit('select', option.data.tag)
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
      <div class="hashtag-item-content">
        <span class="hashtag-item-name">#{{ option.data.tag }}</span>
        <span v-if="option.data.count > 0" class="hashtag-item-count">
          {{ option.data.count }}
        </span>
      </div>
    </template>
  </EditorAutocomplete>
</template>

<style scoped>
.hashtag-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
}

.hashtag-item-name {
  color: var(--color-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.hashtag-item-count {
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.7;
  flex-shrink: 0;
}

/* Highlighted state - override autocomplete styles */
:deep(.editor-autocomplete-item-highlighted) .hashtag-item-name {
  color: var(--color-accent);
}
</style>
