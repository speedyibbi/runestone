import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import type { Settings, SyncSettings } from '@/interfaces/settings'

// ==================== Interfaces ====================

export interface UseSettingsOptions {
  showNotifications?: boolean
}

export interface UseSettingsReturn {
  // State
  settings: Ref<Settings | null>
  isLoading: Ref<boolean>
  isSaving: Ref<boolean>
  error: Ref<Error | null>

  // Computed
  isAvailable: ComputedRef<boolean>

  // Operations
  refresh: () => void
  updateSettings: (partialSettings: Partial<Settings>) => Promise<void>
  clearError: () => void
}

// ==================== Main Composable ====================

export function useSettings(options: UseSettingsOptions = {}): UseSettingsReturn {
  const { showNotifications = true } = options

  // Stores and utilities
  const sessionStore = useSessionStore()
  const toast = useToast()

  // ==================== State ====================

  const settings = ref<Settings | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<Error | null>(null)

  // ==================== Computed Properties ====================

  const isAvailable = computed(() => {
    return sessionStore.isActive && settings.value !== null
  })

  // ==================== Utility Functions ====================

  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  /**
   * Set error state
   */
  function setError(err: Error | string, showToast = true) {
    const errorObj = typeof err === 'string' ? new Error(err) : err
    error.value = errorObj

    if (showToast && showNotifications) {
      toast.error(errorObj.message)
    }
  }

  // ==================== Settings Operations ====================

  /**
   * Refresh settings from the session store
   */
  function refresh() {
    clearError()

    try {
      if (!sessionStore.isActive) {
        settings.value = null
        return
      }

      settings.value = sessionStore.getSettings()
    } catch (err) {
      setError(err as Error)
      settings.value = null
    }
  }

  /**
   * Update settings
   */
  async function updateSettings(partialSettings: Partial<Settings>): Promise<void> {
    clearError()
    isSaving.value = true

    try {
      if (!sessionStore.isActive) {
        throw new Error('Session is not active')
      }

      await sessionStore.saveSettings(partialSettings)

      // Refresh settings from store to get updated values
      settings.value = sessionStore.getSettings()

      if (showNotifications) {
        toast.success('Settings saved successfully')
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSaving.value = false
    }
  }

  // ==================== Watchers ====================

  // Watch for session store changes and refresh settings
  watch(
    () => sessionStore.isActive,
    (isActive) => {
      if (isActive) {
        refresh()
      } else {
        settings.value = null
      }
    },
    { immediate: true },
  )

  // ==================== Return ====================

  return {
    // State
    settings,
    isLoading,
    isSaving,
    error,

    // Computed
    isAvailable,

    // Operations
    refresh,
    updateSettings,
    clearError,
  }
}
