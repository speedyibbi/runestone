<script lang="ts" setup>
import { ref, watch } from 'vue'
import Loader from '@/components/base/Loader.vue'
import FadeTransition from '@/components/base/FadeTransition.vue'
import type { PreviewMode } from '@/composables/useEditor'

interface Props {
  hasOpenRune: boolean
  isLoadingRune: boolean
  currentRuneId?: string | null
  previewMode: PreviewMode
}

const props = defineProps<Props>()

const editorElement = ref<HTMLElement>()
const previewElement = ref<HTMLElement>()

const emit = defineEmits<{
  'update:editorElement': [value: HTMLElement | undefined]
  'update:previewElement': [value: HTMLElement | undefined]
}>()

watch(
  editorElement,
  (element) => {
    emit('update:editorElement', element)
  },
  { immediate: true },
)

watch(
  previewElement,
  (element) => {
    emit('update:previewElement', element)
  },
  { immediate: true },
)
</script>

<template>
  <div class="editor-area">
    <!-- Empty State -->
    <div v-if="!hasOpenRune && !isLoadingRune" class="empty-state">
      <div class="empty-state-content">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
        <p class="empty-message">Select or create a rune</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoadingRune" class="loading-state">
      <Loader message="Loading document..." />
    </div>

    <!-- Editor -->
    <FadeTransition v-else mode="out-in">
      <div
        v-if="hasOpenRune && !isLoadingRune"
        :key="currentRuneId || 'editor'"
        class="editor-container"
        :class="{
          'split-view': previewMode === 'split',
        }"
      >
        <div ref="editorElement" class="editor" :class="{ 'split-left': previewMode === 'split' }"></div>
        <div
          v-if="previewMode === 'split'"
          ref="previewElement"
          class="editor"
          :class="{ 'split-right': previewMode === 'split' }"
        ></div>
      </div>
    </FadeTransition>
  </div>
</template>

<style scoped>
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.empty-state,
.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  color: var(--color-muted);
}

.empty-state-content svg {
  color: var(--color-accent);
  opacity: 0.3;
}

.empty-message {
  font-size: 0.875rem;
  color: var(--color-accent);
  margin: 0;
  opacity: 0.6;
  font-weight: 400;
  letter-spacing: -0.01em;
  user-select: none;
}

.editor-container {
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.editor-container.split-view {
  justify-content: stretch;
  gap: 0;
}

.editor {
  flex: 1;
  width: 100%;
  max-width: 80rem;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.editor.split-left {
  max-width: none;
  flex: 1;
  border-right: 1px solid var(--color-overlay-subtle);
}

.editor.split-right {
  max-width: none;
  flex: 1;
}

.editor::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

/* Hide CodeMirror's scrollbar */
.editor :deep(.cm-scroller) {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.editor :deep(.cm-scroller::-webkit-scrollbar) {
  display: none; /* Chrome, Safari, Opera */
}
</style>
