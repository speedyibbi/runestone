import FileService from '@/services/file'
import CryptoService from '@/services/crypto'

/**
 * RemoteService handles all remote storage operations
 * Manages meta.json, manifest.json.enc, and encrypted blobs
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
   * Get meta.json (unencrypted)
   */
  static async getMeta(notebookId: string, signal?: AbortSignal): Promise<any> {
    const path = this.getPath(notebookId, 'meta.json')
    const response = await FileService.getFile(path, signal)
    return await response.json()
  }

  /**
   * Put meta.json (unencrypted)
   */
  static async putMeta(notebookId: string, meta: any, signal?: AbortSignal): Promise<void> {
    const path = this.getPath(notebookId, 'meta.json')
    const blob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get manifest.json.enc (fetch and decrypt)
   */
  static async getManifest(
    notebookId: string,
    fek: CryptoKey,
    signal?: AbortSignal,
  ): Promise<any> {
    const path = this.getPath(notebookId, 'manifest.json.enc')
    const response = await FileService.getFile(path, signal)
    const encryptedData = await response.arrayBuffer()

    const decrypted = await CryptoService.unpackAndDecrypt(encryptedData, fek)
    const manifestText = new TextDecoder().decode(decrypted)
    return JSON.parse(manifestText)
  }

  /**
   * Put manifest.json.enc (encrypt and upload)
   */
  static async putManifest(
    notebookId: string,
    manifest: any,
    fek: CryptoKey,
    signal?: AbortSignal,
  ): Promise<void> {
    const manifestText = JSON.stringify(manifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)

    const packed = await CryptoService.encryptAndPack(manifestBytes, fek)

    const path = this.getPath(notebookId, 'manifest.json.enc')
    const buffer = packed.buffer.slice(
      packed.byteOffset,
      packed.byteOffset + packed.byteLength,
    ) as ArrayBuffer
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Get encrypted blob (fetch and decrypt)
   */
  static async getBlob(
    notebookId: string,
    uuid: string,
    fek: CryptoKey,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const path = this.getBlobPath(notebookId, uuid)
    const response = await FileService.getFile(path, signal)
    const encryptedData = await response.arrayBuffer()

    return await CryptoService.unpackAndDecrypt(encryptedData, fek)
  }

  /**
   * Get encrypted blob without decrypting (returns raw encrypted data)
   */
  static async getBlobRaw(
    notebookId: string,
    uuid: string,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    const path = this.getBlobPath(notebookId, uuid)
    const response = await FileService.getFile(path, signal)
    return await response.arrayBuffer()
  }

  /**
   * Put encrypted blob (encrypt and upload)
   */
  static async putBlob(
    notebookId: string,
    uuid: string,
    data: ArrayBuffer | Uint8Array,
    fek: CryptoKey,
    signal?: AbortSignal,
  ): Promise<void> {
    const packed = await CryptoService.encryptAndPack(data, fek)

    const path = this.getBlobPath(notebookId, uuid)
    const buffer = packed.buffer.slice(
      packed.byteOffset,
      packed.byteOffset + packed.byteLength,
    ) as ArrayBuffer
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File, signal)
  }

  /**
   * Put encrypted blob without encrypting (upload raw encrypted data)
   */
  static async putBlobRaw(
    notebookId: string,
    uuid: string,
    encryptedData: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    const path = this.getBlobPath(notebookId, uuid)
    const buffer = encryptedData instanceof Uint8Array
      ? (encryptedData.buffer.slice(
          encryptedData.byteOffset,
          encryptedData.byteOffset + encryptedData.byteLength,
        ) as ArrayBuffer)
      : encryptedData
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
