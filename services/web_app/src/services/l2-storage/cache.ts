import { sha256 } from '@noble/hashes/sha2'
import OPFSService from '@/services/l1-storage/opfs'
import MetaService from '@/services/file-io/meta'
import { toBase64 } from '@/utils/helpers'
import type { PathParams } from '@/interfaces/storage'
import type { RootMeta, NotebookMeta } from '@/interfaces/meta'

/**
 * CacheService manages local OPFS cache for notebook data
 * Stores root-level files (meta.json, map.json.enc) and notebook-level files
 *
 * OPFS structure (security-enhanced):
 *   <SHA256(opfs:lookup_hash)>/      # Hashed to prevent direct lookupHash exposure
 *     meta.json                         # Root meta (unencrypted)
 *     map.json.enc                      # Encrypted map
 *     <notebookId>/
 *       meta.json                       # Notebook meta
 *       manifest.json.enc
 *       blobs/<uuid>.enc
 */
export default class CacheService {
  /**
   * Compute the OPFS root directory name from lookupHash
   */
  private static computeOPFSRoot(lookupHash: string): string {
    const data = new TextEncoder().encode(`opfs:${lookupHash}`)
    const hash = sha256(data)
    return toBase64(hash)
  }

  /**
   * Build the path for a given file type
   */
  private static buildPath(lookupHash: string, params: PathParams): string[] {
    const { type, notebookId, uuid } = params
    const opfsRoot = this.computeOPFSRoot(lookupHash)

    switch (type) {
      case 'rootMeta':
        return [opfsRoot, 'meta.json']
      case 'map':
        return [opfsRoot, 'map.json.enc']
      case 'notebookMeta':
        return [opfsRoot, notebookId!, 'meta.json']
      case 'manifest':
        return [opfsRoot, notebookId!, 'manifest.json.enc']
      case 'blob':
        return [opfsRoot, notebookId!, 'blobs', `${uuid}.enc`]
    }
  }

  /**
   * Get root meta.json from cache (unencrypted)
   */
  static async getRootMeta(lookupHash: string): Promise<RootMeta | null> {
    const path = this.buildPath(lookupHash, { type: 'rootMeta' })
    const data = await OPFSService.getFile(path)

    if (!data) {
      return null
    }

    const metaText = new TextDecoder().decode(data)
    const parsed = JSON.parse(metaText)
    return MetaService.deserializeRootMeta(parsed)
  }

  /**
   * Upsert root meta.json to cache (unencrypted)
   */
  static async upsertRootMeta(lookupHash: string, meta: RootMeta): Promise<void> {
    const path = this.buildPath(lookupHash, { type: 'rootMeta' })
    const serialized = MetaService.serializeRootMeta(meta)
    const metaText = JSON.stringify(serialized, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.upsertFile(path, metaBytes)
  }

  /**
   * Delete root meta.json from cache
   */
  static async deleteRootMeta(lookupHash: string): Promise<boolean> {
    const path = this.buildPath(lookupHash, { type: 'rootMeta' })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get encrypted map.json.enc from cache
   */
  static async getMap(lookupHash: string): Promise<ArrayBuffer | null> {
    const path = this.buildPath(lookupHash, { type: 'map' })
    return await OPFSService.getFile(path)
  }

  /**
   * Upsert encrypted map.json.enc to cache
   */
  static async upsertMap(
    lookupHash: string,
    encryptedMap: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.buildPath(lookupHash, { type: 'map' })
    await OPFSService.upsertFile(path, encryptedMap)
  }

  /**
   * Delete map.json.enc from cache
   */
  static async deleteMap(lookupHash: string): Promise<boolean> {
    const path = this.buildPath(lookupHash, { type: 'map' })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get notebook meta.json from cache (unencrypted)
   */
  static async getNotebookMeta(
    lookupHash: string,
    notebookId: string,
  ): Promise<NotebookMeta | null> {
    const path = this.buildPath(lookupHash, { type: 'notebookMeta', notebookId })
    const data = await OPFSService.getFile(path)

    if (!data) {
      return null
    }

    const metaText = new TextDecoder().decode(data)
    const parsed = JSON.parse(metaText)
    return MetaService.deserializeNotebookMeta(parsed)
  }

  /**
   * Upsert notebook meta.json to cache (unencrypted)
   */
  static async upsertNotebookMeta(
    lookupHash: string,
    notebookId: string,
    meta: NotebookMeta,
  ): Promise<void> {
    const path = this.buildPath(lookupHash, { type: 'notebookMeta', notebookId })
    const serialized = MetaService.serializeNotebookMeta(meta)
    const metaText = JSON.stringify(serialized, null, 2)
    const metaBytes = new TextEncoder().encode(metaText)
    await OPFSService.upsertFile(path, metaBytes)
  }

  /**
   * Delete notebook meta.json from cache
   */
  static async deleteNotebookMeta(lookupHash: string, notebookId: string): Promise<boolean> {
    const path = this.buildPath(lookupHash, { type: 'notebookMeta', notebookId })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get encrypted manifest from cache
   */
  static async getManifest(lookupHash: string, notebookId: string): Promise<ArrayBuffer | null> {
    const path = this.buildPath(lookupHash, { type: 'manifest', notebookId })
    return await OPFSService.getFile(path)
  }

  /**
   * Upsert encrypted manifest to cache
   */
  static async upsertManifest(
    lookupHash: string,
    notebookId: string,
    encryptedManifest: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.buildPath(lookupHash, { type: 'manifest', notebookId })
    await OPFSService.upsertFile(path, encryptedManifest)
  }

  /**
   * Delete manifest from cache
   */
  static async deleteManifest(lookupHash: string, notebookId: string): Promise<boolean> {
    const path = this.buildPath(lookupHash, { type: 'manifest', notebookId })
    return await OPFSService.deleteFile(path)
  }

  /**
   * Get encrypted blob from cache
   */
  static async getBlob(
    lookupHash: string,
    notebookId: string,
    uuid: string,
  ): Promise<ArrayBuffer | null> {
    const path = this.buildPath(lookupHash, { type: 'blob', notebookId, uuid })
    return await OPFSService.getFile(path)
  }

  /**
   * Upsert encrypted blob to cache
   */
  static async upsertBlob(
    lookupHash: string,
    notebookId: string,
    uuid: string,
    encryptedBlob: ArrayBuffer | Uint8Array,
  ): Promise<void> {
    const path = this.buildPath(lookupHash, { type: 'blob', notebookId, uuid })
    await OPFSService.upsertFile(path, encryptedBlob)
  }

  /**
   * Delete blob from cache
   */
  static async deleteBlob(lookupHash: string, notebookId: string, uuid: string): Promise<boolean> {
    const path = this.buildPath(lookupHash, { type: 'blob', notebookId, uuid })
    return await OPFSService.deleteFile(path)
  }
}
