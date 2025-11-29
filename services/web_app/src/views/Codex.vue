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
      <button @mousedown.prevent="commands.toggleStrikethrough" title="Strikethrough (Ctrl+Shift+X)">S</button>
      <button @mousedown.prevent="commands.toggleHighlight" title="Highlight (Ctrl+Shift+H)">H</button>
      <button @mousedown.prevent="commands.toggleCode" title="Code (Ctrl+`)">{ }</button>
      <button @mousedown.prevent="commands.insertFootnote" title="Insert Footnote (Ctrl+Shift+F)">[^]</button>
      <span class="separator"></span>
      <button @mousedown.prevent="commands.makeHeading(1)" title="Heading 1">H1</button>
      <button @mousedown.prevent="commands.makeHeading(2)" title="Heading 2">H2</button>
      <button @mousedown.prevent="commands.makeHeading(3)" title="Heading 3">H3</button>
      <button @mousedown.prevent="commands.makeHeading(4)" title="Heading 4">H4</button>
      <button @mousedown.prevent="commands.makeHeading(5)" title="Heading 5">H5</button>
      <button @mousedown.prevent="commands.makeHeading(6)" title="Heading 6">H6</button>
      <button @mousedown.prevent="commands.makeParagraph" title="Paragraph">P</button>
      <span class="separator"></span>
      <button @mousedown.prevent="commands.makeBulletList" title="Bullet List">•</button>
      <button @mousedown.prevent="commands.makeOrderedList" title="Numbered List">1.</button>
      <button @mousedown.prevent="commands.makeBlockquote" title="Quote">" "</button>
      <button @mousedown.prevent="commands.makeCodeBlock" title="Code Block">&lt;/&gt;</button>
      <button @mousedown.prevent="commands.insertHorizontalRule" title="Horizontal Rule">—</button>
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

:deep(.ProseMirror h4) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.875rem 0 0.625rem;
  line-height: 1.4;
}

:deep(.ProseMirror h5) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  line-height: 1.5;
}

:deep(.ProseMirror h6) {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0.625rem 0 0.5rem;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

:deep(.ProseMirror li) {
  margin-bottom: 0.25rem;
}

/* Bullet list styles - cycles every 3 levels, up to 10 levels */
:deep(.ProseMirror ul) {
  list-style-type: disc;
}

:deep(.ProseMirror ul ul) {
  list-style-type: circle;
}

:deep(.ProseMirror ul ul ul) {
  list-style-type: square;
}

:deep(.ProseMirror ul ul ul ul) {
  list-style-type: disc;
}

:deep(.ProseMirror ul ul ul ul ul) {
  list-style-type: circle;
}

:deep(.ProseMirror ul ul ul ul ul ul) {
  list-style-type: square;
}

:deep(.ProseMirror ul ul ul ul ul ul ul) {
  list-style-type: disc;
}

:deep(.ProseMirror ul ul ul ul ul ul ul ul) {
  list-style-type: circle;
}

:deep(.ProseMirror ul ul ul ul ul ul ul ul ul) {
  list-style-type: square;
}

:deep(.ProseMirror ul ul ul ul ul ul ul ul ul ul) {
  list-style-type: disc;
}

/* Ordered list styles - cycles every 3 levels, up to 10 levels */
:deep(.ProseMirror ol) {
  list-style-type: decimal;
}

:deep(.ProseMirror ol ol) {
  list-style-type: lower-alpha;
}

:deep(.ProseMirror ol ol ol) {
  list-style-type: lower-roman;
}

:deep(.ProseMirror ol ol ol ol) {
  list-style-type: decimal;
}

:deep(.ProseMirror ol ol ol ol ol) {
  list-style-type: lower-alpha;
}

:deep(.ProseMirror ol ol ol ol ol ol) {
  list-style-type: lower-roman;
}

:deep(.ProseMirror ol ol ol ol ol ol ol) {
  list-style-type: decimal;
}

:deep(.ProseMirror ol ol ol ol ol ol ol ol) {
  list-style-type: lower-alpha;
}

:deep(.ProseMirror ol ol ol ol ol ol ol ol ol) {
  list-style-type: lower-roman;
}

:deep(.ProseMirror ol ol ol ol ol ol ol ol ol ol) {
  list-style-type: decimal;
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

:deep(.ProseMirror s) {
  text-decoration: line-through;
}

:deep(.ProseMirror mark) {
  background-color: rgba(255, 235, 59, 0.4);
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
}

:deep(.ProseMirror hr) {
  border: none;
  border-top: 1px solid var(--color-accent);
  margin: 2rem 0;
  opacity: 0.5;
  user-select: none;
  cursor: default;
  outline: none;
}

:deep(.ProseMirror hr.ProseMirror-selectednode) {
  outline: none;
  background: none;
}

:deep(.ProseMirror sup.footnote-ref) {
  color: var(--color-accent);
  font-weight: 600;
  cursor: help;
  text-decoration: none;
  padding: 0 0.125rem;
  font-size: 0.75em;
  vertical-align: super;
  line-height: 0;
  user-select: none;
}

:deep(.ProseMirror sup.footnote-ref:hover) {
  text-decoration: underline;
}

:deep(.ProseMirror sup.footnote-ref.ProseMirror-selectednode) {
  outline: none;
  background: none;
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
