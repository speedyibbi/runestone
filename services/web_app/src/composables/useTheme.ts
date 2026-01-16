import { watch, computed, type ComputedRef } from 'vue'
import { useSessionStore } from '@/stores/session'
import type { ThemeSettings } from '@/interfaces/settings'

/**
 * Apply theme settings to CSS variables
 */
function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement

  // Apply primary colors
  root.style.setProperty('--color-accent', theme.accent)
  root.style.setProperty('--color-foreground', theme.foreground)
  root.style.setProperty('--color-background', theme.background)
  root.style.setProperty('--color-selection', theme.selection)
  root.style.setProperty('--color-selection-focused', theme.selectionFocused)
  root.style.setProperty('--color-muted', theme.muted)

  // Apply semantic colors
  root.style.setProperty('--color-error', theme.error)
  root.style.setProperty('--color-success', theme.success)
  root.style.setProperty('--color-warning', theme.warning)
  root.style.setProperty('--color-info', theme.info)

  // Apply font size scale
  root.style.setProperty('--scale', theme.scale.toString())
}

/**
 * Composable to watch and apply theme settings from session store
 */
export function useTheme(): {
  theme: ComputedRef<ThemeSettings | null>
} {
  const sessionStore = useSessionStore()

  // Computed theme from getSettings() - watches the store reactively
  const theme = computed<ThemeSettings | null>(() => {
    try {
      if (!sessionStore.isActive) {
        return null
      }
      const settings = sessionStore.getSettings()
      return settings.theme ?? null
    } catch {
      return null
    }
  })

  // Watch theme changes and apply to CSS
  watch(
    theme,
    (newTheme) => {
      if (newTheme) {
        applyTheme(newTheme)
      }
    },
    { immediate: true },
  )

  return {
    theme,
  }
}
