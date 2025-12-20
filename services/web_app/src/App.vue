<script lang="ts" setup>
import Wrapper from '@/components/layout/Wrapper.vue'
import FadeTransition from '@/components/base/FadeTransition.vue'
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
