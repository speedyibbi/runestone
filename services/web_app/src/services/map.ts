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
   */
  static mergeMaps(
    local: Map,
    remote: Map,
  ): {
    map: Map
    conflicts: number
  } {
    const localEntries = new Map<string, MapEntry>()
    for (const entry of local.entries) {
      localEntries.set(entry.uuid, entry)
    }

    const mergedEntries: MapEntry[] = []
    const processedUuids = new Set<string>()
    let conflicts = 0

    // Process all remote entries
    for (const remoteEntry of remote.entries) {
      const localEntry = localEntries.get(remoteEntry.uuid)

      if (!localEntry) {
        // Entry only exists remotely - add it
        mergedEntries.push(remoteEntry)
      } else {
        // Entry exists in both - check if titles differ
        if (localEntry.title !== remoteEntry.title) {
          conflicts++
          // Use remote title (LWW - prefer remote for consistency)
          mergedEntries.push(remoteEntry)
        } else {
          // Same title, no conflict
          mergedEntries.push(remoteEntry)
        }
      }

      processedUuids.add(remoteEntry.uuid)
    }

    // Process local entries that don't exist remotely
    for (const localEntry of local.entries) {
      if (!processedUuids.has(localEntry.uuid)) {
        mergedEntries.push(localEntry)
      }
    }

    // Determine which map has the later timestamp
    const localTime = new Date(local.last_updated).getTime()
    const remoteTime = new Date(remote.last_updated).getTime()
    const lastUpdated = remoteTime > localTime ? remote.last_updated : local.last_updated

    const mergedMap: Map = {
      version: Math.max(local.version, remote.version),
      last_updated: lastUpdated,
      entries: mergedEntries,
    }

    return {
      map: mergedMap,
      conflicts,
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
