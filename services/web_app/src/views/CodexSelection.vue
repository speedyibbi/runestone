<script lang="ts" setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useCodex } from '@/composables/useCodex'

const {
  codexes,
  isLoadingCodex,
  loadingCodexId,
  loadCodexes,
  selectCodex,
  createCodex: createCodexFn,
} = useCodex()

const isCreating = ref(false)
const newCodexTitle = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

const hasFewCodexes = computed(() => codexes.value.length <= 3)
const isAnyCodexLoading = computed(() => loadingCodexId.value !== null)

onMounted(() => {
  loadCodexes()
})

// Auto-focus input when form opens
watch(isCreating, async (newValue) => {
  if (newValue) {
    await nextTick()
    // Wait for transition to complete (300ms)
    setTimeout(() => {
      titleInput.value?.focus()
    }, 350)
  }
})

function showCreateForm() {
  isCreating.value = true
  newCodexTitle.value = ''
}

async function createCodex() {
  const title = newCodexTitle.value.trim()
  
  const result = await createCodexFn(title)
  if (result) {
    isCreating.value = false
    newCodexTitle.value = ''
  }
}

function goBack() {
  if (!isLoadingCodex.value) {
    isCreating.value = false
    newCodexTitle.value = ''
  }
}
</script>

<template>
  <main>
    <div class="container">
      <h1>
        <Transition name="fade" mode="out-in">
          <span v-if="!isCreating" key="select">Select a Codex</span>
          <span v-else key="create">Create a Codex</span>
        </Transition>
      </h1>
      
      <!-- Main Content Area -->
      <div class="content-area">
        <Transition name="fade-list" mode="out-in">
          <div v-if="!isCreating" key="list-view" class="list-view">
            <!-- Codex List -->
            <div v-if="codexes.length > 0" class="codex-list" :class="{ 'few-items': hasFewCodexes }">
              <div
                v-for="codex in codexes"
                :key="codex.uuid"
                class="codex-item-wrapper"
              >
                <button
                  class="codex-item"
                  :class="{ 'loading': loadingCodexId === codex.uuid }"
                  :disabled="isAnyCodexLoading"
                  @click="selectCodex(codex.uuid)"
                >
                  <div class="codex-title">{{ codex.title }}</div>
                  <div class="codex-uuid">{{ codex.uuid }}</div>
                </button>
                <div v-if="loadingCodexId === codex.uuid" class="loading-pulse-codex"></div>
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-else class="empty-state">
              <p>No codexes yet. Create your first one!</p>
            </div>
          </div>
          
          <!-- Form View -->
          <div v-else key="form-view" class="form-view">
          </div>
        </Transition>
      </div>
      
      <!-- Create Section with Fixed Height -->
      <div class="create-section">
        <Transition name="fade" mode="out-in">
          <!-- Create Codex Form -->
          <div v-if="isCreating" key="form" class="create-form">
            <div class="input-container-relative">
              <input
                ref="titleInput"
                v-model="newCodexTitle"
                type="text"
                placeholder="Codex title"
                @keyup.enter="createCodex"
                @keyup.esc="goBack"
                :disabled="isLoadingCodex"
              />
              <div v-if="isLoadingCodex" class="loading-pulse"></div>
            </div>
            <button v-if="!isLoadingCodex" @click="goBack" class="back-button">
              ← Back
            </button>
          </div>
          
          <!-- Create Button -->
          <button 
            v-else 
            key="button" 
            class="create-button" 
            :disabled="isAnyCodexLoading"
            @click="showCreateForm"
          >
            + Create New Codex
          </button>
        </Transition>
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
  padding: 2rem 0;
}

.container {
  width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: var(--color-foreground);
  text-align: center;
  font-weight: 400;
  letter-spacing: -0.02em;
  flex-shrink: 0;
}

.content-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.list-view,
.form-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 2rem;
  overflow-y: auto;
  overflow-x: hidden;

  /* Hide scrollbar */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.codex-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1rem;
  padding: 0.5rem;
  margin-bottom: 3rem;
  flex-shrink: 1;
  min-height: 0;
  align-content: start;
  
}

@media (max-width: 40rem) {
  .codex-list {
    grid-template-columns: repeat(auto-fill, minmax(30rem, 1fr));
  }
}

/* Layout for few codexes (1-3 items) */
.codex-list.few-items {
  grid-template-columns: repeat(auto-fit, minmax(20rem, 25rem));
  justify-content: center;
  max-width: 80rem;
  margin: 0 auto 3rem auto;
}

.codex-item-wrapper {
  position: relative;
}

.codex-item {
  padding: 1.25rem;
  background: transparent;
  border: none;
  border-bottom: 0.0625rem solid var(--color-accent);
  color: var(--color-foreground);
  text-align: left;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 5rem;
  width: 100%;
}

.codex-item::after {
  content: '';
  position: absolute;
  bottom: -0.0625rem;
  left: 0;
  width: 0;
  height: 0.0625rem;
  background: var(--color-foreground);
  transition: width 0.3s ease;
}

.codex-item:not(:disabled):hover {
  background: var(--color-overlay-subtle);
  padding-left: 1.5rem;
}

.codex-item:not(:disabled):hover::after {
  width: 100%;
}

.codex-item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.codex-item.loading {
  cursor: wait;
  opacity: 1;
}

/* Loading pulse animation for codex items */
.loading-pulse-codex {
  position: absolute;
  bottom: -0.0625rem;
  left: 0;
  width: 100%;
  height: 0.0625rem;
  background: 
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%),
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%);
  background-size: 40% 100%, 40% 100%;
  background-position: -150% 0, -150% 0;
  background-repeat: no-repeat;
  animation: loading-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

.codex-title {
  font-size: 1rem;
  font-weight: 400;
  margin-bottom: 0.25rem;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.codex-uuid {
  font-size: 0.7rem;
  color: var(--color-accent);
  font-family: var(--font-code);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 2rem 0;
  color: var(--color-accent);
  margin-bottom: 3rem;
  font-size: 0.9rem;
  flex-shrink: 0;
}

/* Fixed height container to prevent layout shift */
.create-section {
  flex-shrink: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.create-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

/* Container for input and loading animation */
.input-container-relative {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.create-form input {
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

.create-form input::placeholder {
  color: var(--color-accent);
}

.create-form input:focus {
  outline: none;
  border-bottom-color: var(--color-foreground);
}

.create-form input:disabled {
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

.create-button {
  padding: 0.75rem 0;
  background: transparent;
  border: none;
  border-bottom: 0.0625rem solid var(--color-accent);
  color: var(--color-accent);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: -0.01em;
  width: 35rem;
}

.create-button:not(:disabled):hover {
  border-bottom-color: var(--color-foreground);
  color: var(--color-foreground);
}

.create-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Fade transitions for list/form content */
.fade-list-enter-active,
.fade-list-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-list-enter-from,
.fade-list-leave-to {
  opacity: 0;
}

/* Fade transitions for create section */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
