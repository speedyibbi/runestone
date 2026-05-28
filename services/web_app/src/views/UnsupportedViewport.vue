<script lang="ts" setup>
import { MIN_VIEWPORT_WIDTH } from '@/composables/useViewportSupported'
</script>

<template>
  <main class="unsupported-viewport">
    <div class="unsupported-viewport__content">
      <h1 class="unsupported-viewport__title">Desktop required</h1>
      <p class="unsupported-viewport__message">
        Runestone needs a viewport at least {{ MIN_VIEWPORT_WIDTH }}px wide. Resize your window or
        use a larger display to continue.
      </p>
    </div>
  </main>
</template>

<style scoped>
.unsupported-viewport {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
  padding: 1.5rem;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-primary);
  text-align: center;
}

.unsupported-viewport__content {
  max-width: 22rem;
}

.unsupported-viewport__title {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}

.unsupported-viewport__message {
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--color-muted);
}
</style>
