<script lang="ts" setup>
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.type}`]"
        @click="dismiss(toast.id)"
      >
        <span class="toast__message">{{ toast.message }}</span>
        <button class="toast__close" @click.stop="dismiss(toast.id)" aria-label="Close">
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
  width: 20rem;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.875rem;
  font-family: var(--font-primary);
  pointer-events: auto;
  cursor: pointer;
  width: 100%;
  border-radius: 5px;
  transition: all 0.2s ease;
  position: relative;
  border: none;
}

.toast:hover {
  opacity: 0.9;
}

.toast__message {
  flex: 1;
  font-size: 0.8125rem;
  line-height: 1.45;
  word-wrap: break-word;
  overflow-wrap: break-word;
  min-width: 0;
}

.toast__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.6875rem;
  line-height: 1;
  flex-shrink: 0;
  transition: all 0.15s ease;
  border-radius: 50%;
  opacity: 0.6;
}

.toast__close:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* Toast Type Variants */
.toast--error {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.toast--error .toast__close {
  color: var(--color-error);
}

.toast--success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.toast--success .toast__close {
  color: var(--color-success);
}

.toast--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.toast--warning .toast__close {
  color: var(--color-warning);
}

.toast--info {
  background: var(--color-info-bg);
  color: var(--color-info);
}

.toast--info .toast__close {
  color: var(--color-info);
}

/* Transitions */
.toast-enter-active {
  transition: all 0.25s ease;
}

.toast-leave-active {
  transition: all 0.2s ease;
  position: absolute;
  width: 20rem;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(1rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

.toast-move {
  transition: all 0.25s ease;
}
</style>
