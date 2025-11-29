<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Schema, DOMParser, DOMSerializer } from 'prosemirror-model'
import { schema as basicSchema } from 'prosemirror-schema-basic'
import { addListNodes } from 'prosemirror-schema-list'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, toggleMark, setBlockType, wrapIn } from 'prosemirror-commands'
import { history, undo, redo } from 'prosemirror-history'
import { inputRules, wrappingInputRule, textblockTypeInputRule, smartQuotes, emDash, ellipsis } from 'prosemirror-inputrules'

// Create schema with list support
const mySchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
  marks: basicSchema.spec.marks
})

const editorElement = ref<HTMLElement | null>(null)
const bubbleMenu = ref<HTMLElement | null>(null)
let editorView: EditorView | null = null

// Bubble menu state
const showBubble = ref(false)
const bubblePosition = ref({ top: 0, left: 0 })

// Input rules for markdown shortcuts
function buildInputRules(schema: Schema) {
  const rules = []
  
  // Headings: # space = h1, ## space = h2, ### space = h3
  rules.push(textblockTypeInputRule(/^#\s/, schema.nodes.heading, { level: 1 }))
  rules.push(textblockTypeInputRule(/^##\s/, schema.nodes.heading, { level: 2 }))
  rules.push(textblockTypeInputRule(/^###\s/, schema.nodes.heading, { level: 3 }))
  
  // Blockquote: > space
  rules.push(wrappingInputRule(/^\s*>\s/, schema.nodes.blockquote))
  
  // Code block: ``` space
  rules.push(textblockTypeInputRule(/^```\s/, schema.nodes.code_block))
  
  // Bullet list: - space or * space
  rules.push(wrappingInputRule(/^\s*([-+*])\s/, schema.nodes.bullet_list))
  
  // Ordered list: 1. space
  rules.push(wrappingInputRule(/^(\d+)\.\s/, schema.nodes.ordered_list))
  
  // Add smart quotes and other typographic helpers
  rules.push(...smartQuotes)
  rules.push(ellipsis)
  rules.push(emDash)
  
  return inputRules({ rules })
}

// Keybindings
function buildKeymap(schema: Schema) {
  const keys: { [key: string]: any } = {
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-`': toggleMark(schema.marks.code),
    'Shift-Ctrl-1': setBlockType(schema.nodes.heading, { level: 1 }),
    'Shift-Ctrl-2': setBlockType(schema.nodes.heading, { level: 2 }),
    'Shift-Ctrl-3': setBlockType(schema.nodes.heading, { level: 3 }),
    'Shift-Ctrl-0': setBlockType(schema.nodes.paragraph),
    'Shift-Ctrl->': wrapIn(schema.nodes.blockquote),
  }
  
  return keys
}

// Update bubble menu position
function updateBubbleMenu(view: EditorView) {
  const { state } = view
  const { from, to, empty } = state.selection
  
  // Hide if selection is empty
  if (empty) {
    showBubble.value = false
    return
  }
  
  // Get coordinates of selection
  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  
  // Calculate initial position (centered above selection)
  let left = (start.left + end.left) / 2
  let top = start.top - 50 // 50px above selection
  
  // Show bubble temporarily to measure it
  showBubble.value = true
  
  // Wait for next tick to ensure bubble is rendered
  nextTick(() => {
    if (!bubbleMenu.value) return
    
    const menuRect = bubbleMenu.value.getBoundingClientRect()
    const menuWidth = menuRect.width
    const menuHeight = menuRect.height
    
    // Adjust horizontal position if going off screen
    // Account for transform: translateX(-50%)
    const leftEdge = left - menuWidth / 2
    const rightEdge = left + menuWidth / 2
    
    if (leftEdge < 10) {
      // Too far left, adjust
      left = menuWidth / 2 + 10
    } else if (rightEdge > window.innerWidth - 10) {
      // Too far right, adjust
      left = window.innerWidth - menuWidth / 2 - 10
    }
    
    // Adjust vertical position if going off top
    if (top < 10) {
      // Position below selection instead
      top = end.bottom + 10
    }
    
    bubblePosition.value = { top, left }
  })
}

// Bubble menu commands
function toggleStrong() {
  if (!editorView) return
  const command = toggleMark(mySchema.marks.strong)
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

function toggleEm() {
  if (!editorView) return
  const command = toggleMark(mySchema.marks.em)
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

function toggleCode() {
  if (!editorView) return
  const command = toggleMark(mySchema.marks.code)
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

function makeHeading(level: number) {
  if (!editorView) return
  const command = setBlockType(mySchema.nodes.heading, { level })
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

function makeParagraph() {
  if (!editorView) return
  const command = setBlockType(mySchema.nodes.paragraph)
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

function makeBlockquote() {
  if (!editorView) return
  const command = wrapIn(mySchema.nodes.blockquote)
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

function makeCodeBlock() {
  if (!editorView) return
  const command = setBlockType(mySchema.nodes.code_block)
  command(editorView.state, editorView.dispatch)
  editorView.focus()
}

onMounted(() => {
  if (!editorElement.value) return
  
  const state = EditorState.create({
    schema: mySchema,
    plugins: [
      history(),
      buildInputRules(mySchema),
      keymap(buildKeymap(mySchema)),
      keymap(baseKeymap),
    ],
  })
  
  editorView = new EditorView(editorElement.value, {
    state,
    dispatchTransaction(transaction) {
      if (!editorView) return
      const newState = editorView.state.apply(transaction)
      editorView.updateState(newState)
      
      // Update bubble menu on selection change
      if (transaction.selectionSet) {
        updateBubbleMenu(editorView)
      }
    },
  })
})

onBeforeUnmount(() => {
  if (editorView) {
    editorView.destroy()
  }
})
</script>

<template>
  <main>
    <div ref="editorElement" class="editor"></div>
    
    <div 
      v-if="showBubble" 
      ref="bubbleMenu" 
      class="bubble-menu"
      :style="{
        top: `${bubblePosition.top}px`,
        left: `${bubblePosition.left}px`,
      }"
    >
      <button @mousedown.prevent="toggleStrong" title="Bold (Ctrl+B)">B</button>
      <button @mousedown.prevent="toggleEm" title="Italic (Ctrl+I)">I</button>
      <button @mousedown.prevent="toggleCode" title="Code (Ctrl+`)">{ }</button>
      <span class="separator"></span>
      <button @mousedown.prevent="makeHeading(1)" title="Heading 1">H1</button>
      <button @mousedown.prevent="makeHeading(2)" title="Heading 2">H2</button>
      <button @mousedown.prevent="makeHeading(3)" title="Heading 3">H3</button>
      <button @mousedown.prevent="makeParagraph" title="Paragraph">P</button>
      <span class="separator"></span>
      <button @mousedown.prevent="makeBlockquote" title="Quote">" "</button>
      <button @mousedown.prevent="makeCodeBlock" title="Code Block">&lt;/&gt;</button>
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
  transform: translateX(-50%);
  background-color: var(--color-foreground);
  border: 1px solid var(--color-accent);
  border-radius: 0.375rem;
  padding: 0.25rem;
  display: flex;
  gap: 0.125rem;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  pointer-events: all;
  transition: top 0.1s ease, left 0.1s ease;
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
