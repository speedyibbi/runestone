<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  show: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  maxWidth?: string
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
  maxWidth: '25rem',
})

const emit = defineEmits<Emits>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const isClosing = ref(false)

watch(
  () => props.show,
  (show) => {
    if (show) {
      isClosing.value = false
      if (dialogRef.value && !dialogRef.value.open) {
        dialogRef.value.showModal()
        // Focus a hidden element to prevent auto-focusing the close button
        nextTick(() => {
          const hiddenFocus = dialogRef.value?.querySelector('.hidden-focus') as HTMLElement
          if (hiddenFocus) {
            hiddenFocus.focus()
          }
        })
      }
    } else {
      if (dialogRef.value?.open) {
        isClosing.value = true
        setTimeout(() => {
          dialogRef.value?.close()
          isClosing.value = false
        }, 200)
      }
    }
  },
  { immediate: true },
)

function handleConfirm() {
  emit('confirm')
  emit('update:show', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:show', false)
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === dialogRef.value) {
    handleCancel()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.show && dialogRef.value?.open) {
    event.preventDefault()
    handleCancel()
  }
}

// Add global event listener when modal is shown
watch(
  () => props.show,
  (show) => {
    if (show) {
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="modal-dialog"
    :class="{ closing: isClosing }"
    @click="handleBackdropClick"
  >
    <div
      class="modal-container"
      :class="{ closing: isClosing }"
      :style="{ width: maxWidth, maxWidth: maxWidth }"
      @click.stop
    >
      <!-- Hidden element to receive initial focus, preventing close button from being auto-focused -->
      <button class="hidden-focus" tabindex="-1"></button>
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="close-button" @click="handleCancel" aria-label="Close">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="message || $slots.default" class="modal-body">
        <p v-if="message">{{ message }}</p>
        <slot />
      </div>

      <div v-if="(confirmText || cancelText) || $slots.footer" class="modal-footer">
        <slot name="footer">
          <template v-if="confirmText || cancelText">
            <button v-if="cancelText" class="button button-secondary" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button
              v-if="confirmText"
              :class="['button', 'button-primary', { 'button-destructive': destructive }]"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </template>
        </slot>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.modal-dialog {
  width: fit-content;
  height: fit-content;
  max-width: 90vw;
  max-height: 90vh;
  margin: auto;
  padding: 0;
  border: none;
  background: transparent;
  overflow: visible;
  outline: none;
  inset: 0;
}

.modal-dialog:focus {
  outline: none;
}

.modal-dialog:focus-visible {
  outline: none;
}

.modal-dialog::backdrop {
  background-color: var(--color-modal-backdrop);
  animation: fadeIn 0.2s ease-out;
}

.modal-dialog.closing::backdrop {
  animation: fadeOut 0.2s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.modal-container {
  background-color: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 12px;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 6px -1px var(--color-modal-shadow);
  outline: none;
  max-height: 85vh;
  overflow: hidden;
}

.modal-container:focus {
  outline: none;
}

.modal-container:focus-visible {
  outline: none;
}

.hidden-focus {
  position: absolute;
  width: 0;
  height: 0;
  padding: 0;
  margin: 0;
  border: none;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  /* Visually hidden but accessible to screen readers when focused */
  clip-path: inset(50%);
}

.hidden-focus:focus {
  outline: none;
}

@keyframes slideUp {
  from {
    transform: translateY(0.5rem);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(0.5rem);
    opacity: 0;
  }
}

.modal-container {
  animation: slideUp 0.2s ease-out;
}

.modal-container.closing {
  animation: slideOut 0.2s ease-out forwards;
  will-change: transform, opacity;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-overlay-border);
  gap: 0.5rem;
}

.modal-header h3 {
  font-family: var(--font-primary);
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-foreground);
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
}

.close-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.modal-body p {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-foreground);
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-overlay-border);
  width: 100%;
}

.modal-footer :deep(> *) {
  width: 100%;
}

.modal-footer :deep(> div:not(.button)) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-primary);
}

.button-secondary {
  background: transparent;
  color: var(--color-foreground);
  border: 1px solid var(--color-overlay-border);
}

.button-secondary:hover {
  background: var(--color-overlay-subtle);
}

.button-primary {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.button-primary:hover {
  opacity: 0.9;
}

.button-primary:active {
  transform: scale(0.98);
}

.button-destructive {
  background: var(--color-error);
  color: var(--color-foreground);
}

.button-destructive:hover {
  opacity: 0.9;
}

/* Scrollbar styling */
.modal-body::-webkit-scrollbar {
  width: 0.25rem;
}

.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 2px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}
</style>
