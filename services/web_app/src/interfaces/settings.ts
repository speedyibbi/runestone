/**
 * Sync settings
 */
export interface SyncSettings {
  autoSync: boolean
  syncInterval: number // milliseconds
}

/**
 * Settings structure (decrypted form of settings.json.enc)
 */
export interface Settings {
  version: number
  last_updated: string // ISO 8601 timestamp
  sync: SyncSettings
}
