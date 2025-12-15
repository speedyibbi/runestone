<script lang="ts" setup>
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const sessionStore = useSessionStore()

const step = ref<'email' | 'passphrase'>('email')
const email = ref('')
const passphrase = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const emailInput = ref<HTMLInputElement | null>(null)
const passphraseInput = ref<HTMLInputElement | null>(null)

const handleEmailSubmit = async () => {
  if (!email.value.trim() || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.value)) {
    errorMessage.value = 'Please enter a valid email'
    // Restore focus after error renders
    await nextTick()
    emailInput.value?.focus()
    return
  }
  
  errorMessage.value = ''
  step.value = 'passphrase'
}

const handlePassphraseSubmit = async () => {
  if (!passphrase.value.trim()) {
    errorMessage.value = 'Please enter a passphrase'
    // Restore focus after error renders
    await nextTick()
    passphraseInput.value?.focus()
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  let hasError = false

  try {
    // Concatenate email and passphrase to create the actual passphrase
    const fullPassphrase = email.value + passphrase.value
    await sessionStore.setup(fullPassphrase)
    
    // Navigate to codex view on success
    router.push('/')
  } catch (error) {
    console.error('Authentication failed:', error)
    errorMessage.value = categorizeError(error)
    hasError = true
  } finally {
    isLoading.value = false
    
    // Restore focus after error (only if there was an error)
    if (hasError) {
      await nextTick()
      passphraseInput.value?.focus()
    }
  }
}

const categorizeError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'Authentication failed. Please try again.'
  }

  const message = error.message.toLowerCase()

  // Wrong passphrase - decryption failures
  if (
    message.includes('failed to decrypt mek') ||
    message.includes('failed to decrypt fek') ||
    message.includes('invalid lookup key') ||
    message.includes('decryption failed') ||
    message.includes('decrypt')
  ) {
    return 'Invalid email or passphrase. Please check your credentials and try again.'
  }

  // Network failures
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    error.name === 'NetworkError' ||
    error.name === 'TypeError'
  ) {
    return 'Network error. Please check your internet connection and try again.'
  }

  // Crypto failures (other than wrong passphrase)
  if (
    message.includes('crypto') ||
    message.includes('encryption') ||
    message.includes('key derivation') ||
    message.includes('argon2') ||
    message.includes('pbkdf2')
  ) {
    return 'Cryptographic operation failed. Please try again or refresh the page.'
  }

  // Storage failures
  if (
    message.includes('storage') ||
    message.includes('quota') ||
    message.includes('opfs')
  ) {
    return 'Storage error. Please ensure you have sufficient storage space.'
  }

  // Default fallback
  return 'Authentication failed. Please try again.'
}

const goBack = () => {
  errorMessage.value = ''
  step.value = 'email'
}

// Auto-focus input when step changes
watch(step, async () => {
  // Wait for DOM update
  await nextTick()
  
  // Wait for fade transition to complete (300ms)
  setTimeout(() => {
    if (step.value === 'email') {
      emailInput.value?.focus()
    } else {
      passphraseInput.value?.focus()
    }
  }, 350)
})
</script>

<template>
  <main>
    <div class="input-container">
      <!-- Transition wrapper for step changes -->
      <Transition name="fade" mode="out-in">
        <!-- Email input (step 1) -->
        <div v-if="step === 'email'" key="email" class="input-wrapper">
          <input
            ref="emailInput"
            v-model="email"
            type="email"
            placeholder="Email"
            @keyup.enter="handleEmailSubmit"
            autofocus
          />
        </div>
        
        <!-- Passphrase input (step 2) -->
        <div v-else key="passphrase" class="input-wrapper">
          <div class="input-container-relative">
            <input
              ref="passphraseInput"
              v-model="passphrase"
              type="password"
              placeholder="Passphrase"
              @keyup.enter="handlePassphraseSubmit"
              :disabled="isLoading"
            />
            <div v-if="isLoading" class="loading-pulse"></div>
          </div>
          <button v-if="!isLoading" @click="goBack" class="back-button">
            ← Back
          </button>
        </div>
      </Transition>
      
      <!-- Error message with transition -->
      <Transition name="fade">
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </Transition>
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
  background-size: 40% 100%, 40% 100%;
  background-position: -150% 0, -150% 0;
  background-repeat: no-repeat;
  animation: loading-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes loading-pulse {
  0% {
    background-position: -150% 0, -150% 0;
  }
  50% {
    background-position: 250% 0, -150% 0;
  }
  100% {
    background-position: 250% 0, 250% 0;
  }
}

.error-message {
  color: var(--color-error);
  font-size: 0.9rem;
  text-align: center;
  max-width: 35rem;
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
}

.back-button:hover {
  color: var(--color-foreground);
}

/* Fade transition for smooth step changes and status messages */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
