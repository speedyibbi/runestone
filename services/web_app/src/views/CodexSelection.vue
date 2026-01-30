<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useCodex } from '@/composables/useCodex'
import { useToast } from '@/composables/useToast'
import FadeTransition from '@/components/base/FadeTransition.vue'
import LoadingPulseInput from '@/components/base/LoadingPulseInput.vue'
import Loader from '@/components/base/Loader.vue'

const router = useRouter()
const toast = useToast()

const {
  codexes,
  isLoadingCodex,
  openCodex: openCodexComposable,
  createCodex: createCodexComposable,
  refreshCodexList,
} = useCodex()

const isCreating = ref(false)
const showCreateForm = ref(false)
const newCodexTitle = ref('')
const openingCodexId = ref<string | null>(null)
const titleInput = ref<InstanceType<typeof LoadingPulseInput> | null>(null)

const hasCodexes = computed(() => codexes.value.length > 0)
const isFewItems = computed(() => codexes.value.length <= 3)

async function openCodex(codexId: string) {
  openingCodexId.value = codexId

  try {
    await openCodexComposable(codexId)

    router.push(`/codex/${codexId}`)
  } catch (err) {
    console.error('Error opening codex:', err)
    openingCodexId.value = null
  }
}

function showCreate() {
  showCreateForm.value = true
  nextTick(() => {
    titleInput.value?.focus()
  })
}

function cancelCreate() {
  showCreateForm.value = false
  newCodexTitle.value = ''
}

async function createCodex() {
  if (!newCodexTitle.value.trim()) {
    toast.error('Codex title cannot be empty')
    await nextTick()
    titleInput.value?.focus()
    return
  }

  isCreating.value = true

  try {
    await createCodexComposable(newCodexTitle.value.trim())

    newCodexTitle.value = ''
    showCreateForm.value = false
  } catch (err) {
    console.error('Error creating codex:', err)
  } finally {
    isCreating.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !isCreating.value) {
    createCodex()
  } else if (event.key === 'Escape') {
    cancelCreate()
  }
}

function handleTransitionComplete() {
  if (showCreateForm.value) {
    titleInput.value?.focus()
  }
}

onMounted(() => {
  refreshCodexList()
})
</script>

<template>
  <main>
    <div class="container">
      <FadeTransition mode="out-in" @after-enter="handleTransitionComplete">
        <!-- List View -->
        <div v-if="!showCreateForm" key="list-view" class="view">
          <h1>Select a Codex</h1>

          <!-- Main Content Area -->
          <div class="content-area">
            <!-- Codex List -->
            <div v-if="hasCodexes" :class="['codex-list', { 'few-items': isFewItems, 'many-items': !isFewItems }]">
              <div v-for="codex in codexes" :key="codex.uuid" class="codex-item-wrapper">
                <button
                  :class="['codex-item', { loading: openingCodexId === codex.uuid }]"
                  :disabled="openingCodexId !== null"
                  @click="openCodex(codex.uuid)"
                >
                  <div class="codex-title">{{ codex.title }}</div>
                  <div class="codex-uuid">{{ codex.uuid }}</div>
                  <div v-if="openingCodexId === codex.uuid" class="loading-pulse-codex"></div>
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="!isLoadingCodex" class="empty-state">
              <p>No codexes yet.</p>
            </div>

            <!-- Loading State -->
            <div v-else class="empty-state">
              <Loader message="Loading codexes..." />
            </div>
          </div>

          <!-- Create Button -->
          <div class="create-section">
            <button class="create-button" :disabled="openingCodexId !== null" @click="showCreate">
              + Create New Codex
            </button>
          </div>
        </div>

        <!-- Create View -->
        <div v-else key="create-view" class="view">
          <h1>Create a Codex</h1>

          <div class="content-area create-content">
            <div class="create-form">
              <LoadingPulseInput
                ref="titleInput"
                v-model="newCodexTitle"
                type="text"
                placeholder="Codex title"
                :loading="isCreating"
                @keydown="handleKeydown"
              />
              <button v-if="!isCreating" class="back-button" @click="cancelCreate">
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
          </div>
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
  padding: 2rem 0;
}

.container {
  width: 100%;
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.view {
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
  padding: 0 2rem;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;

  /* Hide scrollbar */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.create-content {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
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
  border-bottom: 1px solid var(--color-accent);
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
  font-size: 0.9rem;
  flex-shrink: 0;
}

.create-section {
  flex-shrink: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.create-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
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

.create-button {
  padding: 0.75rem 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: -0.01em;
  width: 35rem;
  max-width: 90vw;
}

.create-button:not(:disabled):hover {
  border-bottom-color: var(--color-foreground);
  color: var(--color-foreground);
}

.create-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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

/* Mobile view - max-width: 1023px */
@media (max-width: 1023px) {
  main {
    height: 100vh;
    padding: 1rem 0;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Allow overflow when showing create form */
  main:has(.create-content) {
    overflow: visible;
  }

  .container {
    height: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .view {
    height: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    justify-content: center;
  }

  /* Create view should allow overflow for back button */
  .view:has(.create-content) {
    overflow: visible;
  }

  /* When list has many items, space between title and button */
  .view:has(.codex-list.many-items) {
    justify-content: space-between;
  }

  h1 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    margin-top: 0;
  }

  .content-area {
    padding: 0 1rem;
    overflow: hidden;
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    flex-shrink: 1;
    flex: 0 1 auto;
  }

  /* Create content area should allow overflow for back button and loading pulse */
  .content-area.create-content {
    overflow: visible;
    padding-bottom: 4rem; /* Extra space for back button */
  }

  /* When list has many items, take up available space */
  .content-area:has(.codex-list.many-items) {
    flex: 1;
    min-height: 0;
    justify-content: flex-start;
  }

  /* Mobile view - vertical list instead of grid */
  .codex-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0;
    padding: 0;
    margin: 0 auto;
    width: 100%;
    max-width: 90vw;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  /* When list has few items, allow it to shrink and center - no scrolling */
  .codex-list.few-items {
    flex-shrink: 1;
    max-height: none;
    overflow-y: visible;
    margin-bottom: 0;
  }

  /* When list has many items, make it scrollable and take available space */
  .codex-list.many-items {
    flex: 1;
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;

    /* Hide scrollbar */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }

  .codex-list.many-items::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Edge */
  }

  .codex-item-wrapper {
    width: 100%;
    flex-shrink: 0;
  }

  .codex-item {
    width: 100%;
    border-bottom: 2px solid var(--color-overlay-border);
  }

  .codex-item::after {
    display: none;
  }

  .codex-item:not(:disabled):hover {
    background: var(--color-overlay-subtle);
    padding-left: 1.25rem;
  }

  .codex-item:not(:disabled):hover::after {
    display: none;
  }

  .create-section {
    padding: 1.5rem 0;
  }

  .create-button {
    width: 100%;
    max-width: 90vw;
  }
}
</style>
