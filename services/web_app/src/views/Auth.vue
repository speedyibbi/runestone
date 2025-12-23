<script lang="ts" setup>
import { ref, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import FadeTransition from '@/components/base/FadeTransition.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const toast = useToast()

const username = ref('')
const passphrase = ref('')
const currentStep = ref<'username' | 'passphrase'>('username')
const isLoading = ref(false)
const usernameInput = ref<HTMLInputElement | null>(null)
const passphraseInput = ref<HTMLInputElement | null>(null)
const hasError = ref(false)

onMounted(async () => {
  await nextTick()
  usernameInput.value?.focus()
})

function handleTransitionComplete() {
  if (currentStep.value === 'passphrase') {
    passphraseInput.value?.focus()
  } else if (currentStep.value === 'username') {
    usernameInput.value?.focus()
  }
}

// Watch for loading to complete and refocus if there was an error
watch(isLoading, async (loading) => {
  if (!loading && hasError.value) {
    hasError.value = false
    await nextTick()
    passphraseInput.value?.focus()
  }
})

function handleUsernameSubmit() {
  if (!username.value.trim()) {
    toast.error('Username cannot be empty')
    return
  }

  currentStep.value = 'passphrase'
}

async function handlePassphraseSubmit() {
  if (!passphrase.value.trim()) {
    toast.error('Passphrase cannot be empty')
    await nextTick()
    passphraseInput.value?.focus()
    return
  }

  isLoading.value = true

  try {
    const combinedAuth = `${username.value}|${passphrase.value}`
    await sessionStore.setup(combinedAuth)

    toast.success('Session initialized successfully')
    router.push('/select-codex')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session'

    if (errorMessage.includes('decrypt') || errorMessage.includes('passphrase') || errorMessage.includes('invalid')) {
      toast.error('Wrong passphrase. Please try again.')
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      toast.error('Unable to connect. Please check your internet.')
    } else if (errorMessage.includes('timeout')) {
      toast.error('Request timed out. Please try again.')
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      toast.error('Account not found.')
    } else {
      toast.error('Something went wrong. Please try again.')
    }

    console.error('Authentication error:', err)
    hasError.value = true
  } finally {
    isLoading.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !isLoading.value) {
    if (currentStep.value === 'username') {
      handleUsernameSubmit()
    } else {
      handlePassphraseSubmit()
    }
  }
}

function handleBack() {
  currentStep.value = 'username'
  passphrase.value = ''
}
</script>

<template>
  <main>
    <div class="input-container">
      <FadeTransition mode="out-in" @after-enter="handleTransitionComplete">
        <!-- Username input step -->
        <div v-if="currentStep === 'username'" key="username" class="input-wrapper">
          <div class="input-container-relative">
            <input
              ref="usernameInput"
              v-model="username"
              type="text"
              placeholder="Username"
              @keydown="handleKeydown"
            />
          </div>
        </div>

        <!-- Passphrase input step -->
        <div v-else key="passphrase" class="input-wrapper">
          <div class="input-container-relative">
            <input
              ref="passphraseInput"
              v-model="passphrase"
              type="password"
              placeholder="Passphrase"
              :disabled="isLoading"
              @keydown="handleKeydown"
            />
            <div v-if="isLoading" class="loading-pulse"></div>
          </div>

          <!-- Back button -->
          <button v-if="!isLoading" class="back-button" @click="handleBack">
            <svg
              class="arrow-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </FadeTransition>
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

input {
  width: 35rem;
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

/* Container for input and loading animation */
.input-container-relative {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Loading pulse animation element */
.loading-pulse {
  position: absolute;
  bottom: -0.1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 35rem;
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

.back-button {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s ease;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 150%);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.back-button:hover {
  color: var(--color-foreground);
}

.arrow-icon {
  width: 1rem;
  height: 1rem;
}
</style>
