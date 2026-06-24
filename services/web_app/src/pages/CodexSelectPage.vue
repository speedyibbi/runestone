<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()

const codexes = ref<Array<{ uuid: string; title: string }>>([])
const newTitle = ref('')
const error = ref('')
const loading = ref(false)

function refresh() {
  codexes.value = session.listCodexes()
}

onMounted(refresh)

function openCodex(uuid: string) {
  router.push(`/codex/${uuid}`)
}

async function createCodex() {
  const title = newTitle.value.trim()
  if (!title) return
  error.value = ''
  loading.value = true
  try {
    const uuid = await session.createCodex(title)
    newTitle.value = ''
    router.push(`/codex/${uuid}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create codex'
  } finally {
    loading.value = false
  }
}

async function deleteCodex(uuid: string) {
  error.value = ''
  loading.value = true
  try {
    // deleteCodex() operates on the open codex, so open it first
    await session.openCodex(uuid)
    await session.deleteCodex()
    refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete codex'
  } finally {
    loading.value = false
  }
}

function logout() {
  session.teardown()
  router.push('/auth')
}
</script>

<template>
  <main>
    <h1>Codexes</h1>
    <button @click="logout">Log out</button>
    <ul>
      <li v-for="codex in codexes" :key="codex.uuid">
        <span>{{ codex.title }}</span>
        <button :disabled="loading" @click="openCodex(codex.uuid)">Open</button>
        <button :disabled="loading" @click="deleteCodex(codex.uuid)">Delete</button>
      </li>
      <li v-if="codexes.length === 0">No codexes yet.</li>
    </ul>
    <div>
      <input
        v-model="newTitle"
        placeholder="New codex title"
        :disabled="loading"
        @keydown.enter="createCodex"
      />
      <button :disabled="loading || !newTitle.trim()" @click="createCodex">Create</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </main>
</template>
