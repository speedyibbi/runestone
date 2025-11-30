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
  position: relative;
}

.editor {
  flex: 1;
  overflow: hidden;
}
</style>
