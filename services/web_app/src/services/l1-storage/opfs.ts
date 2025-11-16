import { toArrayBuffer } from '@/utils/helpers'

/**
 * OPFSService provides simple primitives for interacting with Origin Private File System
 */
export default class OPFSService {
  private static rootHandle: FileSystemDirectoryHandle | null = null

  /**
   * Check if OPFS is supported in the current browser
   */
  private static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'storage' in navigator &&
      'getDirectory' in navigator.storage
    )
  }

  /**
   * Get the root OPFS directory handle
   */
  private static async getRootHandle(): Promise<FileSystemDirectoryHandle> {
    if (!this.isSupported()) {
      throw new Error('OPFS is not supported in this browser')
    }

    if (this.rootHandle) {
      return this.rootHandle
    }

    this.rootHandle = await navigator.storage.getDirectory()
    return this.rootHandle
  }

  /**
   * Get or create a directory handle at the given path
   */
  private static async getDirectoryHandle(
    path: string[],
    create = true,
  ): Promise<FileSystemDirectoryHandle> {
    let current = await this.getRootHandle()

    for (const segment of path) {
      current = await current.getDirectoryHandle(segment, { create })
    }

    return current
  }

  /**
   * Get a file from OPFS
   */
  static async getFile(path: string[]): Promise<ArrayBuffer | null> {
    try {
      const dirPath = path.slice(0, -1)
      const fileName = path[path.length - 1]

      const dir = await this.getDirectoryHandle(dirPath, false)
      const fileHandle = await dir.getFileHandle(fileName, { create: false })
      const file = await fileHandle.getFile()
      return await file.arrayBuffer()
    } catch {
      return null
    }
  }

  /**
   * Create or update a file in OPFS
   */
  static async upsertFile(path: string[], data: ArrayBuffer | Uint8Array): Promise<void> {
    const dirPath = path.slice(0, -1)
    const fileName = path[path.length - 1]

    const dir = await this.getDirectoryHandle(dirPath, true)
    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()

    try {
      const dataBuffer = toArrayBuffer(data)
      await writable.write(new Uint8Array(dataBuffer))
      await writable.close()
    } catch (error) {
      try {
        await writable.close()
      } catch {
        // Ignore close errors
      }
      throw error
    }
  }

  /**
   * Delete a file from OPFS
   */
  static async deleteFile(path: string[]): Promise<boolean> {
    try {
      const dirPath = path.slice(0, -1)
      const fileName = path[path.length - 1]

      const dir = await this.getDirectoryHandle(dirPath, false)
      await dir.removeEntry(fileName)
      return true
    } catch {
      return false
    }
  }
}
