<script lang="ts" setup>
import { computed } from 'vue'
import { useIsMobile } from '@/composables/useMediaQuery'
import Codex from '@/views/Codex.vue'
import MobileCodex from '@/views/MobileCodex.vue'

const isMobile = useIsMobile()

const component = computed(() => {
  return isMobile.value ? MobileCodex : Codex
})
</script>

<template>
  <component :is="component" />
</template>
