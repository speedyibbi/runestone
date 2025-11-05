import type { Manifest, ManifestEntry } from '@/services/notebook'
import NotebookService from '@/services/notebook'

/**
 * Options for adding a new entry to the manifest
 */
export interface AddEntryOptions {
  type: 'note' | 'image'
  title: string
  data: ArrayBuffer | Uint8Array
}

/**
 * Options for updating an existing entry
 */
export interface UpdateEntryOptions {
  uuid: string
  title?: string
  data?: ArrayBuffer | Uint8Array
}

/**
 * ManifestManager provides high-level operations for managing manifest entries
 * Handles automatic timestamp updates, version bumping, and hash verification
 */
export default class ManifestManager {
  private manifest: Manifest

  /**
   * Create a new ManifestManager instance from an existing manifest
   */
  constructor(manifest: Manifest) {
    this.manifest = { ...manifest }
  }

  /**
   * Get the current manifest (immutable copy)
   */
  getManifest(): Manifest {
    return JSON.parse(JSON.stringify(this.manifest)) as Manifest
  }

  /**
   * Get all entries
   */
  getEntries(): ManifestEntry[] {
    return [...this.manifest.entries]
  }

  /**
   * Find an entry by UUID
   */
  findEntry(uuid: string): ManifestEntry | undefined {
    return this.manifest.entries.find((entry) => entry.uuid === uuid)
  }

  /**
   * Check if an entry exists
   */
  hasEntry(uuid: string): boolean {
    return this.findEntry(uuid) !== undefined
  }

  /**
   * Find entries by type
   */
  findEntriesByType(type: 'note' | 'image'): ManifestEntry[] {
    return this.manifest.entries.filter((entry) => entry.type === type)
  }

  /**
   * Find entries by title (case-insensitive partial match)
   */
  findEntriesByTitle(query: string): ManifestEntry[] {
    return this.manifest.entries.filter((entry) =>
      entry.title.toLowerCase().includes(query.toLowerCase()),
    )
  }

  /**
   * Add a new entry to the manifest
   * Automatically generates UUID and computes hash and size
   */
  async addEntry(options: AddEntryOptions): Promise<ManifestEntry> {
    // Generate UUID
    const uuid = crypto.randomUUID()

    // Ensure UUID is unique (extremely unlikely collision, but safety check)
    if (this.hasEntry(uuid)) {
      throw new Error(`Generated UUID ${uuid} already exists, please try again`)
    }

    // Compute hash from data
    const hash = await NotebookService.computeHash(options.data)

    // Compute size from data
    const size = options.data.byteLength

    const now = new Date().toISOString()

    const entry: ManifestEntry = {
      uuid,
      type: options.type,
      title: options.title,
      version: 1,
      last_modified: now,
      hash,
      size,
    }

    this.manifest.entries.push(entry)
    this.updateMetadata()

    return { ...entry }
  }

  /**
   * Update an existing entry
   * Automatically increments version, updates timestamp, and computes hash/size if data is provided
   */
  async updateEntry(options: UpdateEntryOptions): Promise<ManifestEntry> {
    const entryIndex = this.manifest.entries.findIndex(
      (e) => e.uuid === options.uuid,
    )

    if (entryIndex === -1) {
      throw new Error(`Entry with UUID ${options.uuid} not found`)
    }

    const existingEntry = this.manifest.entries[entryIndex]
    
    // Compute hash and size if data is provided
    let hash = existingEntry.hash
    let size = existingEntry.size
    
    if (options.data) {
      hash = await NotebookService.computeHash(options.data)
      size = options.data.byteLength
    }

    const now = new Date().toISOString()

    const updatedEntry: ManifestEntry = {
      ...existingEntry,
      title: options.title ?? existingEntry.title,
      version: existingEntry.version + 1,
      last_modified: now,
      hash,
      size,
    }

    this.manifest.entries[entryIndex] = updatedEntry
    this.updateMetadata()

    return { ...updatedEntry }
  }

  /**
   * Remove an entry from the manifest
   */
  removeEntry(uuid: string): boolean {
    const initialLength = this.manifest.entries.length
    this.manifest.entries = this.manifest.entries.filter(
      (entry) => entry.uuid !== uuid,
    )

    if (this.manifest.entries.length < initialLength) {
      this.updateMetadata()
      return true
    }

    return false
  }

