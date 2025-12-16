<script lang="ts" setup>
import Toast from '@/components/base/Toast.vue'
</script>

<template>
  <div class="wrapper">
    <slot />
    <Toast />
  </div>
</template>

<style scoped>
.wrapper {
  width: 100vw;
  height: 100vh;
  color: var(--color-foreground);
  font-family: var(--font-primary);
  background-color: var(--color-background);
  overflow: hidden;
}
</style>
