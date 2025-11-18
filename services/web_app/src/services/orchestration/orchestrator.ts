/* eslint-disable @typescript-eslint/no-unused-vars */
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import CryptoService from '@/services/cryptography/crypto'
import MetaService from '@/services/file-io/meta'
import MapService from '@/services/file-io/map'
import CacheService from '@/services/l2-storage/cache'
import RemoteService from '@/services/l2-storage/remote'
import { toBase64 } from '@/utils/helpers'
import type {
  InitializeResult,
  BootstrapResult,
  CreateNotebookResult,
  LoadNotebookResult,
  UpdateNotebookResult,
  GetBlobResult,
  UpdateBlobResult,
  DeleteBlobResult,
  BlobMetadata,
} from '@/interfaces/orchestrator'
import type { Map } from '@/interfaces/map'
import type { Manifest } from '@/interfaces/manifest'
import type { SyncProgress, SyncResult } from '@/interfaces/sync'

/**
 * OrchestrationService handles high-level operations for notebook management
 * Coordinates between crypto, storage, and sync services
 */
export default class OrchestrationService {
  /**
   * Compute lookup hash from email and lookup key
   * Uses HMAC-SHA256(email, lookup_key)
   */
  private static computeLookupHash(email: string, lookupKey: string): string {
    const emailBytes = new TextEncoder().encode(email)
    const keyBytes = new TextEncoder().encode(lookupKey)
    const hashBytes = hmac(sha256, keyBytes, emailBytes)
    return toBase64(hashBytes)
  }

  /**
   * Initialize new user account (first-time setup)
   * Creates root meta and map, uploads to remote storage
   */
  static async initialize(
    email: string,
    lookupKey: string,
    signal?: AbortSignal,
  ): Promise<InitializeResult> {
    // Step 1: Compute lookup hash
    const lookupHash = this.computeLookupHash(email, lookupKey)

    // Step 2: Generate MEK (Map Encryption Key)
    const mek = await CryptoService.generateKey()

    // Step 3: Generate salt and derive MKEK (Map Key Encryption Key) from lookup key
    const salt = crypto.getRandomValues(new Uint8Array(__APP_CONFIG__.crypto.kdf.saltLength))
    const mkek = await CryptoService.deriveMKEK(lookupKey, {
      algorithm: 'pbkdf2-sha256',
      salt,
      iterations: __APP_CONFIG__.crypto.kdf.pbkdf2.iterations,
    })

    // Step 4: Encrypt MEK with MKEK
    const encryptedMek = await CryptoService.encryptKey(mek, mkek)

    // Step 5: Create root meta with KDF parameters and encrypted MEK
    const rootMeta = MetaService.createRootMeta(
      {
        algorithm: 'pbkdf2-sha256',
        salt,
        iterations: __APP_CONFIG__.crypto.kdf.pbkdf2.iterations,
      },
      encryptedMek,
    )

    // Step 6: Create empty map
    const map = MapService.create()

    // Step 7: Encrypt map with MEK
    const mapText = JSON.stringify(map, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Step 8: Upload to remote storage (fail if this fails)
    try {
      await RemoteService.upsertRootMeta(rootMeta, signal)
      await RemoteService.upsertMap(encryptedMap, signal)
    } catch (error) {
      throw new Error(
        `Failed to save root meta and map to remote storage during initialization: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 9: Cache locally
    await CacheService.upsertRootMeta(rootMeta)
    await CacheService.upsertMap(encryptedMap)

    return {
      rootMeta,
      map,
      mek,
      lookupHash,
    }
  }

  /**
   * Bootstrap existing user account (returning user)
   * Fetches and decrypts root meta and map from remote storage
   */
  static async bootstrap(
    email: string,
    lookupKey: string,
    signal?: AbortSignal,
  ): Promise<BootstrapResult> {
    // Step 1: Compute lookup hash
    const lookupHash = this.computeLookupHash(email, lookupKey)

    // Step 2: Fetch root meta from remote storage (fail if this fails)
    let rootMeta
    try {
      rootMeta = await RemoteService.getRootMeta(signal)
    } catch (error) {
      throw new Error(
        `Failed to fetch root meta during bootstrap: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 3: Derive MKEK using KDF params from root meta
    const mkek = await CryptoService.deriveMKEK(lookupKey, rootMeta.kdf)

    // Step 4: Decrypt encrypted MEK to get MEK
    let mek
    try {
      mek = await CryptoService.decryptKey(rootMeta.encrypted_mek, mkek)
    } catch (error) {
      throw new Error(
        `Failed to decrypt MEK (invalid lookup key?): ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 5: Fetch encrypted map from remote storage (fail if this fails)
    let encryptedMap
    try {
      encryptedMap = await RemoteService.getMap(signal)
    } catch (error) {
      throw new Error(
        `Failed to fetch map during bootstrap: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 6: Decrypt map with MEK
    let map
    try {
      const decryptedMapBuffer = await CryptoService.unpackAndDecrypt(encryptedMap, mek)
      const mapText = new TextDecoder().decode(decryptedMapBuffer)
      map = JSON.parse(mapText) as Map
    } catch (error) {
      throw new Error(
        `Failed to decrypt map: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 7: Cache both locally
    await CacheService.upsertRootMeta(rootMeta)
    await CacheService.upsertMap(encryptedMap)

    return {
      rootMeta,
      map,
      mek,
      lookupHash,
    }
  }

  /**
   * Create a new notebook
   * Creates notebook directory, meta, and manifest
   */
  static async createNotebook(
    notebookTitle: string,
    lookupKey: string,
    mek: CryptoKey,
    map: Map,
    signal?: AbortSignal,
  ): Promise<CreateNotebookResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Load an existing notebook
   * Fetches meta and manifest, then syncs with remote
   */
  static async loadNotebook(
    notebookId: string,
    lookupKey: string,
    onProgress?: (progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<LoadNotebookResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Update notebook title
   * Updates both manifest and map
   */
  static async updateNotebook(
    notebookId: string,
    newTitle: string,
    fek: CryptoKey,
    mek: CryptoKey,
    manifest: Manifest,
    map: Map,
    signal?: AbortSignal,
  ): Promise<UpdateNotebookResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Get a blob from a notebook
   * Retrieves and decrypts the blob
   */
  static async getBlob(
    notebookId: string,
    uuid: string,
    fek: CryptoKey,
    signal?: AbortSignal,
  ): Promise<GetBlobResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Update a blob in a notebook
   * Encrypts and uploads to both cache and remote, updates manifest
   */
  static async updateBlob(
    notebookId: string,
    uuid: string,
    data: ArrayBuffer | Uint8Array,
    metadata: BlobMetadata,
    fek: CryptoKey,
    manifest: Manifest,
    signal?: AbortSignal,
  ): Promise<UpdateBlobResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Delete a blob from a notebook
   * Removes from both cache and remote, updates manifest
   */
  static async deleteBlob(
    notebookId: string,
    uuid: string,
    fek: CryptoKey,
    manifest: Manifest,
    signal?: AbortSignal,
  ): Promise<DeleteBlobResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Sync a single notebook
   * Uses SyncService to sync between remote and cache
   */
  static async syncNotebook(
    notebookId: string,
    fek: CryptoKey,
    onProgress?: (progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<SyncResult> {
    throw new Error('Not implemented yet')
  }

  /**
   * Sync all notebooks
   * Syncs all notebooks in the map
   */
  static async syncAllNotebooks(
    map: Map,
    lookupKey: string,
    onProgress?: (notebookId: string, progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<Record<string, SyncResult>> {
    throw new Error('Not implemented yet')
  }
}