  /**
   * Verify the hash of an entry's data
   */
  async verifyHash(uuid: string, data: ArrayBuffer | Uint8Array): Promise<boolean> {
    const entry = this.findEntry(uuid)

    if (!entry) {
      throw new Error(`Entry with UUID ${uuid} not found`)
    }

    const computedHash = await NotebookService.computeHash(data)
    return computedHash === entry.hash
  }

  /**
   * Verify all entry hashes (batch operation)
   * Returns a map of UUID -> boolean indicating if hash is valid
   * Note: This requires the actual blob data to be provided
   */
  async verifyAllHashes(
    dataProvider: (uuid: string) => Promise<ArrayBuffer | Uint8Array>,
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}

    for (const entry of this.manifest.entries) {
      try {
        const data = await dataProvider(entry.uuid)
        results[entry.uuid] = await this.verifyHash(entry.uuid, data)
      } catch {
        results[entry.uuid] = false
      }
    }

    return results
  }

  /**
   * Get entry statistics
   */
  getStats(): {
    totalEntries: number
    notes: number
    images: number
    totalSize: number
    lastUpdated: string
  } {
    const notes = this.findEntriesByType('note').length
    const images = this.findEntriesByType('image').length
    const totalSize = this.manifest.entries.reduce(
      (sum, entry) => sum + entry.size,
      0,
    )

    return {
      totalEntries: this.manifest.entries.length,
      notes,
      images,
      totalSize,
      lastUpdated: this.manifest.last_updated,
    }
  }

  /**
   * Get entries sorted by last modified (most recent first)
   */
  getEntriesSortedByModified(ascending = false): ManifestEntry[] {
    const entries = [...this.manifest.entries]
    entries.sort((a, b) => {
      const dateA = new Date(a.last_modified).getTime()
      const dateB = new Date(b.last_modified).getTime()
      return ascending ? dateA - dateB : dateB - dateA
    })
    return entries
  }

  /**
   * Get entries sorted by title (alphabetical)
   */
  getEntriesSortedByTitle(ascending = true): ManifestEntry[] {
    const entries = [...this.manifest.entries]
    entries.sort((a, b) => {
      const comparison = a.title.localeCompare(b.title)
      return ascending ? comparison : -comparison
    })
    return entries
  }

  /**
   * Update manifest metadata (last_updated timestamp)
   * Called automatically when entries are modified
   */
  private updateMetadata(): void {
    this.manifest.last_updated = new Date().toISOString()
  }

  /**
   * Bulk add entries
   */
  async addEntries(entries: Array<AddEntryOptions>): Promise<ManifestEntry[]> {
    const results: ManifestEntry[] = []

    for (const entryOptions of entries) {
      const entry = await this.addEntry(entryOptions)
      results.push(entry)
    }

    return results
  }

  /**
   * Bulk remove entries
   */
  removeEntries(uuids: string[]): number {
    let removedCount = 0

    for (const uuid of uuids) {
      if (this.removeEntry(uuid)) {
        removedCount++
      }
    }

    return removedCount
  }

  /**
   * Replace all entries (useful for syncing)
   */
  replaceEntries(entries: ManifestEntry[]): void {
    this.manifest.entries = entries.map((entry) => ({ ...entry }))
    this.updateMetadata()
  }

  /**
   * Merge another manifest's entries into this one
   * Uses Last-Write-Wins (LWW) strategy for conflicts
   */
  mergeEntries(otherEntries: ManifestEntry[]): {
    added: number
    updated: number
    skipped: number
  } {
    let added = 0
    let updated = 0
    let skipped = 0

    for (const otherEntry of otherEntries) {
      const existingEntry = this.findEntry(otherEntry.uuid)

      if (!existingEntry) {
        // New entry - add it
        this.manifest.entries.push({ ...otherEntry })
        added++
      } else {
        // Conflict - use Last-Write-Wins
        const existingTime = new Date(existingEntry.last_modified).getTime()
        const otherTime = new Date(otherEntry.last_modified).getTime()

        if (otherTime > existingTime) {
          // Remote is newer - replace local
          const index = this.manifest.entries.findIndex(
            (e) => e.uuid === otherEntry.uuid,
          )
          this.manifest.entries[index] = { ...otherEntry }
          updated++
        } else {
          // Local is newer or equal - keep local
          skipped++
        }
      }
    }

    if (added > 0 || updated > 0) {
      this.updateMetadata()
    }

    return { added, updated, skipped }
  }
}
