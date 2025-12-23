<script lang="ts" setup>
import AmbientBackground from '@/components/base/AmbientBackground.vue'
import Toast from '@/components/base/Toast.vue'
</script>

<template>
  <div class="wrapper">
    <AmbientBackground />
    <slot />
    <Toast />
  </div>
</template>

<style scoped>
.wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  color: var(--color-foreground);
  font-family: var(--font-primary);
  overflow: hidden;
}
</style>
