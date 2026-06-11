<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()

const passphrase = ref('')
const error = ref('')
const loading = ref(false)

async function submit(mode: 'login' | 'signup') {
  if (!passphrase.value.trim()) return
  error.value = ''
  loading.value = true
  try {
    await session.setup(passphrase.value, mode)
    router.push('/codexes')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main>
    <h1>Runestone</h1>
    <input
      v-model="passphrase"
      type="password"
      placeholder="Passphrase"
      autocomplete="current-password"
      :disabled="loading"
      @keydown.enter="submit('login')"
    />
    <p v-if="error" role="alert">{{ error }}</p>
    <button :disabled="loading || !passphrase.trim()" @click="submit('login')">Log in</button>
    <button :disabled="loading || !passphrase.trim()" @click="submit('signup')">Sign up</button>
  </main>
</template>
