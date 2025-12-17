<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const sessionStore = useSessionStore()

const codexes = ref<Array<{ uuid: string; title: string }>>([])
const isCreating = ref(false)
const newCodexTitle = ref('')

onMounted(() => {
  loadCodexes()
})

function loadCodexes() {
  codexes.value = sessionStore.listCodexes()
}

async function selectCodex(codexId: string) {
  try {
    await sessionStore.openCodex(codexId)
    router.push(`/codex/${codexId}`)
  } catch (error) {
    console.error('Failed to open codex:', error)
    alert('Failed to open codex: ' + (error instanceof Error ? error.message : String(error)))
  }
}

function showCreateForm() {
  isCreating.value = true
  newCodexTitle.value = ''
}

async function createCodex() {
  const title = newCodexTitle.value.trim()
  
  if (!title) {
    alert('Please enter a codex title')
    return
  }

  try {
    const codexId = await sessionStore.createCodex(title)
    loadCodexes()
    isCreating.value = false
    
    // Auto-open the newly created codex
    await selectCodex(codexId)
  } catch (error) {
    console.error('Failed to create codex:', error)
    alert('Failed to create codex: ' + (error instanceof Error ? error.message : String(error)))
  }
}

function cancelCreate() {
  isCreating.value = false
  newCodexTitle.value = ''
}
</script>

<template>
  <main>
    <div class="container">
      <h1>Select a Codex</h1>
      
      <!-- Codex List -->
      <div v-if="codexes.length > 0" class="codex-list">
        <button
          v-for="codex in codexes"
          :key="codex.uuid"
          class="codex-item"
          @click="selectCodex(codex.uuid)"
        >
          <div class="codex-title">{{ codex.title }}</div>
          <div class="codex-uuid">{{ codex.uuid }}</div>
        </button>
      </div>
      
      <!-- Empty State -->
      <div v-else class="empty-state">
        <p>No codexes yet. Create your first one!</p>
      </div>
      
      <!-- Create Codex Form -->
      <div v-if="isCreating" class="create-form">
        <input
          v-model="newCodexTitle"
          type="text"
          placeholder="Codex title"
          @keyup.enter="createCodex"
          @keyup.esc="cancelCreate"
          autofocus
        />
        <div class="form-buttons">
          <button @click="createCodex">Create</button>
          <button @click="cancelCreate">Cancel</button>
        </div>
      </div>
      
      <!-- Create Button -->
      <button v-else class="create-button" @click="showCreateForm">
        + Create New Codex
      </button>
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
  padding: 2rem;
}

.container {
  max-width: 600px;
  width: 100%;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: var(--color-foreground);
  text-align: center;
}

.codex-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.codex-item {
  padding: 1rem;
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-foreground);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.codex-item:hover {
  background: var(--color-overlay-light);
  border-color: var(--color-foreground);
}

.codex-title {
  font-size: 1.2rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.codex-uuid {
  font-size: 0.75rem;
  color: var(--color-accent);
  opacity: 0.7;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--color-accent);
  margin-bottom: 2rem;
}

.create-form {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--color-accent);
}

.create-form input {
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-accent);
  color: var(--color-foreground);
  font-size: 1rem;
}

.create-form input:focus {
  outline: none;
  border-bottom-color: var(--color-foreground);
}

.form-buttons {
  display: flex;
  gap: 0.5rem;
}

.form-buttons button {
  flex: 1;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-foreground);
  cursor: pointer;
}

.form-buttons button:hover {
  background: var(--color-overlay-light);
  border-color: var(--color-foreground);
}

.create-button {
  width: 100%;
  padding: 1rem;
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-button:hover {
  background: var(--color-overlay-light);
  border-color: var(--color-foreground);
  color: var(--color-foreground);
}
</style>
