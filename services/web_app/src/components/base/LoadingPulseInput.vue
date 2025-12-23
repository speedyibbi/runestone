<script lang="ts" setup>
import { ref } from 'vue'

interface Props {
  modelValue: string
  type?: string
  placeholder?: string
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  keydown: [event: KeyboardEvent]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function handleKeydown(event: KeyboardEvent) {
  emit('keydown', event)
}

// Expose the input ref for parent components that need to focus it
defineExpose({
  inputRef,
  focus: () => inputRef.value?.focus(),
})
</script>

<template>
  <div class="input-container-relative">
    <input
      ref="inputRef"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled || loading"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <div v-if="loading" class="loading-pulse"></div>
  </div>
</template>

<style scoped>
/* Container for input and loading animation */
.input-container-relative {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

input {
  width: 35rem;
  max-width: 90vw;
  padding: 1rem 0;
  color: var(--color-foreground);
  font-size: 1.1rem;
  text-align: center;
  border: none;
  border-bottom: 0.1rem solid var(--color-accent);
  background-color: transparent;
  transition: border-bottom-color 0.2s ease;
}

input::placeholder {
  color: var(--color-accent);
}

input:focus {
  outline: none;
  border-bottom-color: var(--color-foreground);
}

input:disabled {
  cursor: not-allowed;
  color: var(--color-accent);
  opacity: 0.6;
  border-bottom-color: var(--color-accent);
}

/* Loading pulse animation element */
.loading-pulse {
  position: absolute;
  bottom: -0.1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 35rem;
  max-width: 90vw;
  height: 0.1rem;
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
