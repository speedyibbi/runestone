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
   * Compute lookup hash from passphrase
   * Uses SHA256(passphrase)
   */
  static computeLookupHash(passphrase: string): string {
    const passphraseBytes = new TextEncoder().encode(passphrase)
    const hashBytes = sha256(passphraseBytes)
    return toBase64(hashBytes)
  }

  /**
   * Initialize new user account (first-time setup)
   * Creates root meta and map, saves to cache
   */
  static async initialize(lookupHash: string): Promise<InitializeResult> {
    // Step 1: Generate MEK (Map Encryption Key)
    const mek = await CryptoService.generateKey()

    // Step 2: Generate salt and derive MKEK (Map Key Encryption Key) from lookup hash
    const salt = crypto.getRandomValues(new Uint8Array(__APP_CONFIG__.crypto.kdf.saltLength))
    const mkek = await CryptoService.deriveMKEK(lookupHash, {
      ...this.DEFAULT_PBKDF2_PARAMS,
      salt,
    })

    // Step 3: Encrypt MEK with MKEK
    const encryptedMek = await CryptoService.encryptKey(mek, mkek)

    // Step 4: Create root meta with KDF parameters and encrypted MEK
    const rootMeta = MetaService.createRootMeta(
      {
        ...this.DEFAULT_PBKDF2_PARAMS,
        salt,
      },
      encryptedMek,
    )

    // Step 5: Create empty map
    const map = MapService.create()

    // Step 6: Encrypt map with MEK
    const mapText = JSON.stringify(map, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Step 7: Cache both locally in parallel
    await Promise.all([CacheService.upsertRootMeta(rootMeta), CacheService.upsertMap(encryptedMap)])

    return {
      rootMeta,
      map,
      mek,
    }
  }

  /**
   * Bootstrap existing user account from cache (returning user, same device)
   * Fetches and decrypts root meta and map from cache
   */
  static async bootstrapFromCache(lookupHash: string): Promise<BootstrapResult> {
    // Step 1: Fetch root meta and map from cache (fail if this fails)
    const rootMeta = await CacheService.getRootMeta()
    const encryptedMap = await CacheService.getMap()

    if (!rootMeta) {
      throw new Error('Root meta not found in cache')
    }

    if (!encryptedMap) {
      throw new Error('Map not found in cache')
    }

    // Step 2: Derive MKEK using KDF params from root meta
    const mkek = await CryptoService.deriveMKEK(lookupHash, rootMeta.kdf)

    // Step 3: Decrypt encrypted MEK to get MEK
    let mek
    try {
      mek = await CryptoService.decryptKey(rootMeta.encrypted_mek, mkek)
    } catch (error) {
      throw new Error(
        `Failed to decrypt MEK (invalid lookup key?): ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 4: Decrypt map with MEK
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

    return {
      rootMeta,
      map,
      mek,
    }
  }

  /**
   * Bootstrap existing user account from remote (returning user, new device)
   * Fetches and decrypts root meta and map from remote, then caches locally
   */
  static async bootstrapFromRemote(
    lookupHash: string,
    signal?: AbortSignal,
  ): Promise<BootstrapResult> {
    // Step 1: Fetch root meta and map from remote (fail if this fails)
    const [rootMeta, encryptedMap] = await Promise.all([
      RemoteService.getRootMeta(signal),
      RemoteService.getMap(signal),
    ])

    if (!rootMeta) {
      throw new Error('Root meta not found remotely')
    }

    if (!encryptedMap) {
      throw new Error('Map not found remotely')
    }

    // Step 2: Derive MKEK using KDF params from root meta
    const mkek = await CryptoService.deriveMKEK(lookupHash, rootMeta.kdf)

    // Step 3: Decrypt encrypted MEK to get MEK
    let mek
    try {
      mek = await CryptoService.decryptKey(rootMeta.encrypted_mek, mkek)
    } catch (error) {
      throw new Error(
        `Failed to decrypt MEK (invalid lookup key?): ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Step 4: Decrypt map with MEK
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

    // Step 5: Cache both locally for future use
    await Promise.all([CacheService.upsertRootMeta(rootMeta), CacheService.upsertMap(encryptedMap)])

    return {
      rootMeta,
      map,
      mek,
    }
  }

  /**
   * Check if user data exists in cache
   * Attempts to fetch root meta from cache to verify it exists
   */
  static async existsInCache(): Promise<boolean> {
    const [rootMeta, rootMap] = await Promise.all([
      CacheService.getRootMeta(),
      CacheService.getMap(),
    ])
    return rootMeta !== null && rootMap !== null
  }

  /**
   * Check if user data exists remotely
   * Attempts to fetch root meta from remote to verify account exists
   */
  static async existsRemotely(signal?: AbortSignal): Promise<boolean> {
    try {
      await RemoteService.getRootMeta(signal)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if bootstrap is possible remotely
   * Attempts to fetch root meta from remote to verify it exists
   */
  static async canBootstrapRemotely(): Promise<boolean> {
    try {
      await Promise.all([RemoteService.getRootMeta(), RemoteService.getMap()])
      return true
    } catch {
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

    // Step 9: Cache all files locally in parallel
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
      map: updatedMap,
    }
  }

  /**
   * Load an existing notebook from cache
   * Fetches meta and manifest from cache
   */
  static async loadNotebookFromCache(
    notebookId: string,
    lookupHash: string,
  ): Promise<LoadNotebookResult> {
    // Step 1: Fetch notebook meta from cache (fail if this fails)
    const notebookMeta = await CacheService.getNotebookMeta(notebookId)
    if (!notebookMeta) {
      throw new Error('Notebook meta not found in cache')
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

    // Step 4: Get manifest from cache
    const encryptedManifest = await CacheService.getManifest(notebookId)
    if (!encryptedManifest) {
      throw new Error('Manifest not found in cache')
    }

    // Step 5: Decrypt manifest with FEK
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
    }
  }

  /**
   * Load an existing notebook from remote
   * Fetches meta and manifest from remote, then caches locally
   */
  static async loadNotebookFromRemote(
    notebookId: string,
    lookupHash: string,
    signal?: AbortSignal,
  ): Promise<LoadNotebookResult> {
    // Step 1: Fetch notebook meta from remote (fail if this fails)
    const notebookMeta = await RemoteService.getNotebookMeta(notebookId, signal)

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

    // Step 4: Get manifest from remote
    const encryptedManifest = await RemoteService.getManifest(notebookId, signal)
    if (!encryptedManifest) {
      throw new Error('Manifest not found remotely')
    }

    // Step 5: Decrypt manifest with FEK
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

    // Step 6: Cache both locally for future use
    await Promise.all([
      CacheService.upsertNotebookMeta(notebookId, notebookMeta),
      CacheService.upsertManifest(notebookId, encryptedManifest),
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
   * Tries cache first, then remote if not found in cache
   */
  static async loadNotebook(
    notebookId: string,
    lookupHash: string,
    signal?: AbortSignal,
  ): Promise<LoadNotebookResult> {
    // Try to load from cache first
    try {
      return await this.loadNotebookFromCache(notebookId, lookupHash)
    } catch (cacheError) {
      // Cache failed, try remote (new device scenario)
      try {
        return await this.loadNotebookFromRemote(notebookId, lookupHash, signal)
      } catch (remoteError) {
        // Both failed - throw an informative error
        throw new Error(
          `Failed to load notebook from cache or remote. Cache error: ${cacheError instanceof Error ? cacheError.message : String(cacheError)}. Remote error: ${remoteError instanceof Error ? remoteError.message : String(remoteError)}`,
        )
      }
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

    // Step 3: Cache both locally in parallel
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
   * Removes notebook from map and deletes all files from cache
   */
  static async deleteNotebook(
    notebookId: string,
    mek: CryptoKey,
    manifest: Manifest,
    map: Map,
  ): Promise<DeleteNotebookResult> {
    // Step 1: Remove notebook entry from map
    const updatedMap = MapService.removeEntry(map, notebookId)

    // Step 2: Encrypt updated map with MEK
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Step 3: Collect all blob UUIDs to delete
    const blobUuids = manifest.entries.map((entry) => entry.uuid)

    // Step 4: Delete all files from cache and update map in parallel
    await Promise.all([
      // Delete from cache
      CacheService.deleteNotebookMeta(notebookId),
      CacheService.deleteManifest(notebookId),
      ...blobUuids.map((uuid) => CacheService.deleteBlob(notebookId, uuid)),
      // Update map in cache
      CacheService.upsertMap(encryptedMap),
    ])

    return {
      notebookId,
      map: updatedMap,
    }
  }

  /**
   * Get a blob from a notebook
   * Retrieves and decrypts the blob from cache
   */
  static async getBlob(notebookId: string, uuid: string, fek: CryptoKey): Promise<GetBlobResult> {
    // Step 1: Get encrypted blob from cache
    const encryptedBlob = await CacheService.getBlob(notebookId, uuid)

    if (!encryptedBlob) {
      throw new Error(`Blob with UUID ${uuid} not found in cache`)
    }

    // Step 2: Decrypt blob with FEK
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
   * Encrypts and saves to cache, updates manifest
   */
  static async createBlob(
    notebookId: string,
    data: ArrayBuffer | Uint8Array,
    metadata: BlobMetadata,
    fek: CryptoKey,
    manifest: Manifest,
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

    // Step 5: Save blob and manifest to cache in parallel
    await Promise.all([
      CacheService.upsertBlob(notebookId, uuid, encryptedBlob),
      CacheService.upsertManifest(notebookId, encryptedManifest),
    ])

    return {
      uuid,
      manifest: updatedManifest,
    }
  }

  /**
   * Update an existing blob in a notebook
   * Encrypts and saves to cache, updates manifest
   */
  static async updateBlob(
    notebookId: string,
    uuid: string,
    data: ArrayBuffer | Uint8Array,
    metadata: BlobMetadata,
    fek: CryptoKey,
    manifest: Manifest,
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

    // Step 6: Save blob and manifest to cache in parallel
    await Promise.all([
      CacheService.upsertBlob(notebookId, uuid, encryptedBlob),
      CacheService.upsertManifest(notebookId, encryptedManifest),
    ])

    return {
      uuid,
      manifest: updatedManifest,
    }
  }

  /**
   * Delete a blob from a notebook
   * Removes from cache, updates manifest
   */
  static async deleteBlob(
    notebookId: string,
    uuid: string,
    fek: CryptoKey,
    manifest: Manifest,
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

    // Step 4: Delete blob and save manifest to cache in parallel
    await Promise.all([
      CacheService.deleteBlob(notebookId, uuid),
      CacheService.upsertManifest(notebookId, encryptedManifest),
    ])

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
        // Step 1: Fetch notebook meta from cache
        const notebookMeta = await CacheService.getNotebookMeta(notebookId)
        if (!notebookMeta) {
          throw new Error(`Notebook meta not found in cache for notebook ${notebookId}`)
        }

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

  /**
   * Sync root-level data (root meta and map)
   * Should be called before syncing notebooks to ensure map is up-to-date
   */
  static async syncRoot(
    mek: CryptoKey,
    onProgress?: (progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<SyncResult> {
    // Use SyncService to sync root-level data
    return await SyncService.syncRoot({
      mek,
      onProgress,
      signal,
    })
  }
}
