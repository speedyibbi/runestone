<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getShortcutDescriptions } from '@/utils/editor/keyboardShortcuts'

const dialogRef = ref<HTMLDialogElement | null>(null)
const isClosing = ref(false)
// Memoize shortcut descriptions to avoid recalculating on every render
const shortcutDescriptions = computed(() => getShortcutDescriptions())

const open = () => {
  if (dialogRef.value && !dialogRef.value.open) {
    isClosing.value = false
    dialogRef.value.showModal()
    // Focus the modal container instead of the close button
    const modalContainer = dialogRef.value.querySelector('.shortcuts-modal') as HTMLElement
    if (modalContainer) {
      modalContainer.focus()
    }
  }
}

const close = () => {
  if (dialogRef.value && dialogRef.value.open) {
    isClosing.value = true
    // Wait for animation to complete before closing dialog
    setTimeout(() => {
      dialogRef.value?.close()
      isClosing.value = false
    }, 200) // Match the animation duration
  }
}

const toggle = () => {
  if (dialogRef.value?.open) {
    close()
  } else {
    open()
  }
}

// Handle clicks on the backdrop (outside the modal content)
const handleBackdropClick = (event: MouseEvent) => {
  if (event.target === dialogRef.value) {
    close()
  }
}

// Handle keyboard shortcut to toggle the panel
// Optimized to only check relevant keys early
const handleKeydown = (event: KeyboardEvent) => {
  // Early exit for irrelevant keys
  if (event.key !== '?' && event.key !== 'Escape') {
    return
  }

  // Toggle on '?' (Shift + /)
  if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    // Only if not in an input/textarea
    const target = event.target as HTMLElement
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
      event.preventDefault()
      toggle()
    }
  }
  // Close on Escape
  else if (event.key === 'Escape' && dialogRef.value?.open) {
    event.preventDefault()
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Expose methods for parent components
defineExpose({
  open,
  close,
  toggle,
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="shortcuts-dialog"
    :class="{ closing: isClosing }"
    @click="handleBackdropClick"
  >
    <div class="shortcuts-modal" :class="{ closing: isClosing }" tabindex="-1">
      <div class="shortcuts-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="close-button" @click="close" tabindex="0" aria-label="Close">
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

      <div class="shortcuts-content">
        <div
          v-for="(shortcuts, category) in shortcutDescriptions"
          :key="category"
          class="shortcuts-category"
        >
          <h3>{{ category }}</h3>
          <div class="shortcuts-list">
            <div v-for="shortcut in shortcuts" :key="`${category}-${shortcut.keys}`" class="shortcut-item">
              <kbd class="shortcut-keys">{{ shortcut.keys }}</kbd>
              <span class="shortcut-description">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="shortcuts-footer">
        <p>Press <kbd>?</kbd> to toggle this panel</p>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.shortcuts-dialog {
  max-width: 48rem;
  width: calc(100% - 3rem);
  max-height: 85vh;
  padding: 0;
  border: none;
  background: transparent;
  overflow: visible;
}

.shortcuts-dialog::backdrop {
  background-color: var(--color-modal-backdrop);
  animation: fadeIn 0.2s ease-out;
}

.shortcuts-dialog.closing::backdrop {
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

.shortcuts-modal {
  background-color: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 0.75rem;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1.25rem 1.5625rem -0.3125rem var(--color-modal-shadow);
  animation: slideUp 0.2s ease-out;
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

.shortcuts-modal.closing {
  animation: slideOut 0.2s ease-out forwards;
  will-change: transform, opacity;
}

.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-overlay-border);
  gap: 0.5rem;
}

.shortcuts-header h2 {
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
  border-radius: 0.375rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
}

.close-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.shortcuts-content {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1.5rem;
}

.shortcuts-category {
  margin-bottom: 0;
}

.shortcuts-category h3 {
  font-family: var(--font-primary);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0 0 0.875rem 0;
  padding: 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
  line-height: 1.5;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0 0.5rem;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
}

.shortcut-keys {
  font-family: var(--font-code);
  font-size: 0.8125rem;
  padding: 0.375rem 0.625rem;
  background-color: var(--color-overlay-light);
  border: 1px solid var(--color-overlay-border);
  border-radius: 0.375rem;
  color: var(--color-foreground);
  white-space: nowrap;
  min-width: 7.5rem;
  text-align: center;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.3;
}

.shortcut-description {
  font-family: var(--font-primary);
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--color-foreground);
  flex: 1;
  opacity: 0.85;
  line-height: 1.5;
  letter-spacing: -0.005em;
}

.shortcuts-footer {
  padding: 0.75rem 1.5rem;
  border-top: 1px solid var(--color-overlay-border);
  text-align: center;
}

.shortcuts-footer p {
  font-family: var(--font-primary);
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--color-muted);
  margin: 0;
  opacity: 0.8;
  line-height: 1.5;
}

.shortcuts-footer kbd {
  font-family: var(--font-code);
  font-size: 0.8125rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--color-overlay-light);
  border: 1px solid var(--color-overlay-border);
  border-radius: 0.375rem;
  color: var(--color-foreground);
  margin: 0 0.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

/* Scrollbar styling */
.shortcuts-content::-webkit-scrollbar {
  width: 0.25rem;
}

.shortcuts-content::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-content::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 0.125rem;
}

.shortcuts-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}

/* Responsive design */
@media (max-width: 50rem) {
  .shortcuts-dialog {
    width: calc(100% - 1.5rem);
    max-height: 90vh;
  }

  .shortcuts-modal {
    max-height: 90vh;
  }

  .shortcuts-content {
    grid-template-columns: 1fr;
    padding: 0.75rem;
    gap: 1.25rem;
  }

  .shortcuts-header {
    padding: 0.875rem 1rem;
  }

  .shortcuts-footer {
    padding: 0.625rem 1rem;
  }

  .shortcuts-list {
    padding: 0 0.25rem;
  }

  .shortcut-item {
    padding: 0.5rem;
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .shortcut-keys {
    min-width: auto;
  }
}
</style>
