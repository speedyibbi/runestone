import OPFSService from '@/services/opfs'

/**
 * CacheService manages local OPFS cache for notebook data
 * Stores meta.json, encrypted manifests and blobs locally for offline access
 */
export default class CacheService {
  /**
   * Get the path for meta.json
   */
  private static getMetaPath(notebookId: string): string[] {
    return [notebookId, 'meta.json']
  }

  /**
   * Get the path for a notebook manifest
   */
  private static getManifestPath(notebookId: string): string[] {
    return [notebookId, 'manifest.json.enc']
  }

  /**
   * Get the path for a blob
   */
  private static getBlobPath(notebookId: string, uuid: string): string[] {
    return [notebookId, 'blobs', `${uuid}.enc`]
  }

  /**
   * Save meta.json to cache
   */
  static async saveMeta(notebookId: string, meta: any): Promise<void> {
    const path = this.getMetaPath(notebookId)
    const metaText = JSON.stringify(meta, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.writeFile(path, metaBytes)
  }

  /**
   * Get meta.json from cache
   */
  static async getMeta(notebookId: string): Promise<any | null> {
    const path = this.getMetaPath(notebookId)
    const data = await OPFSService.readFile(path)
    if (!data) {
      return null
    }
    const metaText = new TextDecoder().decode(data)
    return JSON.parse(metaText)
  }

  /**
   * Check if meta.json exists in cache
   */
  static async hasMeta(notebookId: string): Promise<boolean> {
    const path = this.getMetaPath(notebookId)
    return await OPFSService.fileExists(path)
  }

  /**
   * Delete meta.json from cache
   */
  static async deleteMeta(notebookId: string): Promise<boolean> {
    const path = this.getMetaPath(notebookId)
    return await OPFSService.deleteFile(path)
  }

  /**
   * Save encrypted manifest to cache
   */
  static async saveManifest(
    notebookId: string,
    encryptedManifest: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.getManifestPath(notebookId)
    await OPFSService.writeFile(path, encryptedManifest)
  }

  /**
   * Get encrypted manifest from cache
   */
  static async getManifest(notebookId: string): Promise<ArrayBuffer | null> {
    const path = this.getManifestPath(notebookId)
    return await OPFSService.readFile(path)
  }

  /**
   * Check if manifest exists in cache
   */
  static async hasManifest(notebookId: string): Promise<boolean> {
    const path = this.getManifestPath(notebookId)
    return await OPFSService.fileExists(path)
  }

  /**
   * Delete manifest from cache
   */
  static async deleteManifest(notebookId: string): Promise<boolean> {
    const path = this.getManifestPath(notebookId)
    return await OPFSService.deleteFile(path)
  }

  /**
   * Save encrypted blob to cache
   */
  static async saveBlob(
    notebookId: string,
    uuid: string,
    encryptedBlob: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.getBlobPath(notebookId, uuid)
    await OPFSService.writeFile(path, encryptedBlob)
  }

  /**
   * Get encrypted blob from cache
   */
  static async getBlob(notebookId: string, uuid: string): Promise<ArrayBuffer | null> {
    const path = this.getBlobPath(notebookId, uuid)
    return await OPFSService.readFile(path)
  }

  /**
   * Check if blob exists in cache
   */
  static async hasBlob(notebookId: string, uuid: string): Promise<boolean> {
    const path = this.getBlobPath(notebookId, uuid)
    return await OPFSService.fileExists(path)
  }

  /**
   * Delete blob from cache
   */
  static async deleteBlob(notebookId: string, uuid: string): Promise<boolean> {
    const path = this.getBlobPath(notebookId, uuid)
    return await OPFSService.deleteFile(path)
  }

  /**
   * List all cached blob UUIDs for a notebook
   */
  static async listBlobs(notebookId: string): Promise<string[]> {
    const blobsPath = [notebookId, 'blobs']
    const entries = await OPFSService.listDirectory(blobsPath)

    // Extract UUIDs from filenames (remove .enc extension)
    return entries
      .filter((name) => name.endsWith('.enc'))
      .map((name) => name.slice(0, -4))
  }

  /**
   * Get blob size in cache
   */
  static async getBlobSize(notebookId: string, uuid: string): Promise<number | null> {
    const path = this.getBlobPath(notebookId, uuid)
    return await OPFSService.getFileSize(path)
  }

  /**
   * Clear all cached data for a notebook
   */
  static async clearNotebook(notebookId: string): Promise<boolean> {
    return await OPFSService.deleteDirectory([notebookId])
  }

  /**
   * Check if notebook exists in cache
   */
  static async hasNotebook(notebookId: string): Promise<boolean> {
    return await OPFSService.directoryExists([notebookId])
  }

  /**
   * List all cached notebook IDs
   */
  static async listNotebooks(): Promise<string[]> {
    return await OPFSService.listDirectory([])
  }

  /**
   * Get cache statistics for a notebook
   */
  static async getNotebookStats(notebookId: string): Promise<{
    blobCount: number
    totalBlobSize: number
    manifestSize: number
    metaSize: number
    totalSize: number
  }> {
    const blobs = await this.listBlobs(notebookId)
    let totalBlobSize = 0

    // Calculate total blob size
    for (const uuid of blobs) {
      const size = await this.getBlobSize(notebookId, uuid)
      if (size !== null) {
        totalBlobSize += size
      }
    }

    // Get manifest size
    const manifestPath = this.getManifestPath(notebookId)
    const manifestSize = (await OPFSService.getFileSize(manifestPath)) ?? 0

    // Get meta size
    const metaPath = this.getMetaPath(notebookId)
    const metaSize = (await OPFSService.getFileSize(metaPath)) ?? 0

    return {
      blobCount: blobs.length,
      totalBlobSize,
      manifestSize,
      metaSize,
      totalSize: totalBlobSize + manifestSize + metaSize,
    }
  }

  /**
   * Delete orphaned blobs not in the provided list of valid UUIDs
   */
  static async cleanupOrphanedBlobs(
    notebookId: string,
    validUuids: string[],
  ): Promise<number> {
    const allBlobs = await this.listBlobs(notebookId)
    const validSet = new Set(validUuids)
    let deletedCount = 0

    for (const uuid of allBlobs) {
      if (!validSet.has(uuid)) {
        const deleted = await this.deleteBlob(notebookId, uuid)
        if (deleted) {
          deletedCount++
        }
      }
    }

    return deletedCount
  }

  /**
   * METADATA CACHING (localStorage with TTL)
   * For lightweight, frequently-accessed data with expiration
   */

  private static readonly NOTEBOOK_LIST_CACHE_KEY = __APP_CONFIG__.notebook.cache.key
  private static readonly CACHE_TTL_MS = __APP_CONFIG__.notebook.cache.ttl // milliseconds

  /**
   * Get cached notebook list if still valid
   */
  static getCachedNotebookList(): string[] | null {
    try {
      const cached = localStorage.getItem(this.NOTEBOOK_LIST_CACHE_KEY)
      if (!cached) return null

      const data: { notebookIds: string[]; timestamp: number } = JSON.parse(cached)
      const now = Date.now()

      // Check if cache is still valid
      if (now - data.timestamp < this.CACHE_TTL_MS) {
        return data.notebookIds
      }

      // Cache expired, remove it
      localStorage.removeItem(this.NOTEBOOK_LIST_CACHE_KEY)
      return null
    } catch (error) {
      console.error('Failed to read notebook list cache:', error)
      return null
    }
  }

  /**
   * Cache notebook list with current timestamp
   */
  static cacheNotebookList(notebookIds: string[]): void {
    try {
      const data = {
        notebookIds,
        timestamp: Date.now(),
      }
      localStorage.setItem(this.NOTEBOOK_LIST_CACHE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to cache notebook list:', error)
    }
  }

  /**
   * Clear the notebook list cache
   */
  static clearNotebookListCache(): void {
    localStorage.removeItem(this.NOTEBOOK_LIST_CACHE_KEY)
  }

  /**
   * Add a notebook ID to the cached list
   */
  static addNotebookToCache(notebookId: string): void {
    const cached = this.getCachedNotebookList()
    if (cached && !cached.includes(notebookId)) {
      cached.push(notebookId)
      this.cacheNotebookList(cached)
    }
  }
}
