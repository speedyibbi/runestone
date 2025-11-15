import OPFSService from '@/services/opfs'

/**
 * CacheService manages local OPFS cache for notebook data
 * Stores root-level files (meta.json, map.json.enc) and notebook-level files
 * OPFS structure:
 *   meta.json           # Root meta (unencrypted)
 *   map.json.enc        # Encrypted map
 *   <notebookId>/
 *     meta.json         # Notebook meta
 *     manifest.json.enc
 *     blobs/<uuid>.enc
 */
export default class CacheService {
  /**
   * Get the path for root meta.json
   */
  private static getRootMetaPath(): string[] {
    return ['meta.json']
  }

  /**
   * Get the path for map.json.enc
   */
  private static getMapPath(): string[] {
    return ['map.json.enc']
  }

  /**
   * Get the path for notebook meta.json
   */
  private static getNotebookMetaPath(notebookId: string): string[] {
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
   * Save root meta.json to cache (unencrypted)
   */
  static async saveRootMeta(meta: any): Promise<void> {
    const path = this.getRootMetaPath()
    const metaText = JSON.stringify(meta, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.writeFile(path, metaBytes)
  }

  /**
   * Get root meta.json from cache (unencrypted)
   */
  static async getRootMeta(): Promise<any | null> {
    const path = this.getRootMetaPath()
    const data = await OPFSService.readFile(path)
    if (!data) {
      return null
    }
    const metaText = new TextDecoder().decode(data)
    return JSON.parse(metaText)
  }

  /**
   * Check if root meta.json exists in cache
   */
  static async hasRootMeta(): Promise<boolean> {
    const path = this.getRootMetaPath()
    return await OPFSService.fileExists(path)
  }

  /**
   * Delete root meta.json from cache
   */
  static async deleteRootMeta(): Promise<boolean> {
    const path = this.getRootMetaPath()
    return await OPFSService.deleteFile(path)
  }

  /**
   * Save encrypted map.json.enc to cache
   */
  static async saveMap(encryptedMap: ArrayBuffer | Uint8Array): Promise<void> {
    const path = this.getMapPath()
    await OPFSService.writeFile(path, encryptedMap)
  }

  /**
   * Get encrypted map.json.enc from cache
   */
  static async getMap(): Promise<ArrayBuffer | null> {
    const path = this.getMapPath()
    return await OPFSService.readFile(path)
  }

  /**
   * Check if map.json.enc exists in cache
   */
  static async hasMap(): Promise<boolean> {
    const path = this.getMapPath()
    return await OPFSService.fileExists(path)
  }

  /**
   * Delete map.json.enc from cache
   */
  static async deleteMap(): Promise<boolean> {
    const path = this.getMapPath()
    return await OPFSService.deleteFile(path)
  }

  /**
   * Save notebook meta.json to cache (unencrypted)
   */
  static async saveNotebookMeta(notebookId: string, meta: any): Promise<void> {
    const path = this.getNotebookMetaPath(notebookId)
    const metaText = JSON.stringify(meta, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.writeFile(path, metaBytes)
  }

  /**
   * Get notebook meta.json from cache (unencrypted)
   */
  static async getNotebookMeta(notebookId: string): Promise<any | null> {
    const path = this.getNotebookMetaPath(notebookId)
    const data = await OPFSService.readFile(path)
    if (!data) {
      return null
    }
    const metaText = new TextDecoder().decode(data)
    return JSON.parse(metaText)
  }

  /**
   * Check if notebook meta.json exists in cache
   */
  static async hasNotebookMeta(notebookId: string): Promise<boolean> {
    const path = this.getNotebookMetaPath(notebookId)
    return await OPFSService.fileExists(path)
  }

  /**
   * Delete notebook meta.json from cache
   */
  static async deleteNotebookMeta(notebookId: string): Promise<boolean> {
    const path = this.getNotebookMetaPath(notebookId)
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
    return entries.filter((name) => name.endsWith('.enc')).map((name) => name.slice(0, -4))
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
    const metaPath = this.getNotebookMetaPath(notebookId)
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
  static async cleanupOrphanedBlobs(notebookId: string, validUuids: string[]): Promise<number> {
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
   * Get overall cache statistics including root and all notebooks
   */
  static async getGlobalCacheStats(): Promise<{
    rootMetaSize: number
    mapSize: number
    notebooksCount: number
    totalSize: number
  }> {
    // Get root meta size
    const rootMetaPath = this.getRootMetaPath()
    const rootMetaSize = (await OPFSService.getFileSize(rootMetaPath)) ?? 0

    // Get map size
    const mapPath = this.getMapPath()
    const mapSize = (await OPFSService.getFileSize(mapPath)) ?? 0

    // Count notebooks
    const notebooks = await this.listNotebooks()
    const notebooksCount = notebooks.length

    // Calculate total size (root files + all notebook stats)
    let notebooksTotalSize = 0
    for (const notebookId of notebooks) {
      const stats = await this.getNotebookStats(notebookId)
      notebooksTotalSize += stats.totalSize
    }

    return {
      rootMetaSize,
      mapSize,
      notebooksCount,
      totalSize: rootMetaSize + mapSize + notebooksTotalSize,
    }
  }

  /**
   * Clear entire cache (root files and all notebooks)
   * WARNING: This will delete all cached data
   */
  static async clearAllCache(): Promise<void> {
    // Delete root files
    await this.deleteRootMeta()
    await this.deleteMap()

    // Delete all notebooks
    const notebooks = await this.listNotebooks()
    for (const notebookId of notebooks) {
      await this.clearNotebook(notebookId)
    }
  }
}
