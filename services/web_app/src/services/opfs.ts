import { toArrayBuffer } from '@/utils/helpers'

/**
 * OPFSService provides simple primitives for interacting with Origin Private File System
 */
export default class OPFSService {
  private static rootHandle: FileSystemDirectoryHandle | null = null

  /**
   * Check if OPFS is supported in the current browser
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage
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
  static async getDirectory(path: string[], create = true): Promise<FileSystemDirectoryHandle> {
    let current = await this.getRootHandle()

    for (const segment of path) {
      current = await current.getDirectoryHandle(segment, { create })
    }

    return current
  }

  /**
   * Write a file to OPFS
   */
  static async writeFile(path: string[], data: ArrayBuffer | Uint8Array): Promise<void> {
    const dirPath = path.slice(0, -1)
    const fileName = path[path.length - 1]

    const dir = await this.getDirectory(dirPath, true)
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
   * Read a file from OPFS
   */
  static async readFile(path: string[]): Promise<ArrayBuffer | null> {
    try {
      const dirPath = path.slice(0, -1)
      const fileName = path[path.length - 1]

      const dir = await this.getDirectory(dirPath, false)
      const fileHandle = await dir.getFileHandle(fileName, { create: false })
      const file = await fileHandle.getFile()
      return await file.arrayBuffer()
    } catch {
      return null
    }
  }

  /**
   * Check if a file exists
   */
  static async fileExists(path: string[]): Promise<boolean> {
    try {
      const dirPath = path.slice(0, -1)
      const fileName = path[path.length - 1]

      const dir = await this.getDirectory(dirPath, false)
      await dir.getFileHandle(fileName, { create: false })
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete a file from OPFS
   */
  static async deleteFile(path: string[]): Promise<boolean> {
    try {
      const dirPath = path.slice(0, -1)
      const fileName = path[path.length - 1]

      const dir = await this.getDirectory(dirPath, false)
      await dir.removeEntry(fileName)
      return true
    } catch {
      return false
    }
  }

  /**
   * List all entries in a directory
   */
  static async listDirectory(path: string[]): Promise<string[]> {
    try {
      const dir = await this.getDirectory(path, false)
      const entries: string[] = []

      const iterator = (dir as unknown as { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()
      for await (const [name] of iterator) {
        entries.push(name)
      }

      return entries
    } catch {
      return []
    }
  }

  /**
   * Check if a directory exists
   */
  static async directoryExists(path: string[]): Promise<boolean> {
    try {
      await this.getDirectory(path, false)
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete a directory and all its contents
   */
  static async deleteDirectory(path: string[]): Promise<boolean> {
    try {
      const parentPath = path.slice(0, -1)
      const dirName = path[path.length - 1]

      const parent = parentPath.length > 0 
        ? await this.getDirectory(parentPath, false)
        : await this.getRootHandle()

      await parent.removeEntry(dirName, { recursive: true })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file size
   */
  static async getFileSize(path: string[]): Promise<number | null> {
    try {
      const dirPath = path.slice(0, -1)
      const fileName = path[path.length - 1]

      const dir = await this.getDirectory(dirPath, false)
      const fileHandle = await dir.getFileHandle(fileName, { create: false })
      const file = await fileHandle.getFile()
      return file.size
    } catch {
      return null
    }
  }
}

