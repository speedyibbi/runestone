/**
 * Map entry for a notebook
 */
export interface MapEntry {
  uuid: string
  title: string
}

/**
 * Map structure (decrypted form)
 * Lists all notebooks for a user
 */
export interface Map {
  version: number
  last_updated: string // ISO 8601 timestamp
  entries: MapEntry[]
}

/**
 * MapService handles map data operations
 * The map is the root-level index of all notebooks
 * Pure data manipulation without I/O
 */
export default class MapService {
  private static readonly MAP_VERSION = 1

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
   * Find a notebook entry by UUID
   */
  static findNotebook(map: Map, uuid: string): MapEntry | undefined {
    return map.entries.find((entry) => entry.uuid === uuid)
  }

  /**
   * Check if a notebook exists in the map
   */
  static hasNotebook(map: Map, uuid: string): boolean {
    return this.findNotebook(map, uuid) !== undefined
  }

  /**
   * Add a new notebook to the map
   */
  static addNotebook(map: Map, uuid: string, title: string): Map {
    // Check if notebook already exists
    if (this.hasNotebook(map, uuid)) {
      throw new Error(`Notebook with UUID ${uuid} already exists in map`)
    }

    const now = new Date().toISOString()

    const newEntry: MapEntry = {
      uuid,
      title,
    }

    return {
      ...map,
      last_updated: now,
      entries: [...map.entries, newEntry],
    }
  }

  /**
   * Remove a notebook from the map
   */
  static removeNotebook(map: Map, uuid: string): Map {
    const newEntries = map.entries.filter((entry) => entry.uuid !== uuid)

    if (newEntries.length === map.entries.length) {
      // Notebook not found, return unchanged
      return map
    }

    return {
      ...map,
      last_updated: new Date().toISOString(),
      entries: newEntries,
    }
  }

  /**
   * Update a notebook's title in the map
   */
  static updateNotebookTitle(map: Map, uuid: string, newTitle: string): Map {
    const entryIndex = map.entries.findIndex((entry) => entry.uuid === uuid)

    if (entryIndex === -1) {
      throw new Error(`Notebook with UUID ${uuid} not found in map`)
    }

    const newEntries = [...map.entries]
    newEntries[entryIndex] = {
      ...newEntries[entryIndex],
      title: newTitle,
    }

    return {
      ...map,
      last_updated: new Date().toISOString(),
      entries: newEntries,
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
        // Entry exists in both - check if titles match
        if (remoteEntry.title !== localEntry.title) {
          conflicts++
        }
        mergedEntries.push(remoteEntry)
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
}
