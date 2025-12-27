<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue'

interface Props {
  show: boolean
  title: string
  label: string
  value?: string
  submitText?: string
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'submit', value: string): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  submitText: 'Create',
})

const emit = defineEmits<Emits>()

const inputValue = ref(props.value)
const inputRef = ref<HTMLInputElement>()

watch(
  () => props.show,
  (show) => {
    if (show) {
      inputValue.value = props.value
      nextTick(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
)

function handleSubmit() {
  if (inputValue.value.trim()) {
    emit('submit', inputValue.value.trim())
    emit('update:show', false)
  }
}

function handleCancel() {
  emit('cancel')
  emit('update:show', false)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    handleSubmit()
  } else if (event.key === 'Escape') {
    handleCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="dialog-overlay" @click="handleCancel">
      <div class="dialog-container" @click.stop>
        <div class="dialog-header">
          <h3>{{ title }}</h3>
          <button class="close-button" @click="handleCancel">
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
        <div class="dialog-body">
          <label class="input-label">{{ label }}</label>
          <input
            ref="inputRef"
            v-model="inputValue"
            type="text"
            class="dialog-input"
            @keydown="handleKeydown"
          />
        </div>
        <div class="dialog-footer">
          <button class="button button-secondary" @click="handleCancel">Cancel</button>
          <button class="button button-primary" @click="handleSubmit">{{ submitText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(0.25rem);
}

.dialog-container {
  background: var(--color-background);
  border: 1px solid var(--color-overlay-subtle);
  border-radius: 0.75rem;
  width: 90%;
  max-width: 25rem;
  box-shadow: 0 1.25rem 1.5625rem -0.3125rem var(--color-modal-shadow);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--color-foreground);
}

.close-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.close-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
}

.dialog-body {
  padding: 1.5rem;
}

.input-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-foreground);
}

.dialog-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-subtle);
  border-radius: 0.375rem;
  color: var(--color-foreground);
  font-size: 0.9375rem;
  font-family: var(--font-primary);
  transition: all 0.2s;
}

.dialog-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 0.1875rem var(--color-selection);
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-overlay-subtle);
}

.button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-primary);
}

.button-secondary {
  background: transparent;
  color: var(--color-foreground);
  border: 1px solid var(--color-overlay-subtle);
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
</style>
