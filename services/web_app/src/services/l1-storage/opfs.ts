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

  /**
   * Delete a directory from OPFS (recursively)
   * Removes all files and subdirectories within the directory, then removes the directory itself
   */
  static async deleteDirectory(path: string[]): Promise<boolean> {
    try {
      const dirPath = path.slice(0, -1)
      const dirName = path[path.length - 1]

      // Get the parent directory
      const parentDir = await this.getDirectoryHandle(dirPath, false)
      
      // Get the directory to delete
      const dirToDelete = await parentDir.getDirectoryHandle(dirName, { create: false })
      
      // Collect all entries first to avoid modifying while iterating
      const entries: Array<{ name: string; kind: 'file' | 'directory' }> = []
      // @ts-expect-error - FileSystemDirectoryHandle supports async iteration at runtime
      for await (const [name, handle] of dirToDelete.entries()) {
        entries.push({ name, kind: handle.kind })
      }
      
      // Recursively delete all entries in the directory
      for (const entry of entries) {
        if (entry.kind === 'file') {
          await dirToDelete.removeEntry(entry.name)
        } else if (entry.kind === 'directory') {
          // Recursively delete subdirectories
          await this.deleteDirectory([...path, entry.name])
        }
      }
      
      // Remove the directory itself
      await parentDir.removeEntry(dirName, { recursive: true })
      return true
    } catch {
      return false
    }
  }
}
