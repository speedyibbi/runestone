<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import Modal from '@/components/base/Modal.vue'
import { useSettings } from '@/composables/useSettings'
import type { Settings, ThemeSettings } from '@/interfaces/settings'

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

function getDefaultThemeValue<K extends keyof ThemeSettings>(
  key: K,
): ThemeSettings[K] {
  return settings.value?.theme?.[key] ?? ('' as ThemeSettings[K])
}

const isSyncEnabled = __APP_CONFIG__.global.featureFlags.sync

// Local form state (in minutes for display)
const autoSync = ref(getDefaultAutoSync())
const syncIntervalMinutes = ref(getDefaultSyncIntervalMinutes())

// Local form state for theme
const themeAccent = ref(getDefaultThemeValue('accent'))
const themeForeground = ref(getDefaultThemeValue('foreground'))
const themeBackground = ref(getDefaultThemeValue('background'))
const themeSelection = ref(getDefaultThemeValue('selection'))
const themeSelectionFocused = ref(getDefaultThemeValue('selectionFocused'))

// Helper function to extract RGB from hex (handles both 6 and 8 digit hex)
function extractRGB(hex: string): string {
  if (!hex || !hex.startsWith('#')) return '#000000'
  // Return first 7 characters (#RRGGBB) for color picker
  return hex.substring(0, 7)
}

// Helper function to update hex value from color picker (preserves alpha if present)
function updateHexFromPicker(currentValue: string, newRGB: string): string {
  if (!currentValue || !currentValue.startsWith('#')) return newRGB
  // If current value has alpha (8 digits), preserve it
  if (currentValue.length === 9) {
    return newRGB + currentValue.substring(7)
  }
  return newRGB
}

// Computed properties for selection colors to handle RGB extraction
const themeSelectionRGB = computed({
  get: () => extractRGB(themeSelection.value),
  set: (newValue: string) => {
    themeSelection.value = updateHexFromPicker(themeSelection.value, newValue)
  },
})

const themeSelectionFocusedRGB = computed({
  get: () => extractRGB(themeSelectionFocused.value),
  set: (newValue: string) => {
    themeSelectionFocused.value = updateHexFromPicker(themeSelectionFocused.value, newValue)
  },
})
const themeMuted = ref(getDefaultThemeValue('muted'))
const themeError = ref(getDefaultThemeValue('error'))
const themeSuccess = ref(getDefaultThemeValue('success'))
const themeWarning = ref(getDefaultThemeValue('warning'))
const themeInfo = ref(getDefaultThemeValue('info'))
const themeScale = ref(getDefaultThemeValue('scale'))

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

