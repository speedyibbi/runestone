<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import Modal from '@/components/base/Modal.vue'
import { useSettings } from '@/composables/useSettings'
import type { Settings } from '@/interfaces/settings'
import { themePresets, findMatchingPreset, getThemePreset } from '@/utils/themePresets'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { settings, isSaving, updateSettings, isAvailable } = useSettings({
  showNotifications: false,
})

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

const selectedThemePresetId = ref<string>('default')

// Display value for sync interval - preserve user input, format on blur
const syncIntervalDisplayRaw = ref('')
const syncIntervalDisplay = computed(() => {
  // If we have a raw value (user is typing), use it; otherwise format from actual value
  if (syncIntervalDisplayRaw.value !== '') {
    return syncIntervalDisplayRaw.value
  }
  // Format to always show at least one decimal place
  const value = syncIntervalMinutes.value
  return value.toFixed(1)
})

const selectedTheme = computed(() => {
  const preset = getThemePreset(selectedThemePresetId.value)
  return preset?.theme ?? themePresets[0].theme
})

// Prevent negative input and format on blur
function handleInputKeydown(event: KeyboardEvent) {
  // Prevent minus sign, plus sign, and 'e' (scientific notation)
  if (event.key === '-' || event.key === '+' || event.key === 'e' || event.key === 'E') {
    event.preventDefault()
  }

  // Handle arrow keys to preserve decimals
  const target = event.target as HTMLInputElement
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    const currentValue = parseFloat(target.value) || 0
    const step = event.key === 'ArrowUp' ? 0.1 : -0.1
    const newValue = Math.max(0.1, Math.min(60, currentValue + step)).toFixed(1)
    target.value = newValue
    handleSyncIntervalInput(event as any)
  }
}

function handleSyncIntervalInput(event: Event) {
  // Store raw value to allow free-form input
  const target = event.target as HTMLInputElement
  const value = target.value
  syncIntervalDisplayRaw.value = value

  // Parse and update the underlying value
  const cleaned = value.replace(/[^0-9.]/g, '')
  const parsed = parseFloat(cleaned)
  if (!isNaN(parsed)) {
    // Clamp value between 0.1 and 60
    const clamped = Math.max(0.1, Math.min(60, parsed))
    syncIntervalMinutes.value = clamped
  }
}

function handleInputBlur() {
  // Format to 1 decimal place on blur, then clear raw value to use formatted
  const value = syncIntervalMinutes.value
  syncIntervalDisplayRaw.value = ''
  // Force update by setting the formatted value
  const formatted = value.toFixed(1)
  syncIntervalDisplayRaw.value = formatted
  setTimeout(() => {
    syncIntervalDisplayRaw.value = ''
  }, 0)
}


