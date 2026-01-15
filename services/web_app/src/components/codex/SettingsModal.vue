<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import Modal from '@/components/base/Modal.vue'
import { useSettings } from '@/composables/useSettings'
import type { Settings, SyncSettings } from '@/interfaces/settings'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { settings, isSaving, updateSettings, isAvailable } = useSettings({ showNotifications: false })

// Convert milliseconds to minutes
function msToMinutes(ms: number): number {
  return ms / (60 * 1000)
}

// Convert minutes to milliseconds
function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000
}

// Get default values from settings or use fallbacks
function getDefaultAutoSync(): boolean {
  return settings.value?.sync.autoSync ?? false
}

function getDefaultSyncIntervalMinutes(): number {
  if (settings.value) {
    return msToMinutes(settings.value.sync.syncInterval)
  }
  return 0.1
}

const isSyncEnabled = __APP_CONFIG__.global.featureFlags.sync

// Local form state (in minutes for display)
const autoSync = ref(getDefaultAutoSync())
const syncIntervalMinutes = ref(getDefaultSyncIntervalMinutes())

// Display value for sync interval (formatted with .0 for whole numbers)
const syncIntervalDisplay = computed({
  get: () => {
    const value = syncIntervalMinutes.value
    // Format to always show one decimal place
    return value.toFixed(1)
  },
  set: (newValue: string | number) => {
    // Convert to string if it's a number
    const stringValue = typeof newValue === 'number' ? newValue.toString() : String(newValue)
    // Remove negative signs and any invalid characters
    const cleaned = stringValue.replace(/[^0-9.]/g, '')
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      // Clamp value between 0.1 and 60
      const clamped = Math.max(0.1, Math.min(60, parsed))
      syncIntervalMinutes.value = clamped
    }
  },
})

// Prevent negative input and format on blur
function handleInputKeydown(event: KeyboardEvent) {
  // Prevent minus sign, plus sign, and 'e' (scientific notation)
  if (event.key === '-' || event.key === '+' || event.key === 'e' || event.key === 'E') {
    event.preventDefault()
  }
}

function handleInputBlur() {
  // Ensure value is formatted with .0 on blur
  syncIntervalDisplay.value = syncIntervalDisplay.value
}

// Watch settings and update form when they change
watch(
  () => settings.value,
  (newSettings) => {
    if (newSettings) {
      autoSync.value = newSettings.sync.autoSync
      syncIntervalMinutes.value = msToMinutes(newSettings.sync.syncInterval)
    } else {
      // Reset to defaults if settings become null
      autoSync.value = false
      syncIntervalMinutes.value = 0.1
    }
  },
  { immediate: true },
)

// Watch show prop to refresh settings when modal opens
watch(
  () => props.show,
  (show) => {
    if (show && isAvailable.value) {
      // Settings are already reactive, but we can ensure they're fresh
      // The composable automatically watches session store
    }
  },
)

const canSave = computed(() => {
  if (!settings.value) return false
  const currentIntervalMs = minutesToMs(syncIntervalMinutes.value)
  return (
    autoSync.value !== settings.value.sync.autoSync ||
    currentIntervalMs !== settings.value.sync.syncInterval
  )
})

async function handleSave() {
  if (!canSave.value || !settings.value) return

  try {
    // Convert minutes to milliseconds for storage
    const syncIntervalMs = minutesToMs(syncIntervalMinutes.value)
    
    const updatedSettings: Partial<Settings> = {
      sync: {
        autoSync: autoSync.value,
        syncInterval: syncIntervalMs,
      },
    }

    await updateSettings(updatedSettings)
    emit('update:show', false)
  } catch (error) {
    // Error is handled by the composable
    console.error('Failed to save settings:', error)
  }
}

function handleCancel() {
  // Reset form to current settings or defaults
  if (settings.value) {
    autoSync.value = settings.value.sync.autoSync
    syncIntervalMinutes.value = msToMinutes(settings.value.sync.syncInterval)
  } else {
    autoSync.value = false
    syncIntervalMinutes.value = 0.1
  }
  emit('update:show', false)
}
</script>

<template>
  <Modal
    :show="show"
    title="Settings"
    max-width="32rem"
    :confirm-text="'Save'"
    :cancel-text="'Cancel'"
    @update:show="emit('update:show', $event)"
    @confirm="handleSave"
    @cancel="handleCancel"
  >
    <template #default>
      <div v-if="!isAvailable" class="settings-unavailable">
        <p>Settings are not available. Please ensure you are logged in.</p>
      </div>

      <div v-else class="settings-content">
        <!-- Sync Settings Section -->
        <div v-if="isSyncEnabled" class="settings-section">
          <h4 class="section-title">Sync</h4>

          <div class="setting-item">
            <label class="setting-label">
              <input
                v-model="autoSync"
                type="checkbox"
                class="setting-checkbox"
                :disabled="isSaving"
              />
              <span class="setting-label-text">Auto Sync</span>
            </label>
            <p class="setting-description">
              Automatically sync codex in the background at regular intervals.
            </p>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="setting-label-text">Sync Interval</span>
            </label>
            <div class="setting-input-group">
              <input
                v-model="syncIntervalDisplay"
                type="number"
                min="0.1"
                max="60"
                step="0.1"
                class="setting-input"
                :disabled="isSaving || !autoSync"
                @blur="handleInputBlur"
                @keydown="handleInputKeydown"
              />
              <span class="setting-input-suffix">minutes</span>
            </div>
            <p class="setting-description">
              How often to automatically sync codex.
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <button
        class="button button-secondary"
        :disabled="isSaving"
        @click="handleCancel"
      >
        Cancel
      </button>
      <button
        class="button button-primary"
        :disabled="!canSave || isSaving"
        @click="handleSave"
      >
        <span v-if="isSaving">Saving...</span>
        <span v-else>Save</span>
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.settings-unavailable {
  padding: 1rem 0;
  text-align: center;
}

.settings-unavailable p {
  color: var(--color-muted);
  font-size: 0.9375rem;
  margin: 0;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-foreground);
  margin: 0;
  letter-spacing: -0.01em;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.setting-checkbox {
  width: 1.125rem;
  height: 1.125rem;
  cursor: pointer;
  accent-color: var(--color-accent);
  flex-shrink: 0;
  appearance: checkbox;
  -webkit-appearance: checkbox;
  border: 1px solid var(--color-overlay-border);
  border-radius: 4px;
  background: var(--color-background);
  margin: 0;
}

.setting-checkbox:checked {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.setting-checkbox:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.setting-label-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-foreground);
}

.setting-description {
  font-size: 0.8125rem;
  color: var(--color-muted);
  margin: 0;
  line-height: 1.5;
}

.setting-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.setting-input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 6px;
  color: var(--color-foreground);
  font-size: 0.9375rem;
  font-family: var(--font-primary);
  transition: all 0.2s;
  max-width: 10rem;
}

.setting-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-selection);
}

.setting-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  background: var(--color-overlay-subtle);
}

/* Hide number input arrows/spinners */
.setting-input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.setting-input[type='number']::-webkit-outer-spin-button,
.setting-input[type='number']::-webkit-inner-spin-button {
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
}

.setting-input-suffix {
  font-size: 0.875rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-primary);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.button-secondary {
  background: transparent;
  color: var(--color-foreground);
  border: 1px solid var(--color-overlay-border);
}

.button-secondary:hover:not(:disabled) {
  background: var(--color-overlay-subtle);
}

.button-primary {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.button-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.button-primary:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
