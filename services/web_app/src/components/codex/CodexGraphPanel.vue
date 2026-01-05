<script lang="ts" setup>
interface Emits {
  (e: 'openGraph'): void
}

const emit = defineEmits<Emits>()

function handleOpenGraph() {
  emit('openGraph')
}
</script>

<template>
  <div class="sidebar-section">
    <div class="section-header">
      <span class="section-title">Graph View</span>
    </div>
    <div class="graph-content">
      <p class="graph-description">Visualize connections between your runes</p>
      <button class="open-graph-button" @click="handleOpenGraph">
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        Open Graph View
      </button>
    </div>
  </div>
</template>

<style scoped>
.sidebar-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem 0.75rem 1rem;
  margin-bottom: 0.25rem;
}

.section-title {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
}

.graph-content {
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.graph-description {
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.7;
  margin: 0;
  line-height: 1.5;
}

.open-graph-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--color-overlay-subtle);
  border: 1px solid var(--color-overlay-light);
  border-radius: 6px;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.open-graph-button:hover {
  background: var(--color-overlay-light);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.open-graph-button svg {
  flex-shrink: 0;
}
</style>
