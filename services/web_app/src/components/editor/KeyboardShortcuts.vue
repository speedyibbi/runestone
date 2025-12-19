<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getShortcutDescriptions } from '@/utils/editor/keyboardShortcuts'

const dialogRef = ref<HTMLDialogElement | null>(null)
const isClosing = ref(false)
const shortcutDescriptions = getShortcutDescriptions()

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
const handleKeydown = (event: KeyboardEvent) => {
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
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button class="close-button" @click="close" tabindex="0">×</button>
      </div>

      <div class="shortcuts-content">
        <div
          v-for="(shortcuts, category) in shortcutDescriptions"
          :key="category"
          class="shortcuts-category"
        >
          <h3>{{ category }}</h3>
          <div class="shortcuts-list">
            <div v-for="shortcut in shortcuts" :key="shortcut.keys" class="shortcut-item">
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
  max-width: 50rem;
  width: calc(100% - 4rem);
  max-height: 85vh;
  padding: 0;
  border: none;
  background: transparent;
  overflow: visible;
}

.shortcuts-dialog::backdrop {
  background-color: var(--color-modal-backdrop);
  backdrop-filter: blur(4px);
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
  border-radius: 12px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px var(--color-modal-shadow);
  animation: slideUp 0.3s ease-out;
  will-change: transform, opacity;
  outline: none; /* Remove focus outline since we're using it just to manage focus */
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
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
    transform: translateY(20px);
    opacity: 0;
  }
}

.shortcuts-modal.closing {
  animation: slideOut 0.2s ease-out forwards;
}

.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--color-overlay-border);
}

.shortcuts-header h2 {
  font-family: var(--font-primary);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: var(--color-overlay-light);
  color: var(--color-accent);
}

.shortcuts-content {
  overflow-y: auto;
  padding: 1.5rem 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 2rem;
}

.shortcuts-category {
  margin-bottom: 1rem;
}

.shortcuts-category h3 {
  font-family: var(--font-primary);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
}

.shortcut-keys {
  font-family: var(--font-code);
  font-size: 0.85rem;
  padding: 0.35rem 0.6rem;
  background-color: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent);
  white-space: nowrap;
  min-width: 10rem;
  text-align: center;
  box-shadow: 0 1px 2px var(--color-modal-shadow);
}

.shortcut-description {
  font-family: var(--font-primary);
  font-size: 0.95rem;
  color: var(--color-muted);
  flex: 1;
}

.shortcuts-footer {
  padding: 1rem 2rem;
  border-top: 1px solid var(--color-overlay-border);
  text-align: center;
}

.shortcuts-footer p {
  font-family: var(--font-primary);
  font-size: 0.9rem;
  color: var(--color-muted);
  margin: 0;
}

.shortcuts-footer kbd {
  font-family: var(--font-code);
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent);
  margin: 0 0.25rem;
}

/* Scrollbar styling */
.shortcuts-content::-webkit-scrollbar {
  width: 2px;
}

.shortcuts-content::-webkit-scrollbar-track {
  background-color: var(--color-overlay-subtle);
}

.shortcuts-content::-webkit-scrollbar-thumb {
  background-color: var(--color-overlay-hover);
  border-radius: 4px;
}

.shortcuts-content::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-overlay-active);
}

/* Responsive design */
@media (max-width: 50rem) {
  .shortcuts-dialog {
    width: calc(100% - 2rem);
    max-height: 90vh;
  }

  .shortcuts-modal {
    max-height: 90vh;
  }

  .shortcuts-content {
    grid-template-columns: 1fr;
    padding: 1rem;
  }

  .shortcuts-header {
    padding: 1rem;
  }

  .shortcuts-footer {
    padding: 1rem;
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
