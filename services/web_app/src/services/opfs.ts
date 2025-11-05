/**
 * OPFSService provides local storage for encrypted notebook data using Origin Private File System
 * All data stored is encrypted
 * Decrypted data never touches persistent storage
 */
export default class OPFSService {
  private static rootHandle: FileSystemDirectoryHandle | null = null
  private static readonly NOTEBOOKS_DIR = __APP_CONFIG__.notebook.opfs.directory

  /**
   * Check if OPFS is supported in the current browser
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage
  }

  /**
   * Initialize OPFS and get root directory handle
   */
  private static async getRootHandle(): Promise<FileSystemDirectoryHandle> {
    if (!this.isSupported()) {
      throw new Error('OPFS is not supported in this browser')
    }

    if (this.rootHandle) {
      return this.rootHandle
    }

    try {
      this.rootHandle = await navigator.storage.getDirectory()
      return this.rootHandle
    } catch (error) {
      throw new Error(`Failed to initialize OPFS: ${error}`)
    }
  }

  /**
   * Get or create the notebooks directory
   */
  private static async getNotebooksDirectory(): Promise<FileSystemDirectoryHandle> {
    const root = await this.getRootHandle()
    return await root.getDirectoryHandle(this.NOTEBOOKS_DIR, { create: true })
  }

  /**
   * Get or create a notebook directory
   */
  private static async getNotebookDirectory(
    notebookId: string,
  ): Promise<FileSystemDirectoryHandle> {
    const notebooksDir = await this.getNotebooksDirectory()
    return await notebooksDir.getDirectoryHandle(notebookId, { create: true })
  }

  /**
   * Get or create the blobs directory for a notebook
   */
  private static async getBlobsDirectory(notebookId: string): Promise<FileSystemDirectoryHandle> {
    const notebookDir = await this.getNotebookDirectory(notebookId)
    return await notebookDir.getDirectoryHandle('blobs', { create: true })
  }

  /**
   * Save an encrypted blob to OPFS
   */
  static async saveBlob(
    notebookId: string,
    uuid: string,
    encryptedData: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const blobsDir = await this.getBlobsDirectory(notebookId)
    const fileName = `${uuid}.enc`
    const fileHandle = await blobsDir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()

    try {
      // Ensure we have a proper ArrayBuffer-backed Uint8Array (not SharedArrayBuffer)
      let dataBuffer: ArrayBuffer
      if (encryptedData instanceof Uint8Array) {
        dataBuffer = encryptedData.buffer.slice(
          encryptedData.byteOffset,
          encryptedData.byteOffset + encryptedData.byteLength,
        ) as ArrayBuffer
      } else {
        dataBuffer = encryptedData
      }

      const data = new Uint8Array(dataBuffer)
      await writable.write(data)
    } catch (error) {
      try {
        await writable.close()
      } catch {
        // Ignore close errors when write fails
      }
      throw new Error(`Failed to save blob ${uuid}: ${error}`)
    }

    await writable.close()
  }

  /**
   * Get an encrypted blob from OPFS
   */
  static async getBlob(notebookId: string, uuid: string): Promise<ArrayBuffer | null> {
    try {
      const blobsDir = await this.getBlobsDirectory(notebookId)
      const fileName = `${uuid}.enc`
      const fileHandle = await blobsDir.getFileHandle(fileName, { create: false })
      const file = await fileHandle.getFile()
      return await file.arrayBuffer()
    } catch {
      // File doesn't exist or error reading
      return null
    }
  }

