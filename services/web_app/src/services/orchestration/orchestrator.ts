import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import CryptoService from '@/services/cryptography/crypto'
import MetaService from '@/services/file-io/meta'
import MapService from '@/services/file-io/map'
import ManifestService from '@/services/file-io/manifest'
import CacheService from '@/services/l2-storage/cache'
import RemoteService from '@/services/l2-storage/remote'
import SyncService from '@/services/orchestration/sync'
import { toBase64 } from '@/utils/helpers'
import type {
  InitializeResult,
  BootstrapResult,
  CreateNotebookResult,
  LoadNotebookResult,
  UpdateNotebookResult,
  DeleteNotebookResult,
  GetBlobResult,
  CreateBlobResult,
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
   * Default PBKDF2 KDF parameters (for root-level encryption)
   */
  private static readonly DEFAULT_PBKDF2_PARAMS = {
    algorithm: 'pbkdf2-sha256' as const,
    iterations: __APP_CONFIG__.crypto.kdf.pbkdf2.iterations,
  }

  /**
   * Default Argon2id KDF parameters (for notebook-level encryption)
   */
  private static readonly DEFAULT_ARGON2ID_PARAMS = {
    algorithm: 'argon2id' as const,
    iterations: __APP_CONFIG__.crypto.kdf.argon2id.iterations,
    memory: __APP_CONFIG__.crypto.kdf.argon2id.memory,
    parallelism: __APP_CONFIG__.crypto.kdf.argon2id.parallelism,
  }

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

    // Step 3: Generate salt and derive MKEK (Map Key Encryption Key) from lookup hash
    const salt = crypto.getRandomValues(new Uint8Array(__APP_CONFIG__.crypto.kdf.saltLength))
    const mkek = await CryptoService.deriveMKEK(lookupHash, {
      ...this.DEFAULT_PBKDF2_PARAMS,
      salt,
    })

    // Step 4: Encrypt MEK with MKEK
    const encryptedMek = await CryptoService.encryptKey(mek, mkek)

    // Step 5: Create root meta with KDF parameters and encrypted MEK
    const rootMeta = MetaService.createRootMeta(
      {
        ...this.DEFAULT_PBKDF2_PARAMS,
        salt,
      },
      encryptedMek,
    )

    // Step 6: Create empty map
    const map = MapService.create()

    // Step 7: Encrypt map with MEK
    const mapText = JSON.stringify(map, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Step 8: Upload both to remote storage in parallel (fail if this fails)
    try {
      await Promise.all([
        RemoteService.upsertRootMeta(rootMeta, signal),
        RemoteService.upsertMap(encryptedMap, signal),
      ])
    } catch (error) {
      throw new Error(
        `Failed to save root meta and map to remote storage during initialization: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 9: Cache both locally in parallel
    await Promise.all([
      CacheService.upsertRootMeta(rootMeta),
      CacheService.upsertMap(encryptedMap),
    ])

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

    // Step 2: Fetch root meta and map from remote storage in parallel (fail if this fails)
    let rootMeta, encryptedMap
    try {
      ;[rootMeta, encryptedMap] = await Promise.all([
        RemoteService.getRootMeta(signal),
        RemoteService.getMap(signal),
      ])
    } catch (error) {
      throw new Error(
        `Failed to fetch root meta and map during bootstrap: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 3: Derive MKEK using KDF params from root meta
    const mkek = await CryptoService.deriveMKEK(lookupHash, rootMeta.kdf)

    // Step 4: Decrypt encrypted MEK to get MEK
    let mek
    try {
      mek = await CryptoService.decryptKey(rootMeta.encrypted_mek, mkek)
    } catch (error) {
      throw new Error(
        `Failed to decrypt MEK (invalid lookup key?): ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 5: Decrypt map with MEK
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

    // Step 6: Cache both locally in parallel
    await Promise.all([
      CacheService.upsertRootMeta(rootMeta),
      CacheService.upsertMap(encryptedMap),
    ])

    return {
      rootMeta,
      map,
      mek,
      lookupHash,
    }
  }

  /**
   * Check if bootstrap is possible
   * Attempts to fetch root meta from remote storage to verify lookup hash is valid
   */
  static async canBootstrap(signal?: AbortSignal): Promise<boolean> {
    try {
      await RemoteService.getRootMeta(signal)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Create a new notebook
   * Creates notebook directory, meta, and manifest
   */
  static async createNotebook(
    notebookTitle: string,
    lookupHash: string,
    mek: CryptoKey,
    map: Map,
    signal?: AbortSignal,
  ): Promise<CreateNotebookResult> {
    // Step 1: Create empty manifest (generates notebook ID)
    const manifest = ManifestService.create(notebookTitle)
    const notebookId = manifest.notebook_id

    // Step 2: Generate FEK (File Encryption Key)
    const fek = await CryptoService.generateKey()

    // Step 3: Generate salt and derive FKEK (File Key Encryption Key) from lookup hash using Argon2id
    const salt = crypto.getRandomValues(new Uint8Array(__APP_CONFIG__.crypto.kdf.saltLength))
    const fkek = await CryptoService.deriveFKEK(lookupHash, {
      ...this.DEFAULT_ARGON2ID_PARAMS,
      salt,
    })

    // Step 4: Encrypt FEK with FKEK
    const encryptedFek = await CryptoService.encryptKey(fek, fkek)

    // Step 5: Create notebook meta with KDF parameters and encrypted FEK
    const notebookMeta = MetaService.createNotebookMeta(
      {
        ...this.DEFAULT_ARGON2ID_PARAMS,
        salt,
      },
      encryptedFek,
    )

    // Step 6: Encrypt manifest with FEK
    const manifestText = JSON.stringify(manifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const encryptedManifest = await CryptoService.encryptAndPack(manifestBytes, fek)

    // Step 7: Update map with new notebook entry
    const { map: updatedMap } = MapService.addEntry(map, { title: notebookTitle })

    // Step 8: Encrypt map with MEK
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Step 9: Upload all files to remote storage in parallel (fail if this fails)
    try {
      await Promise.all([
        RemoteService.upsertNotebookMeta(notebookId, notebookMeta, signal),
        RemoteService.upsertManifest(notebookId, encryptedManifest, signal),
        RemoteService.upsertMap(encryptedMap, signal),
      ])
    } catch (error) {
      throw new Error(
        `Failed to save notebook files to remote storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 10: Cache all files locally in parallel
    await Promise.all([
      CacheService.upsertNotebookMeta(notebookId, notebookMeta),
      CacheService.upsertManifest(notebookId, encryptedManifest),
      CacheService.upsertMap(encryptedMap),
    ])

    return {
      notebookId,
      notebookMeta,
      manifest,
      fek,
    }
  }

  /**
   * Load an existing notebook
   * Fetches meta and manifest, then syncs with remote
   */
  static async loadNotebook(
    notebookId: string,
    lookupHash: string,
    onProgress?: (progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<LoadNotebookResult> {
    // Step 1: Fetch notebook meta from remote storage (fail if this fails)
    let notebookMeta
    try {
      notebookMeta = await RemoteService.getNotebookMeta(notebookId, signal)
    } catch (error) {
      throw new Error(
        `Failed to fetch notebook meta: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 2: Derive FKEK using KDF params from notebook meta
    const fkek = await CryptoService.deriveFKEK(lookupHash, notebookMeta.kdf)

    // Step 3: Decrypt encrypted FEK to get FEK
    let fek
    try {
      fek = await CryptoService.decryptKey(notebookMeta.encrypted_fek, fkek)
    } catch (error) {
      throw new Error(
        `Failed to decrypt FEK (invalid lookup key?): ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 4: Cache notebook meta locally
    await CacheService.upsertNotebookMeta(notebookId, notebookMeta)

    // Step 5: Sync notebook with remote using SyncService
    const syncResult = await SyncService.sync({
      notebookId,
      fek,
      onProgress,
      signal,
    })

    // Step 6: Get manifest from cache (after sync)
    const encryptedManifest = await CacheService.getManifest(notebookId)
    if (!encryptedManifest) {
      throw new Error('Manifest not found in cache after sync')
    }

    // Step 7: Decrypt manifest with FEK
    let manifest
    try {
      const decryptedManifestBuffer = await CryptoService.unpackAndDecrypt(encryptedManifest, fek)
      const manifestText = new TextDecoder().decode(decryptedManifestBuffer)
      manifest = JSON.parse(manifestText) as Manifest
    } catch (error) {
      throw new Error(
        `Failed to decrypt manifest: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      notebookId,
      notebookMeta,
      manifest,
      fek,
      syncResult,
    }
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
    // Step 1: Update manifest and map titles
    const updatedManifest = ManifestService.updateNotebookTitle(manifest, newTitle)
    const updatedMap = MapService.updateEntry(map, notebookId, { title: newTitle })

    // Step 2: Encrypt both manifest and map in parallel
    const manifestText = JSON.stringify(updatedManifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)

    const [encryptedManifest, encryptedMap] = await Promise.all([
      CryptoService.encryptAndPack(manifestBytes, fek),
      CryptoService.encryptAndPack(mapBytes, mek),
    ])

    // Step 3: Upload both to remote storage in parallel (fail if this fails)
    try {
      await Promise.all([
        RemoteService.upsertManifest(notebookId, encryptedManifest, signal),
        RemoteService.upsertMap(encryptedMap, signal),
      ])
    } catch (error) {
      throw new Error(
        `Failed to save updated manifest and map to remote storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 4: Cache both locally in parallel
    await Promise.all([
      CacheService.upsertManifest(notebookId, encryptedManifest),
      CacheService.upsertMap(encryptedMap),
    ])

    return {
      manifest: updatedManifest,
      map: updatedMap,
    }
  }

  /**
   * Delete a notebook
   * Removes notebook from map and deletes all files from remote and cache
   */
  static async deleteNotebook(
    notebookId: string,
    mek: CryptoKey,
    manifest: Manifest,
    map: Map,
    signal?: AbortSignal,
  ): Promise<DeleteNotebookResult> {
    // Step 1: Remove notebook entry from map
    const updatedMap = MapService.removeEntry(map, notebookId)

    // Step 2: Encrypt updated map with MEK
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Step 3: Collect all blob UUIDs to delete
    const blobUuids = manifest.entries.map((entry) => entry.uuid)

    // Step 4: Delete all files from remote and cache in parallel
    try {
      await Promise.all([
        // Delete notebook meta
        RemoteService.deleteNotebookMeta(notebookId, signal),
        // Delete manifest
        RemoteService.deleteManifest(notebookId, signal),
        // Delete all blobs
        ...blobUuids.map((uuid) => RemoteService.deleteBlob(notebookId, uuid, signal)),
        // Upload updated map
        RemoteService.upsertMap(encryptedMap, signal),
        // Delete from cache
        CacheService.deleteNotebookMeta(notebookId),
        CacheService.deleteManifest(notebookId),
        ...blobUuids.map((uuid) => CacheService.deleteBlob(notebookId, uuid)),
        // Update map in cache
        CacheService.upsertMap(encryptedMap),
      ])
    } catch (error) {
      throw new Error(
        `Failed to delete notebook files: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      notebookId,
      map: updatedMap,
    }
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
    // Step 1: Try to get encrypted blob from cache first
    let encryptedBlob = await CacheService.getBlob(notebookId, uuid)

    // Step 2: If not in cache, fetch from remote storage
    if (!encryptedBlob) {
      try {
        encryptedBlob = await RemoteService.getBlob(notebookId, uuid, signal)
        // Cache it for future use
        await CacheService.upsertBlob(notebookId, uuid, encryptedBlob)
      } catch (error) {
        throw new Error(
          `Failed to fetch blob from remote storage: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Step 3: Decrypt blob with FEK
    let data
    try {
      data = await CryptoService.unpackAndDecrypt(encryptedBlob, fek)
    } catch (error) {
      throw new Error(
        `Failed to decrypt blob: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      uuid,
      data,
    }
  }

  /**
   * Create a new blob in a notebook
   * Encrypts and uploads to both cache and remote, updates manifest
   */
  static async createBlob(
    notebookId: string,
    data: ArrayBuffer | Uint8Array,
    metadata: BlobMetadata,
    fek: CryptoKey,
    manifest: Manifest,
    signal?: AbortSignal,
  ): Promise<CreateBlobResult> {
    // Step 1: Compute hash and size of data
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = `sha256-${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`
    const size = dataBuffer.byteLength

    // Step 2: Encrypt blob with FEK
    const encryptedBlob = await CryptoService.encryptAndPack(data, fek)

    // Step 3: Add new entry to manifest (generates UUID)
    const { manifest: updatedManifest, entry } = ManifestService.addEntry(manifest, {
      type: metadata.type,
      title: metadata.title,
      hash,
      size,
    })
    const uuid = entry.uuid

    // Step 4: Encrypt updated manifest
    const manifestText = JSON.stringify(updatedManifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const encryptedManifest = await CryptoService.encryptAndPack(manifestBytes, fek)

    // Step 5: Upload blob and manifest to remote and cache in parallel
    try {
      await Promise.all([
        RemoteService.upsertBlob(notebookId, uuid, encryptedBlob, signal),
        RemoteService.upsertManifest(notebookId, encryptedManifest, signal),
        CacheService.upsertBlob(notebookId, uuid, encryptedBlob),
        CacheService.upsertManifest(notebookId, encryptedManifest),
      ])
    } catch (error) {
      throw new Error(
        `Failed to save blob and manifest to storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      uuid,
      manifest: updatedManifest,
    }
  }

  /**
   * Update an existing blob in a notebook
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
    // Step 1: Verify blob exists in manifest
    const existingEntry = ManifestService.findEntry(manifest, uuid)
    if (!existingEntry) {
      throw new Error(`Blob with UUID ${uuid} not found in manifest`)
    }

    // Step 2: Compute hash and size of data
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = `sha256-${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`
    const size = dataBuffer.byteLength

    // Step 3: Encrypt blob with FEK
    const encryptedBlob = await CryptoService.encryptAndPack(data, fek)

    // Step 4: Update manifest entry
    const updatedManifest = ManifestService.updateEntry(manifest, uuid, {
      type: metadata.type,
      title: metadata.title,
      hash,
      size,
    })

    // Step 5: Encrypt updated manifest
    const manifestText = JSON.stringify(updatedManifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const encryptedManifest = await CryptoService.encryptAndPack(manifestBytes, fek)

    // Step 6: Upload blob and manifest to remote and cache in parallel
    try {
      await Promise.all([
        RemoteService.upsertBlob(notebookId, uuid, encryptedBlob, signal),
        RemoteService.upsertManifest(notebookId, encryptedManifest, signal),
        CacheService.upsertBlob(notebookId, uuid, encryptedBlob),
        CacheService.upsertManifest(notebookId, encryptedManifest),
      ])
    } catch (error) {
      throw new Error(
        `Failed to save updated blob and manifest to storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      uuid,
      manifest: updatedManifest,
    }
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
    // Step 1: Verify blob exists in manifest
    const existingEntry = ManifestService.findEntry(manifest, uuid)
    if (!existingEntry) {
      throw new Error(`Blob with UUID ${uuid} not found in manifest`)
    }

    // Step 2: Remove entry from manifest
    const updatedManifest = ManifestService.removeEntry(manifest, uuid)

    // Step 3: Encrypt updated manifest
    const manifestText = JSON.stringify(updatedManifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const encryptedManifest = await CryptoService.encryptAndPack(manifestBytes, fek)

    // Step 4: Delete blob and upload manifest to remote and cache in parallel
    try {
      await Promise.all([
        RemoteService.deleteBlob(notebookId, uuid, signal),
        RemoteService.upsertManifest(notebookId, encryptedManifest, signal),
        CacheService.deleteBlob(notebookId, uuid),
        CacheService.upsertManifest(notebookId, encryptedManifest),
      ])
    } catch (error) {
      throw new Error(
        `Failed to delete blob and update manifest in storage: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    return {
      uuid,
      manifest: updatedManifest,
    }
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
    // Use SyncService to sync the notebook
    return await SyncService.sync({
      notebookId,
      fek,
      onProgress,
      signal,
    })
  }

  /**
   * Sync all notebooks
   * Syncs all notebooks in the map
   */
  static async syncAllNotebooks(
    map: Map,
    lookupHash: string,
    onProgress?: (notebookId: string, progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<Record<string, SyncResult>> {
    const results: Record<string, SyncResult> = {}

    // Sync each notebook sequentially to avoid overwhelming the system
    for (const entry of map.entries) {
      const notebookId = entry.uuid

      try {
        // Step 1: Fetch notebook meta
        const notebookMeta = await RemoteService.getNotebookMeta(notebookId, signal)

        // Step 2: Derive FKEK from lookup hash
        const fkek = await CryptoService.deriveFKEK(lookupHash, notebookMeta.kdf)

        // Step 3: Decrypt FEK
        const fek = await CryptoService.decryptKey(notebookMeta.encrypted_fek, fkek)

        // Step 4: Sync notebook with progress callback
        const syncResult = await this.syncNotebook(
          notebookId,
          fek,
          onProgress ? (progress) => onProgress(notebookId, progress) : undefined,
          signal,
        )

        results[notebookId] = syncResult
      } catch (error) {
        // If a notebook fails, record the error but continue with other notebooks
        results[notebookId] = {
          success: false,
          downloaded: 0,
          uploaded: 0,
          conflicts: 0,
          errors: [
            `Failed to sync notebook ${entry.title}: ${error instanceof Error ? error.message : String(error)}`,
          ],
          duration: 0,
        }
      }
    }

    return results
  }
}
