<script lang="ts" setup>
import { ref } from 'vue'
import { useEditor } from '@/composables/useEditor'

const editorElement = ref<HTMLElement>()
const { getContent, setContent } = useEditor(editorElement)
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
</style>
