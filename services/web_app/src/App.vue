<script lang="ts" setup>
import Wrapper from '@/components/layout/Wrapper.vue'
import FadeTransition from '@/components/base/FadeTransition.vue'
import UnsupportedViewport from '@/views/UnsupportedViewport.vue'
import { useTheme } from '@/composables/useTheme'
import { useViewportSupported } from '@/composables/useViewportSupported'

// Initialize theme watcher - automatically applies theme when settings change
useTheme()

const { isSupported } = useViewportSupported()
</script>

<template>
  <UnsupportedViewport v-if="!isSupported" />
  <Wrapper v-else>
    <RouterView v-slot="{ Component }">
      <FadeTransition mode="out-in">
        <component :is="Component" />
      </FadeTransition>
    </RouterView>
  </Wrapper>
</template>
