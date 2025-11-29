<script lang="ts" setup>
import { useEditor } from '@/composables/useEditor'

const { editorElement, bubbleMenu, bubbleMenuElement, commands } = useEditor()
</script>

<template>
  <main>
    <div ref="editorElement" class="editor"></div>
    
    <div 
      v-if="bubbleMenu.show.value" 
      ref="bubbleMenuElement" 
      class="bubble-menu"
      :class="{ visible: bubbleMenu.visible.value }"
      :style="{
        top: `${bubbleMenu.position.value.top}px`,
        left: `${bubbleMenu.position.value.left}px`,
      }"
    >
      <button @mousedown.prevent="commands.toggleStrong" title="Bold (Ctrl+B)">B</button>
      <button @mousedown.prevent="commands.toggleEm" title="Italic (Ctrl+I)">I</button>
      <button @mousedown.prevent="commands.toggleCode" title="Code (Ctrl+`)">{ }</button>
      <span class="separator"></span>
      <button @mousedown.prevent="commands.makeHeading(1)" title="Heading 1">H1</button>
      <button @mousedown.prevent="commands.makeHeading(2)" title="Heading 2">H2</button>
      <button @mousedown.prevent="commands.makeHeading(3)" title="Heading 3">H3</button>
      <button @mousedown.prevent="commands.makeParagraph" title="Paragraph">P</button>
      <span class="separator"></span>
      <button @mousedown.prevent="commands.makeBlockquote" title="Quote">" "</button>
      <button @mousedown.prevent="commands.makeCodeBlock" title="Code Block">&lt;/&gt;</button>
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.editor {
  flex: 1;
  padding: 2rem;
  color: var(--color-foreground);
  font-family: var(--font-primary);
  font-size: 1rem;
  line-height: 1.6;
  overflow-y: auto;
  outline: none;
}

/* ProseMirror styles */
:deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  white-space: pre-wrap;
  word-wrap: break-word;
}

:deep(.ProseMirror p) {
  margin-bottom: 1rem;
}

:deep(.ProseMirror h1) {
  font-size: 2rem;
  font-weight: 600;
  margin: 1.5rem 0 1rem;
  line-height: 1.2;
}

:deep(.ProseMirror h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.25rem 0 0.875rem;
  line-height: 1.3;
}

:deep(.ProseMirror h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.75rem;
  line-height: 1.4;
}

:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

:deep(.ProseMirror ul) {
  list-style: disc;
}

:deep(.ProseMirror ol) {
  list-style: decimal;
}

:deep(.ProseMirror li) {
  margin-bottom: 0.25rem;
}

:deep(.ProseMirror code) {
  background-color: rgba(131, 137, 150, 0.2);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', monospace;
  font-size: 0.9em;
}

:deep(.ProseMirror pre) {
  background-color: rgba(131, 137, 150, 0.1);
  padding: 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

:deep(.ProseMirror pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
}

:deep(.ProseMirror blockquote) {
  border-left: 0.25rem solid var(--color-accent);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--color-accent);
}

:deep(.ProseMirror strong) {
  font-weight: 600;
}

:deep(.ProseMirror em) {
  font-style: italic;
}

/* Bubble menu */
.bubble-menu {
  position: fixed;
  background-color: var(--color-foreground);
  border: 1px solid var(--color-accent);
  border-radius: 0.375rem;
  padding: 0.25rem;
  display: flex;
  gap: 0.125rem;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.bubble-menu.visible {
  opacity: 1;
  pointer-events: all;
}

.bubble-menu button {
  background: transparent;
  border: none;
  color: var(--color-background);
  padding: 0.375rem 0.625rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-family: var(--font-primary);
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.bubble-menu button:hover {
  background-color: var(--color-accent);
  color: var(--color-foreground);
}

.bubble-menu .separator {
  width: 1px;
  height: 1rem;
  background-color: var(--color-accent);
  margin: 0 0.25rem;
}

/* Scrollbar */
.editor::-webkit-scrollbar {
  width: 0.5rem;
}

.editor::-webkit-scrollbar-track {
  background: transparent;
}

.editor::-webkit-scrollbar-thumb {
  background: var(--color-accent);
  border-radius: 0.25rem;
}

.editor::-webkit-scrollbar-thumb:hover {
  background: var(--color-foreground);
}
</style>
