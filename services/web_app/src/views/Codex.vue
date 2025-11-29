<script lang="ts" setup>
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
  padding: 2rem;
  color: var(--color-foreground);
  font-family: var(--font-primary);
  font-size: 1rem;
  line-height: 1.6;
  overflow-y: auto;
  outline: none;
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
