<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getShortcutDescriptions } from '@/utils/editor/keyboardShortcuts'
import Modal from '@/components/base/Modal.vue'

const showModal = ref(false)
// Memoize shortcut descriptions to avoid recalculating on every render
const shortcutDescriptions = computed(() => getShortcutDescriptions())

const open = () => {
  if (!showModal.value) {
    showModal.value = true
  }
}

const close = () => {
  showModal.value = false
}

const toggle = () => {
  showModal.value = !showModal.value
}

// Handle keyboard shortcut to toggle the panel
// Optimized to only check relevant keys early
const handleKeydown = (event: KeyboardEvent) => {
  // Early exit for irrelevant keys
  if (event.key !== '?') {
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
  <Modal
    v-model:show="showModal"
    title="Keyboard Shortcuts"
    max-width="48rem"
    :confirm-text="''"
    :cancel-text="''"
    @cancel="close"
  >
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

    <template #footer>
      <div class="shortcuts-footer">
        <p>Press <kbd>?</kbd> to toggle this panel</p>
      </div>
    </template>
  </Modal>
</template>

<style scoped>

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
  padding: 0;
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
  .shortcuts-content {
    grid-template-columns: 1fr;
    padding: 0.75rem;
    gap: 1.25rem;
  }

  .shortcuts-footer {
    padding: 0.625rem 1rem;
  }

  .shortcuts-list {
    padding: 0 0.25rem;
  }

  .shortcut-item {
    padding: 0.5rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .shortcut-keys {
    min-width: auto;
  }
}
</style>
