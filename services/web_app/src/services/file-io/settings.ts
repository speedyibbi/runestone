import type {
  Settings,
  SyncSettings,
} from '@/interfaces/settings'

/**
 * SettingsService handles settings data operations
 * Pure data manipulation without I/O
 */
export default class SettingsService {
  private static readonly SETTINGS_VERSION = __APP_CONFIG__.root.settings.version
  private static readonly DEFAULT_SETTINGS = __APP_CONFIG__.root.settings.default

  /**
   * Create a new settings object with default values
   */
  static create(): Settings {
    return {
      version: this.SETTINGS_VERSION,
      last_updated: new Date().toISOString(),
      ...this.DEFAULT_SETTINGS,
    }
  }

  /**
   * Update settings' last_updated timestamp
   */
  static touch(settings: Settings): Settings {
    return {
      ...settings,
      last_updated: new Date().toISOString(),
    }
  }

  /**
   * Serialize Settings to plain object (for JSON)
   */
  static serialize(settings: Settings): any {
    return {
      ...settings,
      version: settings.version,
      last_updated: settings.last_updated,
    }
  }

  /**
   * Deserialize Settings from plain object
   */
  static deserialize(obj: any): Settings {
    // Merge with defaults to handle missing fields or version migrations
    const settings: Settings = {
      ...(obj ?? this.DEFAULT_SETTINGS),
      version: obj.version ?? this.SETTINGS_VERSION,
      last_updated: obj.last_updated ?? new Date().toISOString(),
    }

    // Validate and sanitize values
    settings.sync = this.validateSyncSettings(settings.sync)

    return settings
  }

  /**
   * Update settings with partial updates
   */
  static update(settings: Settings, updates: Partial<Settings>): Settings {
    const updated: Settings = {
      ...settings,
      ...updates,
      last_updated: new Date().toISOString(),
    }

    // Validate updated settings
    updated.sync = this.validateSyncSettings(updated.sync)

    return updated
  }

  /**
   * Merge two settings using Last-Write-Wins strategy
   */
  static merge(local: Settings, remote: Settings): Settings {
    const localTime = new Date(local.last_updated).getTime()
    const remoteTime = new Date(remote.last_updated).getTime()

    // Use the newer settings as base
    const base = remoteTime > localTime ? remote : local

    return {
      ...base,
      version: Math.max(local.version, remote.version),
      last_updated: base.last_updated,
    }
  }

  /**
   * Validate and sanitize sync settings
   */
  private static validateSyncSettings(sync: Partial<SyncSettings>): SyncSettings {
    return {
      autoSync: sync.autoSync ?? this.DEFAULT_SETTINGS.sync.autoSync,
      syncInterval: Math.max(1000, Math.min(3600000, sync.syncInterval ?? this.DEFAULT_SETTINGS.sync.syncInterval)), // milliseconds (1 second to 1 hour)
    }
  }
}
