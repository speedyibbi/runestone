import FileService from '@/services/file'
import { toArrayBuffer } from '@/utils/helpers'

/**
 * RemoteService handles pure remote storage operations
 */
export default class RemoteService {
  /**
   * Get the path for a notebook file
   */
  private static getNotebookPath(notebookId: string, filename: string): string {
    return `${notebookId}/${filename}`
  }

  /**
   * Get the path for a blob
   */
  private static getBlobPath(notebookId: string, uuid: string): string {
    return `${notebookId}/blobs/${uuid}.enc`
  }

  /**
   * Get root meta.json (unencrypted)
   */
  static async getRootMeta(signal?: AbortSignal): Promise<any> {
    const path = 'meta.json'
    const response = await FileService.getFile(path, signal)
    return await response.json()
  }

  /**
   * Put root meta.json (unencrypted)
   */
  static async putRootMeta(meta: any, signal?: AbortSignal): Promise<void> {
    const path = 'meta.json'
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get map.json.enc (returns encrypted data)
   */
  static async getMap(signal?: AbortSignal): Promise<ArrayBuffer> {
    const path = 'map.json.enc'
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Put map.json.enc (upload encrypted data)
   */
  static async putMap(
    encryptedMap: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = 'map.json.enc'
    const buffer = toArrayBuffer(encryptedMap)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get notebook meta.json (unencrypted)
   */
  static async getNotebookMeta(notebookId: string, signal?: AbortSignal): Promise<any> {
    const path = this.getNotebookPath(notebookId, 'meta.json')
    const response = await FileService.getFile(path, signal)
    return await response.json()
  }

  /**
   * Put notebook meta.json (unencrypted)
   */
  static async putNotebookMeta(notebookId: string, meta: any, signal?: AbortSignal): Promise<void> {
    const path = this.getNotebookPath(notebookId, 'meta.json')
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get manifest.json.enc (returns encrypted data)
   */
  static async getManifest(notebookId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const path = this.getNotebookPath(notebookId, 'manifest.json.enc')
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
    const path = this.getNotebookPath(notebookId, 'manifest.json.enc')
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
}
