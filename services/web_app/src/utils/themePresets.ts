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
 * Nord theme - Arctic, north-bluish color palette
 */
export const nordTheme: ThemeSettings = {
  accent: '#5E81AC',
  foreground: '#ECEFF4',
  background: '#2E3440',
  selection: '#5E81AC4d',
  selectionFocused: '#5E81AC66',
  muted: '#4C566A',
  error: '#BF616A',
  success: '#A3BE8C',
  warning: '#EBCB8B',
  info: '#81A1C1',
  scale: 0.0175,
}

/**
 * Dracula theme - Dark theme with vibrant purple/pink accents
 */
export const draculaTheme: ThemeSettings = {
  accent: '#BD93F9',
  foreground: '#F8F8F2',
  background: '#282A36',
  selection: '#BD93F94d',
  selectionFocused: '#BD93F966',
  muted: '#6272A4',
  error: '#FF5555',
  success: '#50FA7B',
  warning: '#F1FA8C',
  info: '#8BE9FD',
  scale: 0.0175,
}

/**
 * Solarized Dark theme - Carefully balanced dark theme
 */
export const solarizedDarkTheme: ThemeSettings = {
  accent: '#268BD2',
  foreground: '#839496',
  background: '#002B36',
  selection: '#268BD24d',
  selectionFocused: '#268BD266',
  muted: '#586E75',
  error: '#DC322F',
  success: '#859900',
  warning: '#B58900',
  info: '#2AA198',
  scale: 0.0175,
}

/**
 * Warm Dark theme - Dark theme with warm amber/orange tones
 */
export const warmDarkTheme: ThemeSettings = {
  accent: '#D4A574',
  foreground: '#E8E8E8',
  background: '#1E1E1E',
  selection: '#D4A5744d',
  selectionFocused: '#D4A57466',
  muted: '#8B7355',
  error: '#C97B7B',
  success: '#A8C99E',
  warning: '#D4A574',
  info: '#9DB4C4',
  scale: 0.0175,
}

/**
 * High Contrast theme - Accessibility-focused high contrast theme
 */
export const highContrastTheme: ThemeSettings = {
  accent: '#FF00FF',
  foreground: '#FFFFFF',
  background: '#000000',
  selection: '#FF00FF4d',
  selectionFocused: '#FF00FF66',
  muted: '#CCCCCC',
  error: '#FF4444',
  success: '#00FF00',
  warning: '#FFFF00',
  info: '#FF00FF',
  scale: 0.0175,
}

/**
 * Hacker theme - Classic terminal green on black aesthetic
 */
export const hackerTheme: ThemeSettings = {
  accent: '#00FF00',
  foreground: '#00FF00',
  background: '#000000',
  selection: '#00FF004d',
  selectionFocused: '#00FF0066',
  muted: '#00AA00',
  error: '#FF0000',
  success: '#00FF00',
  warning: '#FFFF00',
  info: '#00FFFF',
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
  {
    id: 'nord',
    name: 'Nord',
    theme: nordTheme,
  },
  {
    id: 'dracula',
    name: 'Dracula',
    theme: draculaTheme,
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    theme: solarizedDarkTheme,
  },
  {
    id: 'warm-dark',
    name: 'Warm Dark',
    theme: warmDarkTheme,
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    theme: highContrastTheme,
  },
  {
    id: 'hacker',
    name: 'Hacker',
    theme: hackerTheme,
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
