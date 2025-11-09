import FileService from '@/services/file'
import { toArrayBuffer } from '@/utils/helpers'

/**
 * RemoteService handles pure remote storage operations
 */
export default class RemoteService {
  /**
   * Get the path for a notebook file
   */
  private static getPath(notebookId: string, filename: string): string {
    return `${notebookId}/${filename}`
  }

  /**
   * Get the path for a blob
   */
  private static getBlobPath(notebookId: string, uuid: string): string {
    return `${notebookId}/blobs/${uuid}.enc`
  }

  /**
   * Get meta.json
   */
  static async getMeta(notebookId: string, signal?: AbortSignal): Promise<any> {
    const path = this.getPath(notebookId, 'meta.json')
    const response = await FileService.getFile(path, signal)
    return await response.json()
  }

  /**
   * Put meta.json
   */
  static async putMeta(notebookId: string, meta: any, signal?: AbortSignal): Promise<void> {
    const path = this.getPath(notebookId, 'meta.json')
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get manifest.json.enc (returns encrypted data)
   */
  static async getManifest(
    notebookId: string,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const path = this.getPath(notebookId, 'manifest.json.enc')
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Put manifest.json.enc (upload encrypted data)
   */
  static async putManifest(
    notebookId: string,
    encryptedManifest: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.getPath(notebookId, 'manifest.json.enc')
    const buffer = toArrayBuffer(encryptedManifest)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get encrypted blob (returns encrypted data)
   */
  static async getBlob(
    notebookId: string,
    uuid: string,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const path = this.getBlobPath(notebookId, uuid)
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Put encrypted blob (upload encrypted data)
   */
  static async putBlob(
    notebookId: string,
    uuid: string,
    encryptedBlob: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.getBlobPath(notebookId, uuid)
    const buffer = toArrayBuffer(encryptedBlob)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Delete encrypted blob
   */
  static async deleteBlob(notebookId: string, uuid: string, signal?: AbortSignal): Promise<void> {
    const path = this.getBlobPath(notebookId, uuid)
    await FileService.deleteFile(path, signal)
  }

  /**
   * List all notebooks
   */
  static async listNotebooks(signal?: AbortSignal): Promise<string[]> {
    const result = await FileService.listFiles('', signal)

    // Extract notebook IDs from directory paths
    const notebookIds = result.directories
      .map((dir: string) => {
        // Remove trailing slash and get the directory name
        const trimmed = dir.endsWith('/') ? dir.slice(0, -1) : dir
        return trimmed
      })
      .filter((id: string) => id) // Filter out empty strings

    return notebookIds
  }
}
