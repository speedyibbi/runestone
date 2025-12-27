<script lang="ts" setup>
// Graph panel - placeholder for future implementation
</script>

<template>
  <div class="sidebar-section">
    <div class="section-header">
      <span class="section-title">Graph View</span>
    </div>
    <div class="graph-placeholder">
      <p>Graph view coming soon</p>
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

.graph-placeholder {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.6;
}
</style>
