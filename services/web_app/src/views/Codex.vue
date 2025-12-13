<script lang="ts" setup>
import { ref } from 'vue'
import { useEditor } from '@/composables/useEditor'
import KeyboardShortcuts from '@/components/editor/KeyboardShortcuts.vue'
import BubbleMenu from '@/components/editor/BubbleMenu.vue'

const editorElement = ref<HTMLElement>()
const { getContent, setContent, editorView, isPreviewMode, togglePreview } = useEditor(editorElement)
</script>

<template>
  <main>
    <div ref="editorElement" class="editor"></div>
    
    <!-- Preview Toggle Button -->
    <div class="preview-toggle-container">
      <button 
        class="preview-toggle" 
        @click="togglePreview"
        :class="{ 'is-preview': isPreviewMode }"
        :title="isPreviewMode ? 'Exit Preview (Ctrl+E)' : 'Enter Preview (Ctrl+E)'"
      >
        <svg v-if="isPreviewMode" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="m15 5 4 4"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
    
    <KeyboardShortcuts />
    <BubbleMenu :editor-view="editorView" />
  </main>
</template>

<style scoped>
main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow-x: hidden;
  overflow-y: scroll;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

main::-webkit-scrollbar {
  display: none;
}

.editor {
  flex: 1;
  width: 100%;
  max-width: 75rem;
}

.preview-toggle-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 100;
  font-family: var(--font-primary);
}

.preview-toggle {
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 8px;
  padding: 0.5rem;
  color: var(--color-accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 8px 24px var(--color-modal-shadow);
  outline: none;
  user-select: none;
  opacity: 0.7;
}

.preview-toggle:hover {
  background: var(--color-overlay-light);
  opacity: 1;
  transform: scale(1.05);
  box-shadow: 0 12px 32px var(--color-modal-shadow);
}

.preview-toggle:active {
  transform: scale(0.98);
  background: var(--color-overlay-medium);
}

.preview-toggle:focus-visible {
  box-shadow: 0 0 0 2px var(--color-overlay-border), 0 8px 24px var(--color-modal-shadow);
  opacity: 1;
}

.preview-toggle.is-preview {
  opacity: 1;
  background: var(--color-overlay-light);
}

.preview-toggle svg {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
}
</style>
