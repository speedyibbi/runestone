import type {
  Settings,
  SyncSettings,
  ThemeSettings,
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
    settings.theme = this.validateThemeSettings(settings.theme)

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
    updated.theme = this.validateThemeSettings(updated.theme)

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

  /**
   * Validate and sanitize theme settings
   */
  private static validateThemeSettings(theme: Partial<ThemeSettings>): ThemeSettings {
    // Default theme values
    const defaults: ThemeSettings = {
      accent: this.DEFAULT_SETTINGS.theme.accent,
      foreground: this.DEFAULT_SETTINGS.theme.foreground,
      background: this.DEFAULT_SETTINGS.theme.background,
      selection: this.DEFAULT_SETTINGS.theme.selection,
      selectionFocused: this.DEFAULT_SETTINGS.theme.selectionFocused,
      muted: this.DEFAULT_SETTINGS.theme.muted,
      error: this.DEFAULT_SETTINGS.theme.error,
      success: this.DEFAULT_SETTINGS.theme.success,
      warning: this.DEFAULT_SETTINGS.theme.warning,
      info: this.DEFAULT_SETTINGS.theme.info,
      scale: this.DEFAULT_SETTINGS.theme.scale,
    }

    // Validate hex color format (6 or 8 digits)
    const isValidHexColor = (color: string): boolean => {
      return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(color)
    }

    // Validate and sanitize colors
    const accent = theme.accent && isValidHexColor(theme.accent) ? theme.accent : defaults.accent
    const foreground = theme.foreground && isValidHexColor(theme.foreground) ? theme.foreground : defaults.foreground
    const background = theme.background && isValidHexColor(theme.background) ? theme.background : defaults.background
    const selection = theme.selection && isValidHexColor(theme.selection) ? theme.selection : defaults.selection
    const selectionFocused = theme.selectionFocused && isValidHexColor(theme.selectionFocused) ? theme.selectionFocused : defaults.selectionFocused
    const muted = theme.muted && isValidHexColor(theme.muted) ? theme.muted : defaults.muted
    const error = theme.error && isValidHexColor(theme.error) ? theme.error : defaults.error
    const success = theme.success && isValidHexColor(theme.success) ? theme.success : defaults.success
    const warning = theme.warning && isValidHexColor(theme.warning) ? theme.warning : defaults.warning
    const info = theme.info && isValidHexColor(theme.info) ? theme.info : defaults.info

    // Validate and clamp font size (0.01 to 0.1)
    const scale = typeof theme.scale === 'number' && !isNaN(theme.scale)
      ? Math.max(0.01, Math.min(0.1, theme.scale))
      : defaults.scale

    return {
      accent,
      foreground,
      background,
      selection,
      selectionFocused,
      muted,
      error,
      success,
      warning,
      info,
      scale,
    }
  }
}