  /**
   * Check if a blob exists in OPFS
   */
  static async hasBlob(notebookId: string, uuid: string): Promise<boolean> {
    try {
      const blobsDir = await this.getBlobsDirectory(notebookId)
      const fileName = `${uuid}.enc`
      await blobsDir.getFileHandle(fileName, { create: false })
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete a blob from OPFS
   */
  static async deleteBlob(notebookId: string, uuid: string): Promise<boolean> {
    try {
      const blobsDir = await this.getBlobsDirectory(notebookId)
      const fileName = `${uuid}.enc`
      await blobsDir.removeEntry(fileName)
      return true
    } catch {
      return false
    }
  }

  /**
   * List all blob UUIDs for a notebook
   */
  static async listBlobs(notebookId: string): Promise<string[]> {
    try {
      const blobsDir = await this.getBlobsDirectory(notebookId)
      const uuids: string[] = []

      const entries = (blobsDir as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()
      for await (const [name] of entries) {
        if (name.endsWith('.enc')) {
          // Extract UUID from filename (remove .enc extension)
          const uuid = name.slice(0, -4)
          uuids.push(uuid)
        }
      }

      return uuids
    } catch {
      return []
    }
  }

  /**
   * Save encrypted manifest to OPFS
   */
  static async saveManifest(
    notebookId: string,
    encryptedManifest: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const notebookDir = await this.getNotebookDirectory(notebookId)
    const fileHandle = await notebookDir.getFileHandle('manifest.json.enc', { create: true })
    const writable = await fileHandle.createWritable()

    try {
      // Ensure we have a proper ArrayBuffer-backed Uint8Array (not SharedArrayBuffer)
      let dataBuffer: ArrayBuffer
      if (encryptedManifest instanceof Uint8Array) {
        dataBuffer = encryptedManifest.buffer.slice(
          encryptedManifest.byteOffset,
          encryptedManifest.byteOffset + encryptedManifest.byteLength,
        ) as ArrayBuffer
      } else {
        dataBuffer = encryptedManifest
      }

      const data = new Uint8Array(dataBuffer)
      await writable.write(data)
    } catch (error) {
      try {
        await writable.close()
      } catch {
        // Ignore close errors when write fails
      }
      throw new Error(`Failed to save manifest: ${error}`)
    }

    await writable.close()
  }

  /**
   * Get encrypted manifest from OPFS
   */
  static async getManifest(notebookId: string): Promise<ArrayBuffer | null> {
    try {
      const notebookDir = await this.getNotebookDirectory(notebookId)
      const fileHandle = await notebookDir.getFileHandle('manifest.json.enc', { create: false })
      const file = await fileHandle.getFile()
      return await file.arrayBuffer()
    } catch {
      return null
    }
  }

  /**
   * Check if manifest exists in OPFS
   */
  static async hasManifest(notebookId: string): Promise<boolean> {
    try {
      const notebookDir = await this.getNotebookDirectory(notebookId)
      await notebookDir.getFileHandle('manifest.json.enc', { create: false })
      return true
    } catch {
      return false
    }
  }

  /**
   * Clear all data for a notebook
   */
  static async clearNotebook(notebookId: string): Promise<void> {
    try {
      const notebooksDir = await this.getNotebooksDirectory()
      await notebooksDir.removeEntry(notebookId, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to clear notebook ${notebookId}: ${error}`)
    }
  }

  /**
   * List all notebook IDs stored in OPFS
   */
  static async listNotebooks(): Promise<string[]> {
    try {
      const notebooksDir = await this.getNotebooksDirectory()
      const notebookIds: string[] = []

      const entries = (notebooksDir as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()
      for await (const [name] of entries) {
        notebookIds.push(name)
      }

      return notebookIds
    } catch {
      return []
    }
  }

  /**
   * Get storage usage statistics for a notebook
   */
  static async getNotebookStats(notebookId: string): Promise<{
    blobCount: number
    totalBlobSize: number
    manifestSize: number
    totalSize: number
  }> {
    const blobs = await this.listBlobs(notebookId)
    let totalBlobSize = 0

    // Calculate total blob size
    for (const uuid of blobs) {
      const blob = await this.getBlob(notebookId, uuid)
      if (blob) {
        totalBlobSize += blob.byteLength
      }
    }

    // Get manifest size
    const manifest = await this.getManifest(notebookId)
    const manifestSize = manifest ? manifest.byteLength : 0

    const totalSize = totalBlobSize + manifestSize

    return {
      blobCount: blobs.length,
      totalBlobSize,
      manifestSize,
      totalSize,
    }
  }

  /**
   * Clean up orphaned blobs (blobs not referenced in manifest)
   * Useful for cache cleanup
   */
  static async cleanupOrphanedBlobs(
    notebookId: string,
    validUuids: string[],
  ): Promise<number> {
    const allBlobs = await this.listBlobs(notebookId)
    const validSet = new Set(validUuids)
    let cleanedCount = 0

    for (const uuid of allBlobs) {
      if (!validSet.has(uuid)) {
        await this.deleteBlob(notebookId, uuid)
        cleanedCount++
      }
    }

    return cleanedCount
  }

  /**
   * Get total storage usage across all notebooks
   */
  static async getTotalStorageUsage(): Promise<{
    notebookCount: number
    totalSize: number
    notebookStats: Array<{ notebookId: string; size: number }>
  }> {
    const notebooks = await this.listNotebooks()
    const notebookStats: Array<{ notebookId: string; size: number }> = []
    let totalSize = 0

    for (const notebookId of notebooks) {
      const stats = await this.getNotebookStats(notebookId)
      notebookStats.push({
        notebookId,
        size: stats.totalSize,
      })
      totalSize += stats.totalSize
    }

    return {
      notebookCount: notebooks.length,
      totalSize,
      notebookStats,
    }
  }
}
