<script lang="ts" setup>
defineProps<{
  mode?: 'in-out' | 'out-in' | 'default'
}>()
</script>

<template>
  <Transition name="fade" :mode="mode">
    <slot />
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
