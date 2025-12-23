<script lang="ts" setup>
import { ref, onMounted } from 'vue'

// Star configuration constants
const STAR_COUNT = 5 // Number of stars (frequency)
const STAR_SPEED_MIN = 7 // Minimum fall duration in seconds (higher = slower)
const STAR_SPEED_MAX = 14 // Maximum fall duration in seconds (higher = slower)
const STAR_DELAY_MAX = 10 // Maximum delay before star starts falling in seconds
const STAR_TAIL_LENGTH_MIN = 5 // Minimum tail length in em
const STAR_TAIL_LENGTH_MAX = 7.5 // Maximum tail length in em

const stars = ref<Array<{
  tailLength: string
  topOffset: string
  fallDuration: string
  fallDelay: string
}>>([])

const randomRange = (min: number, max: number): number => {
  return min + Math.floor(Math.random() * (max - min + 1))
}

onMounted(() => {
  // Generate random properties for each star
  stars.value = Array.from({ length: STAR_COUNT }, () => ({
    tailLength: `${randomRange(STAR_TAIL_LENGTH_MIN * 100, STAR_TAIL_LENGTH_MAX * 100) / 100}em`,
    topOffset: `${randomRange(0, 10000) / 100}vh`,
    fallDuration: `${randomRange(STAR_SPEED_MIN * 1000, STAR_SPEED_MAX * 1000) / 1000}s`,
    fallDelay: `${randomRange(0, STAR_DELAY_MAX * 1000) / 1000}s`
  }))
})
</script>

<template>
  <div class="ambient-background">
    <div class="stars">
      <div
        v-for="(star, index) in stars"
        :key="index"
        class="star"
        :style="{
          '--star-tail-length': star.tailLength,
          '--top-offset': star.topOffset,
          '--fall-duration': star.fallDuration,
          '--fall-delay': star.fallDelay
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.ambient-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, var(--color-overlay-subtle) 0%, var(--color-background) 60%);
  background-color: var(--color-background);
  overflow: hidden;
  z-index: -1;
  pointer-events: none;
}

.stars {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 120%;
  transform: rotate(-45deg);
}

.star {
  --star-color: var(--color-overlay-strong);
  --star-tail-length: 6em;
  --star-tail-height: 2px;
  --star-width: calc(var(--star-tail-length) / 6);
  --fall-duration: 9s;
  --tail-fade-duration: var(--fall-duration);

  position: absolute;
  top: var(--top-offset);
  left: 0;
  width: var(--star-tail-length);
  height: var(--star-tail-height);
  color: var(--star-color);
  background: linear-gradient(45deg, currentColor, transparent);
  border-radius: 50%;
  filter: drop-shadow(0 0 4px currentColor);
  transform: translate3d(150em, 0, 0);
  animation: fall var(--fall-duration) var(--fall-delay) linear infinite,
    tail-fade var(--tail-fade-duration) var(--fall-delay) ease-out infinite;
}

/* Mobile optimization - remove tail-fade for better performance */
@media screen and (max-width: 750px) {
  .star {
    animation: fall var(--fall-duration) var(--fall-delay) linear infinite;
  }
}

@keyframes fall {
  to {
    transform: translate3d(-50em, 0, 0);
  }
}

@keyframes tail-fade {
  0%,
  50% {
    width: var(--star-tail-length);
    opacity: 1;
  }

  70%,
  80% {
    width: 0;
    opacity: 0.4;
  }

  100% {
    width: 0;
    opacity: 0;
  }
}
</style>
