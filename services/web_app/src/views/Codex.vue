<script lang="ts" setup>
import { ref } from 'vue';
import { useMDEditor } from '@/composables/useMDEditor';

const editorElement = ref<HTMLElement>();
const { getContent, setContent } = useMDEditor(editorElement);
</script>

<template>
  <main>
    <div ref="editorElement" class="editor"></div>
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
  background-color: var(--color-background);
}

.editor {
  flex: 1;
  width: 100%;
  max-width: 75rem;
  overflow: hidden;
}

/* CodeMirror customization */
.editor :deep(.cm-editor) {
  height: 100%;
  font-family: var(--font-primary) !important;
  font-size: 1rem;
  line-height: 1.6;
  background-color: var(--color-background);
}

.editor :deep(.cm-scroller) {
  overflow: auto;
  padding: 2rem;
  scrollbar-width: none; /* Firefox */
}

.editor :deep(.cm-content) {
  color: var(--color-foreground);
  caret-color: var(--color-accent);
  font-family: var(--font-primary) !important;
}

.editor :deep(.cm-line) {
  font-family: var(--font-primary) !important;
}

.editor :deep(.cm-cursor) {
  border-left-color: var(--color-accent);
}

.editor :deep(.cm-selectionBackground) {
  background-color: var(--color-selection) !important;
}

.editor :deep(.cm-focused .cm-selectionBackground) {
  background-color: var(--color-selection-focused) !important;
}

/* Hide scrollbar */
.editor :deep(.cm-scroller::-webkit-scrollbar) {
  display: none;
}
</style>