// Display value for theme scale (multiplied by 1000 for display) - preserve user input, format on blur
const themeScaleDisplayRaw = ref('')
const themeScaleDisplay = computed(() => {
  // If we have a raw value (user is typing), use it; otherwise format from actual value
  if (themeScaleDisplayRaw.value !== '') {
    return themeScaleDisplayRaw.value
  }
  // Format to always show at least one decimal place
  const value = themeScale.value * 1000
  return value.toFixed(1)
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

function handleScaleKeydown(event: KeyboardEvent) {
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
    const newValue = Math.max(10, Math.min(35, currentValue + step)).toFixed(1)
    target.value = newValue
    handleScaleInput(event as any)
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

function handleScaleInput(event: Event) {
  // Store raw value to allow free-form input
  const target = event.target as HTMLInputElement
  const value = target.value
  themeScaleDisplayRaw.value = value
  
  // Parse and update the underlying value
  const cleaned = value.replace(/[^0-9.]/g, '')
  const parsed = parseFloat(cleaned)
  if (!isNaN(parsed)) {
    // Clamp value between 10 and 100 (0.01 to 0.1 when divided by 1000)
    const clamped = Math.max(10, Math.min(100, parsed))
    // Convert from display value (multiplied by 1000) to actual value
    themeScale.value = clamped / 1000
  }
}

function handleScaleInputBlur() {
  // Format to 1 decimal place on blur, then clear raw value to use formatted
  const value = themeScale.value * 1000
  themeScaleDisplayRaw.value = ''
  // Force update by setting the formatted value
  const formatted = value.toFixed(1)
  themeScaleDisplayRaw.value = formatted
  setTimeout(() => {
    themeScaleDisplayRaw.value = ''
  }, 0)
}

// Watch settings and update form when they change
watch(
  () => settings.value,
  (newSettings) => {
    if (newSettings) {
      autoSync.value = newSettings.sync.autoSync
      syncIntervalMinutes.value = msToMinutes(newSettings.sync.syncInterval)
      
      // Update theme values
      if (newSettings.theme) {
        themeAccent.value = newSettings.theme.accent
        themeForeground.value = newSettings.theme.foreground
        themeBackground.value = newSettings.theme.background
        themeSelection.value = newSettings.theme.selection
        themeSelectionFocused.value = newSettings.theme.selectionFocused
        themeMuted.value = newSettings.theme.muted
        themeError.value = newSettings.theme.error
        themeSuccess.value = newSettings.theme.success
        themeWarning.value = newSettings.theme.warning
        themeInfo.value = newSettings.theme.info
        themeScale.value = newSettings.theme.scale
        // Clear raw display value to show formatted value
        themeScaleDisplayRaw.value = ''
      }
    } else {
      // Reset to defaults if settings become null
      autoSync.value = false
      syncIntervalMinutes.value = 0.1
      syncIntervalDisplayRaw.value = ''
      themeScaleDisplayRaw.value = ''
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
  const themeChanged =
    themeAccent.value !== currentTheme.accent ||
    themeForeground.value !== currentTheme.foreground ||
    themeBackground.value !== currentTheme.background ||
    themeSelection.value !== currentTheme.selection ||
    themeSelectionFocused.value !== currentTheme.selectionFocused ||
    themeMuted.value !== currentTheme.muted ||
    themeError.value !== currentTheme.error ||
    themeSuccess.value !== currentTheme.success ||
    themeWarning.value !== currentTheme.warning ||
    themeInfo.value !== currentTheme.info ||
    themeScale.value !== currentTheme.scale

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
      theme: {
        accent: themeAccent.value,
        foreground: themeForeground.value,
        background: themeBackground.value,
        selection: themeSelection.value,
        selectionFocused: themeSelectionFocused.value,
        muted: themeMuted.value,
        error: themeError.value,
        success: themeSuccess.value,
        warning: themeWarning.value,
        info: themeInfo.value,
        scale: themeScale.value,
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
    
    // Reset theme to saved values
    if (settings.value.theme) {
      themeAccent.value = settings.value.theme.accent
      themeForeground.value = settings.value.theme.foreground
      themeBackground.value = settings.value.theme.background
      themeSelection.value = settings.value.theme.selection
      themeSelectionFocused.value = settings.value.theme.selectionFocused
      themeMuted.value = settings.value.theme.muted
      themeError.value = settings.value.theme.error
      themeSuccess.value = settings.value.theme.success
      themeWarning.value = settings.value.theme.warning
      themeInfo.value = settings.value.theme.info
      themeScale.value = settings.value.theme.scale
    }
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
            <p class="setting-description">
              How often to automatically sync codexes.
            </p>
          </div>
        </div>

        <!-- Theme Settings Section -->
        <div class="settings-section">
          <h4 class="section-title">Theme</h4>

          <!-- Primary Colors -->
          <div class="setting-item">
            <label class="setting-label">
              <span class="setting-label-text">Primary Colors</span>
            </label>
            <div class="theme-color-grid">
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Accent</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeAccent"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeAccent"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Foreground</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeForeground"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeForeground"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Background</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeBackground"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeBackground"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Selection</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeSelectionRGB"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeSelection"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Selection Focused</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeSelectionFocusedRGB"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeSelectionFocused"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Muted</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeMuted"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeMuted"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Semantic Colors -->
          <div class="setting-item">
            <label class="setting-label">
              <span class="setting-label-text">Semantic Colors</span>
            </label>
            <div class="theme-color-grid">
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Error</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeError"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeError"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Success</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeSuccess"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeSuccess"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Warning</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeWarning"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeWarning"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
              <div class="theme-color-item">
                <label class="theme-color-label">
                  <span class="theme-color-name">Info</span>
                  <div class="theme-color-input-group">
                    <input
                      v-model="themeInfo"
                      type="color"
                      class="theme-color-picker"
                      :disabled="isSaving"
                    />
                    <input
                      v-model="themeInfo"
                      type="text"
                      class="theme-color-hex-input"
                      pattern="^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$"
                      :disabled="isSaving"
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Scale -->
          <div class="setting-item">
            <label class="setting-label">
              <span class="setting-label-text">App Scale</span>
            </label>
            <div class="setting-input-group">
              <input
                :value="themeScaleDisplay"
                type="text"
                inputmode="decimal"
                class="setting-input"
                :disabled="isSaving"
                @input="handleScaleInput"
                @keydown="handleScaleKeydown"
                @blur="handleScaleInputBlur"
              />
              <span class="setting-input-suffix">multiplier</span>
            </div>
            <p class="setting-description">
              Adjust the scale of the app.
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

.theme-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.theme-color-item {
  display: flex;
  flex-direction: column;
}

.theme-color-label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.theme-color-name {
  font-size: 0.8125rem;
  color: var(--color-muted);
  font-weight: 500;
}

.theme-color-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-color-picker {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid var(--color-overlay-border);
  border-radius: 6px;
  cursor: pointer;
  background: var(--color-background);
  transition: all 0.2s;
  -webkit-appearance: none;
  appearance: none;
  flex-shrink: 0;
}

.theme-color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
  border: none;
  border-radius: 5px;
}

.theme-color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 5px;
}

.theme-color-picker::-moz-color-swatch {
  border: none;
  border-radius: 5px;
}

.theme-color-picker:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-selection);
}

.theme-color-picker:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.theme-color-hex-input {
  flex: 1;
  height: 2.5rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-overlay-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: 0.875rem;
  font-family: var(--font-code);
  transition: all 0.2s;
  min-width: 0;
}

.theme-color-hex-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-selection);
}

.theme-color-hex-input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  background: var(--color-overlay-subtle);
}
</style>
