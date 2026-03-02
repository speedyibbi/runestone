import type { ThemeSettings } from '@/interfaces/settings'

export interface ThemePreset {
  id: string
  name: string
  theme: ThemeSettings
}

/**
 * Default dark theme (current default)
 */
export const defaultTheme: ThemeSettings = {
  accent: '#4f535b',
  foreground: '#ffffff',
  background: '#000000',
  selection: '#4f535b4d',
  selectionFocused: '#4f535b66',
  muted: '#888888',
  error: '#c97373',
  success: '#51c997',
  warning: '#e8a862',
  info: '#739dc9',
  scale: 0.0175,
}

/**
 * Light theme
 */
export const lightTheme: ThemeSettings = {
  accent: '#6b7280',
  foreground: '#000000',
  background: '#ffffff',
  selection: '#6b72804d',
  selectionFocused: '#6b728066',
  muted: '#6b7280',
  error: '#dc2626',
  success: '#16a34a',
  warning: '#ea580c',
  info: '#2563eb',
  scale: 0.0175,
}

/**
 * Available theme presets
 */
export const themePresets: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    theme: defaultTheme,
  },
  {
    id: 'light',
    name: 'Light',
    theme: lightTheme,
  },
]

/**
 * Get a theme preset by ID
 */
export function getThemePreset(id: string): ThemePreset | undefined {
  return themePresets.find((preset) => preset.id === id)
}

/**
 * Find which preset matches the given theme settings
 * Returns the preset ID if a match is found, or null if no preset matches
 */
export function findMatchingPreset(theme: ThemeSettings): string | null {
  for (const preset of themePresets) {
    if (themesMatch(preset.theme, theme)) {
      return preset.id
    }
  }
  return null
}

/**
 * Check if two theme settings match
 */
function themesMatch(theme1: ThemeSettings, theme2: ThemeSettings): boolean {
  return (
    theme1.accent === theme2.accent &&
    theme1.foreground === theme2.foreground &&
    theme1.background === theme2.background &&
    theme1.selection === theme2.selection &&
    theme1.selectionFocused === theme2.selectionFocused &&
    theme1.muted === theme2.muted &&
    theme1.error === theme2.error &&
    theme1.success === theme2.success &&
    theme1.warning === theme2.warning &&
    theme1.info === theme2.info &&
    theme1.scale === theme2.scale
  )
}
