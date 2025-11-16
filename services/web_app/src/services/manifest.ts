import { toArrayBuffer } from '@/utils/helpers'

/**
 * Manifest entry for a blob
 */
export interface ManifestEntry {
  uuid: string
  type: 'note' | 'image'
  title: string
  version: number
  last_updated: string // ISO 8601 timestamp
  hash: string // sha256-<hash>
  size: number // bytes
}

/**
 * Manifest structure (decrypted form)
 */
export interface Manifest {
  manifest_version: number
  last_updated: string // ISO 8601 timestamp
  notebook_id: string
  notebook_title: string
  entries: ManifestEntry[]
}

/**
 * ManifestService handles manifest data operations
 * Pure data manipulation without I/O
 */
export default class ManifestService {
  private static readonly MANIFEST_VERSION = __APP_CONFIG__.notebook.manifest.version

  /**
   * Compute SHA-256 hash of data
   */
  private static async computeHash(data: ArrayBuffer | Uint8Array): Promise<string> {
    const dataBuffer = toArrayBuffer(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return `sha256-${hashHex}`
  }

  /**
   * Create a new empty manifest
   */
  static create(notebookTitle: string): Manifest {
    return {
      manifest_version: this.MANIFEST_VERSION,
      last_updated: new Date().toISOString(),
      notebook_id: crypto.randomUUID(),
      notebook_title: notebookTitle,
      entries: [],
    }
  }

  /**
   * Update manifest's notebook_title
   */
  static updateNotebookTitle(manifest: Manifest, notebookTitle: string): Manifest {
    return {
      ...manifest,
      notebook_title: notebookTitle,
      last_updated: new Date().toISOString(),
    }
  }

  /**
   * Update manifest's last_updated timestamp
   */
  static touch(manifest: Manifest): Manifest {
    return {
      ...manifest,
      last_updated: new Date().toISOString(),
    }
  }

  /**
   * Check if an entry exists
   */
  static hasEntry(manifest: Manifest, uuid: string): boolean {
    return this.findEntry(manifest, uuid) !== undefined
  }

  /**
   * Find an entry by UUID
   */
  static findEntry(manifest: Manifest, uuid: string): ManifestEntry | undefined {
    return manifest.entries.find((entry) => entry.uuid === uuid)
  }

  /**
   * Add a new entry to the manifest
   */
  static addEntry(
    manifest: Manifest,
    entry: Omit<ManifestEntry, 'uuid' | 'version' | 'last_updated'>,
  ): { manifest: Manifest; entry: ManifestEntry } {
    const uuid = crypto.randomUUID()
    const now = new Date().toISOString()

    const newEntry: ManifestEntry = {
      uuid,
      version: 1,
      last_updated: now,
      ...entry,
    }

    const newManifest: Manifest = {
      ...manifest,
      last_updated: now,
      entries: [...manifest.entries, newEntry],
    }

    return { manifest: newManifest, entry: newEntry }
  }

  /**
   * Update an existing entry
   */
  static updateEntry(
    manifest: Manifest,
    uuid: string,
    data: Omit<ManifestEntry, 'uuid' | 'version' | 'last_updated'>,
  ): Manifest {
    const entryIndex = manifest.entries.findIndex((e) => e.uuid === uuid)

    if (entryIndex === -1) {
      throw new Error(`Entry with UUID ${uuid} not found`)
    }

    const existingEntry = manifest.entries[entryIndex]
    const now = new Date().toISOString()

    const updatedEntry: ManifestEntry = {
      ...existingEntry,
      ...data,
      version: existingEntry.version + 1,
      last_updated: now,
    }

    const newEntries = [...manifest.entries]
    newEntries[entryIndex] = updatedEntry

    return {
      ...manifest,
      last_updated: now,
      entries: newEntries,
    }
  }

  /**
   * Remove an entry from the manifest
   */
  static removeEntry(manifest: Manifest, uuid: string): Manifest {
    const newEntries = manifest.entries.filter((entry) => entry.uuid !== uuid)

    if (newEntries.length === manifest.entries.length) {
      return manifest
    }

    return {
      ...manifest,
      last_updated: new Date().toISOString(),
      entries: newEntries,
    }
  }

  /**
   * Merge two manifests using Last-Write-Wins strategy
   */
  static merge(
    local: Manifest,
    remote: Manifest,
  ): {
    manifest: Manifest
    conflicts: number
  } {
    const localEntries = new Map<string, ManifestEntry>()
    for (const entry of local.entries) {
      localEntries.set(entry.uuid, entry)
    }

    const mergedEntries: ManifestEntry[] = []
    const processedUuids = new Set<string>()
    let conflicts = 0

    // Process all remote entries
    for (const remoteEntry of remote.entries) {
      const localEntry = localEntries.get(remoteEntry.uuid)

      if (!localEntry) {
        // Entry only exists remotely - add it
        mergedEntries.push(remoteEntry)
      } else {
        // Entry exists in both - use Last-Write-Wins
        const localTime = new Date(localEntry.last_updated).getTime()
        const remoteTime = new Date(remoteEntry.last_updated).getTime()

        if (remoteTime > localTime) {
          // Remote is newer
          mergedEntries.push(remoteEntry)
          if (remoteEntry.hash !== localEntry.hash) {
            conflicts++
          }
        } else if (localTime > remoteTime) {
          // Local is newer
          mergedEntries.push(localEntry)
          if (remoteEntry.hash !== localEntry.hash) {
            conflicts++
          }
        } else {
          // Same timestamp - prefer remote (arbitrary choice for consistency)
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

    // Determine which manifest has the later timestamp
    const localTime = new Date(local.last_updated).getTime()
    const remoteTime = new Date(remote.last_updated).getTime()
    const lastUpdated = remoteTime > localTime ? remote.last_updated : local.last_updated

    const mergedManifest: Manifest = {
      manifest_version: Math.max(local.manifest_version, remote.manifest_version),
      last_updated: lastUpdated,
      notebook_id: local.notebook_id,
      notebook_title: local.notebook_title,
      entries: mergedEntries,
    }

    return {
      manifest: mergedManifest,
      conflicts,
    }
  }

  /**
   * Verify the hash of an entry's data
   */
  static async verifyHash(entry: ManifestEntry, data: ArrayBuffer | Uint8Array): Promise<boolean> {
    const computedHash = await this.computeHash(data)
    return computedHash === entry.hash
  }
}
