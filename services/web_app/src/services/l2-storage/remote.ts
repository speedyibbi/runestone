import FileService from '@/services/l1-storage/file'
import { toArrayBuffer } from '@/utils/helpers'
import type { PathParams } from '@/interfaces/storage'

/**
 * RemoteService handles pure remote storage operations
 */
export default class RemoteService {
  /**
   * Build the path for a given file type
   */
  private static buildPath(params: PathParams): string {
    const { type, notebookId, uuid } = params

    switch (type) {
      case 'rootMeta':
        return 'meta.json'
      case 'map':
        return 'map.json.enc'
      case 'notebookMeta':
        return `${notebookId}/meta.json`
      case 'manifest':
        return `${notebookId}/manifest.json.enc`
      case 'blob':
        return `${notebookId}/blobs/${uuid}.enc`
    }
  }

  /**
   * Get root meta.json (unencrypted)
   */
  static async getRootMeta(signal?: AbortSignal): Promise<any> {
    const path = this.buildPath({ type: 'rootMeta' })
    const response = await FileService.getFile(path, signal)
    return await response.json()
  }

  /**
   * Upsert root meta.json (unencrypted)
   */
  static async upsertRootMeta(meta: any, signal?: AbortSignal): Promise<void> {
    const path = this.buildPath({ type: 'rootMeta' })
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Delete root meta.json
   */
  static async deleteRootMeta(signal?: AbortSignal): Promise<void> {
    const path = this.buildPath({ type: 'rootMeta' })
    await FileService.deleteFile(path, signal)
  }

  /**
   * Get map.json.enc (returns encrypted data)
   */
  static async getMap(signal?: AbortSignal): Promise<ArrayBuffer> {
    const path = this.buildPath({ type: 'map' })
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Upsert map.json.enc (upload encrypted data)
   */
  static async upsertMap(
    encryptedMap: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.buildPath({ type: 'map' })
    const buffer = toArrayBuffer(encryptedMap)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Delete map.json.enc
   */
  static async deleteMap(signal?: AbortSignal): Promise<void> {
    const path = this.buildPath({ type: 'map' })
    await FileService.deleteFile(path, signal)
  }

  /**
   * Get notebook meta.json (unencrypted)
   */
  static async getNotebookMeta(notebookId: string, signal?: AbortSignal): Promise<any> {
    const path = this.buildPath({ type: 'notebookMeta', notebookId })
    const response = await FileService.getFile(path, signal)
    return await response.json()
  }

  /**
   * Upsert notebook meta.json (unencrypted)
   */
  static async upsertNotebookMeta(
    notebookId: string,
    meta: any,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.buildPath({ type: 'notebookMeta', notebookId })
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Delete notebook meta.json
   */
  static async deleteNotebookMeta(notebookId: string, signal?: AbortSignal): Promise<void> {
    const path = this.buildPath({ type: 'notebookMeta', notebookId })
    await FileService.deleteFile(path, signal)
  }

  /**
   * Get manifest.json.enc (returns encrypted data)
   */
  static async getManifest(notebookId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    const path = this.buildPath({ type: 'manifest', notebookId })
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Upsert manifest.json.enc (upload encrypted data)
   */
  static async upsertManifest(
    notebookId: string,
    encryptedManifest: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.buildPath({ type: 'manifest', notebookId })
    const buffer = toArrayBuffer(encryptedManifest)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Delete manifest.json.enc
   */
  static async deleteManifest(notebookId: string, signal?: AbortSignal): Promise<void> {
    const path = this.buildPath({ type: 'manifest', notebookId })
    await FileService.deleteFile(path, signal)
  }

  /**
   * Get encrypted blob (returns encrypted data)
   */
  static async getBlob(
    notebookId: string,
    uuid: string,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const path = this.buildPath({ type: 'blob', notebookId, uuid })
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Upsert encrypted blob (upload encrypted data)
   */
  static async upsertBlob(
    notebookId: string,
    uuid: string,
    encryptedBlob: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.buildPath({ type: 'blob', notebookId, uuid })
    const buffer = toArrayBuffer(encryptedBlob)
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Delete encrypted blob
   */
  static async deleteBlob(notebookId: string, uuid: string, signal?: AbortSignal): Promise<void> {
    const path = this.buildPath({ type: 'blob', notebookId, uuid })
    await FileService.deleteFile(path, signal)
  }
}