// Watch settings and update form when they change
watch(
  () => settings.value,
  (newSettings) => {
    if (newSettings) {
      autoSync.value = newSettings.sync.autoSync
      syncIntervalMinutes.value = msToMinutes(newSettings.sync.syncInterval)

      // Update theme preset selection
      if (newSettings.theme) {
        const matchingPreset = findMatchingPreset(newSettings.theme)
        selectedThemePresetId.value = matchingPreset ?? 'default'
      }
    } else {
      // Reset to defaults if settings become null
      autoSync.value = false
      syncIntervalMinutes.value = 0.1
      syncIntervalDisplayRaw.value = ''
      selectedThemePresetId.value = 'default'
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

  const syncChanged =
    autoSync.value !== settings.value.sync.autoSync ||
    currentIntervalMs !== settings.value.sync.syncInterval

  const currentTheme = settings.value.theme
  const selectedThemeValue = selectedTheme.value
  const themeChanged =
    selectedThemeValue.accent !== currentTheme.accent ||
    selectedThemeValue.foreground !== currentTheme.foreground ||
    selectedThemeValue.background !== currentTheme.background ||
    selectedThemeValue.selection !== currentTheme.selection ||
    selectedThemeValue.selectionFocused !== currentTheme.selectionFocused ||
    selectedThemeValue.muted !== currentTheme.muted ||
    selectedThemeValue.error !== currentTheme.error ||
    selectedThemeValue.success !== currentTheme.success ||
    selectedThemeValue.warning !== currentTheme.warning ||
    selectedThemeValue.info !== currentTheme.info ||
    selectedThemeValue.scale !== currentTheme.scale

  return syncChanged || themeChanged
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
      theme: selectedTheme.value,
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

    // Reset theme preset to match current settings
    if (settings.value.theme) {
      const matchingPreset = findMatchingPreset(settings.value.theme)
      selectedThemePresetId.value = matchingPreset ?? 'default'
    }
  } else {
    autoSync.value = false
    syncIntervalMinutes.value = 0.1
    selectedThemePresetId.value = 'default'
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
              Automatically sync codexes in the background at regular intervals.
            </p>
          </div>

          <div class="setting-item">
            <label class="setting-label">
              <span class="setting-label-text">Sync Interval</span>
            </label>
            <div class="setting-input-group">
              <input
                :value="syncIntervalDisplay"
                type="text"
                inputmode="decimal"
                class="setting-input"
                :disabled="isSaving || !autoSync"
                @input="handleSyncIntervalInput"
                @blur="handleInputBlur"
                @keydown="handleInputKeydown"
              />
              <span class="setting-input-suffix">minutes</span>
            </div>
            <p class="setting-description">How often to automatically sync codexes.</p>
          </div>
        </div>

        <!-- Theme Settings Section -->
        <div class="settings-section">
          <h4 class="section-title">Theme</h4>

          <!-- Theme Preset Selection -->
          <div class="setting-item">
            <label class="setting-label">
              <span class="setting-label-text">Theme Preset</span>
            </label>
            <div class="theme-preset-grid">
              <button
                v-for="preset in themePresets"
                :key="preset.id"
                type="button"
                class="theme-preset-button"
                :class="{ 'theme-preset-button-active': selectedThemePresetId === preset.id }"
                :disabled="isSaving"
                @click="selectedThemePresetId = preset.id"
              >
                <div class="theme-preset-preview">
                  <div
                    class="theme-preset-color"
                    :style="{ backgroundColor: preset.theme.background }"
                  >
                    <div
                      class="theme-preset-accent"
                      :style="{ backgroundColor: preset.theme.accent }"
                    ></div>
                    <div
                      class="theme-preset-foreground"
                      :style="{ color: preset.theme.foreground }"
                    >
                      Aa
                    </div>
                  </div>
                </div>
                <span class="theme-preset-name">{{ preset.name }}</span>
              </button>
            </div>
            <p class="setting-description">Choose a theme preset for the application.</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <button class="button button-secondary" :disabled="isSaving" @click="handleCancel">
        Cancel
      </button>
      <button class="button button-primary" :disabled="!canSave || isSaving" @click="handleSave">
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

.theme-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}

.theme-preset-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid var(--color-overlay-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--font-primary);
}

.theme-preset-button:hover:not(:disabled) {
  background: var(--color-overlay-subtle);
  border-color: var(--color-overlay-hover);
  transform: translateY(-1px);
}

.theme-preset-button:active:not(:disabled) {
  transform: translateY(0);
}

.theme-preset-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.theme-preset-button-active {
  border-color: var(--color-accent);
  background: var(--color-overlay-light);
  box-shadow: 0 0 0 2px var(--color-selection);
}

.theme-preset-preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-overlay-border);
}

.theme-preset-color {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0.5rem;
}

.theme-preset-accent {
  width: 100%;
  height: 30%;
  border-radius: 4px 4px 0 0;
}

.theme-preset-foreground {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
  padding: 0.25rem;
}

.theme-preset-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-foreground);
}
</style>
