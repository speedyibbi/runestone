import OPFSService from '@/services/l1-storage/opfs'
import type { PathParams } from '@/interfaces/storage'
import type { RootMeta, NotebookMeta } from '@/interfaces/meta'

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
   * Build the path for a given file type
   */
  private static buildPath(params: PathParams): string[] {
    const { type, notebookId, uuid } = params

    switch (type) {
      case 'rootMeta':
        return ['meta.json']
      case 'map':
        return ['map.json.enc']
      case 'notebookMeta':
        return [notebookId!, 'meta.json']
      case 'manifest':
        return [notebookId!, 'manifest.json.enc']
      case 'blob':
        return [notebookId!, 'blobs', `${uuid}.enc`]
    }
  }

  /**
   * Get root meta.json from cache (unencrypted)
   */
  static async getRootMeta(): Promise<RootMeta | null> {
    const path = this.buildPath({ type: 'rootMeta' })
    const data = await OPFSService.getFile(path)

    if (!data) {
      return null
    }

    const metaText = new TextDecoder().decode(data)
    return JSON.parse(metaText)
  }

  /**
   * Upsert root meta.json to cache (unencrypted)
   */
  static async upsertRootMeta(meta: RootMeta): Promise<void> {
    const path = this.buildPath({ type: 'rootMeta' })
    const metaText = JSON.stringify(meta, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.upsertFile(path, metaBytes)
  }

  /**
   * Delete root meta.json from cache
   */
  static async deleteRootMeta(): Promise<boolean> {
    const path = this.buildPath({ type: 'rootMeta' })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get encrypted map.json.enc from cache
   */
  static async getMap(): Promise<ArrayBuffer | null> {
    const path = this.buildPath({ type: 'map' })
    return await OPFSService.getFile(path)
  }

  /**
   * Upsert encrypted map.json.enc to cache
   */
  static async upsertMap(encryptedMap: ArrayBuffer | Uint8Array): Promise<void> {
    const path = this.buildPath({ type: 'map' })
    await OPFSService.upsertFile(path, encryptedMap)
  }

  /**
   * Delete map.json.enc from cache
   */
  static async deleteMap(): Promise<boolean> {
    const path = this.buildPath({ type: 'map' })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get notebook meta.json from cache (unencrypted)
   */
  static async getNotebookMeta(notebookId: string): Promise<NotebookMeta | null> {
    const path = this.buildPath({ type: 'notebookMeta', notebookId })
    const data = await OPFSService.getFile(path)

    if (!data) {
      return null
    }

    const metaText = new TextDecoder().decode(data)
    return JSON.parse(metaText)
  }

  /**
   * Upsert notebook meta.json to cache (unencrypted)
   */
  static async upsertNotebookMeta(notebookId: string, meta: NotebookMeta): Promise<void> {
    const path = this.buildPath({ type: 'notebookMeta', notebookId })
    const metaText = JSON.stringify(meta, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.upsertFile(path, metaBytes)
  }

  /**
   * Delete notebook meta.json from cache
   */
  static async deleteNotebookMeta(notebookId: string): Promise<boolean> {
    const path = this.buildPath({ type: 'notebookMeta', notebookId })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get encrypted manifest from cache
   */
  static async getManifest(notebookId: string): Promise<ArrayBuffer | null> {
    const path = this.buildPath({ type: 'manifest', notebookId })
    return await OPFSService.getFile(path)
  }

  /**
   * Upsert encrypted manifest to cache
   */
  static async upsertManifest(
    notebookId: string,
    encryptedManifest: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.buildPath({ type: 'manifest', notebookId })
    await OPFSService.upsertFile(path, encryptedManifest)
  }

  /**
   * Delete manifest from cache
   */
  static async deleteManifest(notebookId: string): Promise<boolean> {
    const path = this.buildPath({ type: 'manifest', notebookId })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get encrypted blob from cache
   */
  static async getBlob(notebookId: string, uuid: string): Promise<ArrayBuffer | null> {
    const path = this.buildPath({ type: 'blob', notebookId, uuid })
    return await OPFSService.getFile(path)
  }

  /**
   * Upsert encrypted blob to cache
   */
  static async upsertBlob(
    notebookId: string,
    uuid: string,
    encryptedBlob: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.buildPath({ type: 'blob', notebookId, uuid })
    await OPFSService.upsertFile(path, encryptedBlob)
  }

  /**
   * Delete blob from cache
   */
  static async deleteBlob(notebookId: string, uuid: string): Promise<boolean> {
    const path = this.buildPath({ type: 'blob', notebookId, uuid })
    return await OPFSService.deleteFile(path)
  }
}
