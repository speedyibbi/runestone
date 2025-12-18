<script lang="ts" setup>
import Wrapper from '@/components/layout/Wrapper.vue'
</script>

<template>
  <Wrapper>
    <RouterView v-slot="{ Component }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </Wrapper>
</template>

<style>
/* Page transition styles */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
