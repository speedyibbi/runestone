<script lang="ts" setup>
import { computed } from 'vue'

interface Props {
  currentRuneTitle: string | null
  hasOpenRune: boolean
  lines: number
  words: number
  cursorLine: number
  cursorColumn: number
  statusMessage?: string | null
  statusType?: 'info' | 'success' | 'warning' | 'error' | null
  isSaving?: boolean
  hasError?: boolean
  hasUnsavedChanges?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  statusMessage: null,
  statusType: null,
  isSaving: false,
  hasError: false,
  hasUnsavedChanges: false,
})

const statusClass = computed(() => {
  if (!props.statusType) return ''
  return `status-message--${props.statusType}`
})

const displayStatusMessage = computed(() => {
  // Priority: explicit status message > save status
  if (props.statusMessage) {
    return props.statusMessage
  }
  
  if (props.isSaving) {
    return 'Saving...'
  }
  
  if (props.hasError) {
    return 'Error saving'
  }
  
  if (props.hasUnsavedChanges) {
    return 'Unsaved changes'
  }
  
  return null
})

const displayStatusType = computed(() => {
  // Priority: explicit status type > inferred from save status
  if (props.statusType) {
    return props.statusType
  }
  
  if (props.isSaving) {
    return 'info'
  }
  
  if (props.hasError) {
    return 'error'
  }
  
  if (props.hasUnsavedChanges) {
    return 'warning'
  }
  
  return null
})

const displayStatusClass = computed(() => {
  const type = displayStatusType.value
  if (!type) return ''
  return `status-message--${type}`
})
</script>

<template>
  <footer class="status-bar">
    <div class="status-bar-left">
      <span v-if="displayStatusMessage" :class="['status-item', 'status-message', displayStatusClass]">
        {{ displayStatusMessage }}
      </span>
      <template v-else>
        <span v-if="currentRuneTitle" class="status-item">{{ currentRuneTitle }}</span>
        <span v-else class="status-item">No document open</span>
      </template>
    </div>
    <div class="status-bar-right">
      <span v-if="hasOpenRune" class="status-item">
        {{ lines }} {{ lines === 1 ? 'line' : 'lines' }}
      </span>
      <span v-if="hasOpenRune" class="status-item">
        {{ words }} {{ words === 1 ? 'word' : 'words' }}
      </span>
      <span v-if="hasOpenRune" class="status-item"> {{ cursorLine }}:{{ cursorColumn }} </span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.875rem;
  height: 1.5rem;
  min-height: 1.5rem;
  border-top: 1px solid var(--color-overlay-subtle);
  background: transparent;
  font-size: 0.6875rem;
  user-select: none;
}

.status-bar-left,
.status-bar-right {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.status-item {
  color: var(--color-muted);
  opacity: 0.65;
  font-size: 0.6875rem;
  white-space: nowrap;
  font-weight: 400;
  letter-spacing: 0.01em;
}

.status-message {
  opacity: 1;
  font-weight: 500;
}

.status-message--info {
  color: var(--color-info);
}

.status-message--success {
  color: var(--color-success);
}

.status-message--warning {
  color: var(--color-warning);
}

.status-message--error {
  color: var(--color-error);
}
</style>
