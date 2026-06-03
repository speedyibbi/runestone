<script lang="ts" setup>
import Wrapper from '@/components/layout/Wrapper.vue'
import FadeTransition from '@/components/base/FadeTransition.vue'
import { useTheme } from '@/composables/useTheme'

// Initialize theme watcher - automatically applies theme when settings change
useTheme()
</script>

<template>
  <Wrapper>
    <RouterView v-slot="{ Component }">
      <FadeTransition mode="out-in">
        <component :is="Component" />
      </FadeTransition>
    </RouterView>
  </Wrapper>
</template>
