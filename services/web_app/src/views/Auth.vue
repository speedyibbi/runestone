<script lang="ts" setup>
import { ref, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import FadeTransition from '@/components/base/FadeTransition.vue'
import LoadingPulseInput from '@/components/base/LoadingPulseInput.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const toast = useToast()

const authMode = ref<'login' | 'signup'>('login')
const username = ref('')
const passphrase = ref('')
const currentStep = ref<'username' | 'passphrase'>('username')
const isLoading = ref(false)
const usernameInput = ref<InstanceType<typeof LoadingPulseInput> | null>(null)
const passphraseInput = ref<InstanceType<typeof LoadingPulseInput> | null>(null)
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
    await sessionStore.setup(combinedAuth, authMode.value)
    
    if (authMode.value === 'login') {
      toast.success('Logged in successfully')
    } else {
      toast.success('Account created successfully')
    }

    router.push('/select-codex')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session'

    // Handle specific error messages
    if (errorMessage.includes('already exists')) {
      toast.error('Account already exists. Please log in instead.')
    } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      toast.error('Account not found. Please check your credentials.')
    } else if (errorMessage.includes('decrypt') || errorMessage.includes('passphrase') || errorMessage.includes('invalid')) {
      toast.error('Wrong passphrase. Please try again.')
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
      toast.error('Unable to connect. Please check your internet.')
    } else if (errorMessage.includes('timeout')) {
      toast.error('Request timed out. Please try again.')
    } else if (errorMessage.includes('OPFS') || errorMessage.includes('storage') || errorMessage.includes('directory')) {
      toast.error('Storage error. Please try refreshing the page.')
    } else {
      toast.error(errorMessage || 'Something went wrong. Please try again.')
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

function switchMode(mode: 'login' | 'signup') {
  if (authMode.value === mode) return
  
  authMode.value = mode
  currentStep.value = 'username'
  username.value = ''
  passphrase.value = ''
  
  nextTick(() => {
    usernameInput.value?.focus()
  })
}
</script>

<template>
  <main>
    <div class="container">
      <h1>
        <button
          type="button"
          :class="['mode-text', { active: authMode === 'login', inactive: authMode !== 'login' }]"
          @click="switchMode('login')"
        >
          Log In
        </button>
        <span class="mode-separator">/</span>
        <button
          type="button"
          :class="['mode-text', { active: authMode === 'signup', inactive: authMode !== 'signup' }]"
          @click="switchMode('signup')"
        >
          Sign Up
        </button>
      </h1>
      
      <div class="input-container">
        <FadeTransition mode="out-in" @after-enter="handleTransitionComplete">
        <!-- Username input step -->
        <div v-if="currentStep === 'username'" key="username" class="input-wrapper">
          <LoadingPulseInput
            ref="usernameInput"
            v-model="username"
            type="text"
            placeholder="Username"
            @keydown="handleKeydown"
          />
        </div>

        <!-- Passphrase input step -->
        <div v-else key="passphrase" class="input-wrapper">
          <LoadingPulseInput
            ref="passphraseInput"
            v-model="passphrase"
            type="password"
            placeholder="Passphrase"
            :loading="isLoading"
            @keydown="handleKeydown"
          />

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

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 40rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: var(--color-foreground);
  text-align: center;
  font-weight: 400;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.mode-text {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  font-family: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  transition: color 0.25s ease, opacity 0.25s ease;
  user-select: none;
}

.mode-text.active {
  color: var(--color-foreground);
}

.mode-text.inactive {
  color: var(--color-accent);
  opacity: 0.6;
}

.mode-text.inactive:hover {
  opacity: 1;
}

.mode-text:focus-visible {
  outline: 0.125rem solid var(--color-foreground);
  outline-offset: 0.25rem;
  opacity: 1;
}

.mode-separator {
  color: var(--color-accent);
  opacity: 0.4;
  user-select: none;
}

/* Input Container */
.input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  position: relative;
  width: 100%;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

/* Back Button */
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

/* Responsive adjustments */
@media (max-width: 40rem) {
  h1 {
    font-size: 1.75rem;
    gap: 0.4rem;
  }
}
</style>
