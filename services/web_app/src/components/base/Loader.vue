<script lang="ts" setup>
interface Props {
  message?: string
  width?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: 'Loading...',
  width: '20rem',
})
</script>

<template>
  <div class="loader-container">
    <p v-if="message" class="loader-message">{{ message }}</p>
    <div class="loading-pulse" :style="{ width: width }"></div>
  </div>
</template>

<style scoped>
.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  position: relative;
}

.loader-message {
  font-size: 0.875rem;
  color: var(--color-accent);
  margin: 0;
  opacity: 0.6;
  font-weight: 400;
  letter-spacing: -0.01em;
  user-select: none;
}

.loading-pulse {
  height: 0.0625rem;
  background:
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%),
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%);
  background-size:
    40% 100%,
    40% 100%;
  background-position:
    -150% 0,
    -150% 0;
  background-repeat: no-repeat;
  animation: loading-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

.loading-pulse::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0.0625rem;
  background: var(--color-overlay-subtle);
  z-index: -1;
}

@keyframes loading-pulse {
  0% {
    background-position:
      -150% 0,
      -150% 0;
  }
  50% {
    background-position:
      250% 0,
      -150% 0;
  }
  100% {
    background-position:
      250% 0,
      250% 0;
  }
}
</style>
