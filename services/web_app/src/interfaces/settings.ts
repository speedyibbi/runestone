/**
 * Sync settings
 */
export interface SyncSettings {
  autoSync: boolean
  syncInterval: number // milliseconds
}

/**
 * Theme settings
 */
export interface ThemeSettings {
  // Primary Colors
  accent: string
  foreground: string
  background: string
  selection: string
  selectionFocused: string
  muted: string

  // Semantic Colors
  error: string
  success: string
  warning: string
  info: string

  // Scale (multiplier for calc(100vmin * scale))
  scale: number
}

/**
 * Settings structure (decrypted form of settings.json.enc)
 */
export interface Settings {
  version: number
  last_updated: string // ISO 8601 timestamp
  sync: SyncSettings
  theme: ThemeSettings
}
