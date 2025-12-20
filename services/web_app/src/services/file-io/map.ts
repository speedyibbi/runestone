import type { MapEntry, Map } from '@/interfaces/map'

/**
 * MapService handles map data operations
 * Pure data manipulation without I/O
 */
export default class MapService {
  private static readonly MAP_VERSION = __APP_CONFIG__.root.map.version

  /**
   * Create a new empty map
   */
  static create(): Map {
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
   * Check if an entry exists
   */
  static hasEntry(map: Map, uuid: string): boolean {
    return this.findEntry(map, uuid) !== undefined
  }

  /**
   * Find an entry by UUID
   */
  static findEntry(map: Map, uuid: string): MapEntry | undefined {
    return map.entries.find((entry) => entry.uuid === uuid)
  }

  /**
   * Add a new notebook entry to the map
   */
  static addEntry(map: Map, entry: MapEntry): { map: Map; entry: MapEntry } {
    const newMap: Map = {
      ...map,
      last_updated: new Date().toISOString(),
      entries: [...map.entries, entry],
    }

    return { map: newMap, entry }
  }

  /**
   * Update an existing entry's title
   */
  static updateEntry(map: Map, uuid: string, data: Omit<MapEntry, 'uuid'>): Map {
    const entryIndex = map.entries.findIndex((e) => e.uuid === uuid)

    if (entryIndex === -1) {
      throw new Error(`Entry with UUID ${uuid} not found`)
    }

    const updatedEntry: MapEntry = {
      uuid,
      ...data,
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
  static merge(
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
}
