/**
 * Map entry for a notebook
 */
export interface MapEntry {
  uuid: string
  title: string
}

/**
 * Map structure (decrypted form of map.json.enc)
 */
export interface Map {
  version: number
  last_updated: string // ISO 8601 timestamp
  entries: MapEntry[]
}

/**
 * MapService handles map data operations
 * Pure data manipulation without I/O
 */
export default class MapService {
  private static readonly MAP_VERSION = __APP_CONFIG__.root.map.version

  /**
   * Create a new empty map
   */
  static createMap(): Map {
    return {
      version: this.MAP_VERSION,
      last_updated: new Date().toISOString(),
      entries: [],
    }
  }

  /**
   * Update map's last_updated timestamp
   */
  static touch(map: Map): Map {
    return {
      ...map,
      last_updated: new Date().toISOString(),
    }
  }

  /**
   * Find an entry by UUID
   */
  static findEntry(map: Map, uuid: string): MapEntry | undefined {
    return map.entries.find((entry) => entry.uuid === uuid)
  }

  /**
   * Check if an entry exists
   */
  static hasEntry(map: Map, uuid: string): boolean {
    return this.findEntry(map, uuid) !== undefined
  }

  /**
   * Find an entry by title
   */
  static findEntryByTitle(map: Map, title: string): MapEntry | undefined {
    return map.entries.find((entry) => entry.title === title)
  }

  /**
   * Add a new notebook entry to the map
   */
  static addEntry(
    map: Map,
    entry: Omit<MapEntry, 'uuid'>,
  ): { map: Map; entry: MapEntry } {
    const uuid = crypto.randomUUID()
    const now = new Date().toISOString()

    const newEntry: MapEntry = {
      uuid,
      ...entry,
    }

    const newMap: Map = {
      ...map,
      last_updated: now,
      entries: [...map.entries, newEntry],
    }

    return { map: newMap, entry: newEntry }
  }

  /**
   * Update an existing entry's title
   */
  static updateEntry(map: Map, uuid: string, title: string): Map {
    const entryIndex = map.entries.findIndex((e) => e.uuid === uuid)

    if (entryIndex === -1) {
      throw new Error(`Entry with UUID ${uuid} not found`)
    }

    const updatedEntry: MapEntry = {
      uuid,
      title,
    }

    const newEntries = [...map.entries]
    newEntries[entryIndex] = updatedEntry

    return {
      ...map,
      last_updated: new Date().toISOString(),
      entries: newEntries,
    }
  }

  /**
   * Remove an entry from the map
   */
  static removeEntry(map: Map, uuid: string): Map {
    const newEntries = map.entries.filter((entry) => entry.uuid !== uuid)

    if (newEntries.length === map.entries.length) {
      return map
    }

    return {
      ...map,
      last_updated: new Date().toISOString(),
      entries: newEntries,
    }
  }

  /**
   * Merge two maps using Last-Write-Wins strategy
   * Uses overall map timestamp to determine which version is newer
   * Note: Manifest is the source of truth for titles - map is just a cached listing
   */
  static mergeMaps(
    local: Map,
    remote: Map,
  ): {
    map: Map
    conflicts: number
  } {
    // Determine which map is newer based on timestamp
    const localTime = new Date(local.last_updated).getTime()
    const remoteTime = new Date(remote.last_updated).getTime()

    // If remote is newer, use it as the base
    if (remoteTime > localTime) {
      // Remote wins - use remote as base and add any local-only entries
      const remoteUuids = new Set(remote.entries.map((e) => e.uuid))
      const localOnlyEntries = local.entries.filter((e) => !remoteUuids.has(e.uuid))

      return {
        map: {
          version: Math.max(local.version, remote.version),
          last_updated: remote.last_updated,
          entries: [...remote.entries, ...localOnlyEntries],
        },
        conflicts: 0,
      }
    }

    // If local is newer or equal, use it as the base
    if (localTime >= remoteTime) {
      // Local wins - use local as base and add any remote-only entries
      const localUuids = new Set(local.entries.map((e) => e.uuid))
      const remoteOnlyEntries = remote.entries.filter((e) => !localUuids.has(e.uuid))

      return {
        map: {
          version: Math.max(local.version, remote.version),
          last_updated: local.last_updated,
          entries: [...local.entries, ...remoteOnlyEntries],
        },
        conflicts: 0,
      }
    }

    // Fallback (should never reach here due to >= check above)
    return {
      map: local,
      conflicts: 0,
    }
  }

  /**
   * Get entries sorted by title
   */
  static getSortedByTitle(map: Map, ascending = true): MapEntry[] {
    const entries = [...map.entries]
    entries.sort((a, b) => {
      const comparison = a.title.localeCompare(b.title)
      return ascending ? comparison : -comparison
    })
    return entries
  }

  /**
   * Get map statistics
   */
  static getStats(map: Map): {
    totalNotebooks: number
  } {
    return {
      totalNotebooks: map.entries.length,
    }
  }

  /**
   * Validate map structure
   */
  static validate(map: Map): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!map.version || typeof map.version !== 'number') {
      errors.push('Invalid or missing version')
    }

    if (!map.last_updated || typeof map.last_updated !== 'string') {
      errors.push('Invalid or missing last_updated')
    }

    if (!Array.isArray(map.entries)) {
      errors.push('Invalid or missing entries array')
    } else {
      // Check for duplicate UUIDs
      const uuids = new Set<string>()
      map.entries.forEach((entry, index) => {
        if (!entry.uuid || typeof entry.uuid !== 'string') {
          errors.push(`Entry at index ${index} has invalid or missing uuid`)
        } else if (uuids.has(entry.uuid)) {
          errors.push(`Duplicate UUID found: ${entry.uuid}`)
        } else {
          uuids.add(entry.uuid)
        }

        if (!entry.title || typeof entry.title !== 'string') {
          errors.push(`Entry at index ${index} has invalid or missing title`)
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
