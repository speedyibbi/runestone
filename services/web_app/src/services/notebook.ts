import CryptoService from '@/services/cryptography/crypto'
import RemoteService from '@/services/l2-storage/remote'
import CacheService from '@/services/l2-storage/cache'
import ManifestService from '@/services/manifest'
import MapService, { type Map } from '@/services/map'
import { toBase64, fromBase64, arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/helpers'

/**
 * Root meta.json structure (PBKDF2-based for MEK encryption)
 */
export interface RootMetaJson {
  version: number
  kdf: {
    algorithm: 'pbkdf2-sha256'
    salt: string // base64 encoded
    iterations: number
  }
  encrypted_mek: {
    ciphertext: string // base64 encoded
    nonce: string // base64 encoded
    tag: string // base64 encoded
  }
  encryption: {
    cipher: 'aes-256-gcm'
    tag_length: number
  }
}

/**
 * Notebook meta.json structure (Argon2id-based for FEK encryption)
 */
export interface NotebookMetaJson {
  version: number
  user_id: string
  kdf: {
    algorithm: 'argon2id'
    salt: string // base64 encoded
    iterations: number
    memory: number
    parallelism: number
  }
  encrypted_fek: {
    ciphertext: string // base64 encoded
    nonce: string // base64 encoded
    tag: string // base64 encoded
  }
  encryption: {
    cipher: 'aes-256-gcm'
    tag_length: number
  }
}

/**
 * KDF parameters for Argon2id (notebook KEK derivation)
 */
export interface Argon2idKDFParams {
  iterations?: number
  memory?: number
  parallelism?: number
}

/**
 * KDF parameters for PBKDF2 (root MEK derivation)
 */
export interface PBKDF2KDFParams {
  iterations?: number
}

/**
 * Root initialization result
 */
export interface RootInitResult {
  mek: CryptoKey
  rootMeta: RootMetaJson
  map: Map
}

/**
 * Bootstrap result (loading root and map)
 */
export interface BootstrapResult {
  mek: CryptoKey
  rootMeta: RootMetaJson
  map: Map
}

/**
 * Notebook initialization result
 */
export interface NotebookInitResult {
  notebookId: string
  fek: CryptoKey
  meta: NotebookMetaJson
  map: Map // Updated map with new notebook
}

/**
 * Notebook load result
 */
export interface NotebookLoadResult {
  notebookId: string
  fek: CryptoKey
  meta: NotebookMetaJson
}

/**
 * Notebook rekey result
 */
export interface NotebookRekeyResult {
  notebookId: string
  meta: NotebookMetaJson
}

/**
 * NotebookService handles notebook initialization and loading
 * Orchestrates crypto bootstrap and initial setup
 * Supports multi-notebook architecture with root-level MEK and notebook-level FEK
 */
export default class NotebookService {
  private static readonly ROOT_META_VERSION = __APP_CONFIG__.root.meta.version
  private static readonly NOTEBOOK_META_VERSION = __APP_CONFIG__.notebook.meta.version
  private static readonly PBKDF2_ITERATIONS = __APP_CONFIG__.crypto.kdf.pbkdf2Iterations
  private static readonly DEFAULT_KDF_ITERATIONS = __APP_CONFIG__.crypto.kdf.defaultIterations
  private static readonly DEFAULT_KDF_MEMORY = __APP_CONFIG__.crypto.kdf.defaultMemory
  private static readonly DEFAULT_KDF_PARALLELISM = __APP_CONFIG__.crypto.kdf.defaultParallelism
  private static readonly TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength

  /**
   * Initialize root-level storage (first-time setup)
   * Creates root meta.json with encrypted MEK and empty map.json.enc
   */
  static async initializeRoot(
    passphrase: string,
    pbkdf2Params?: PBKDF2KDFParams,
    signal?: AbortSignal,
  ): Promise<RootInitResult> {
    // Generate MEK
    const mek = await CryptoService.generateMEK()

    // Generate salt for PBKDF2
    const salt = CryptoService.generateSalt()

    // PBKDF2 parameters
    const iterations = pbkdf2Params?.iterations ?? this.PBKDF2_ITERATIONS

    // Derive key
    const derivedKey = await CryptoService.derivePBKDF2Key(passphrase, salt, {
      iterations,
    })

    // Encrypt MEK with derived key
    const encryptedMEK = await CryptoService.encryptMEK(mek, derivedKey)

    // Create root meta.json
    const rootMeta: RootMetaJson = {
      version: this.ROOT_META_VERSION,
      kdf: {
        algorithm: 'pbkdf2-sha256',
        salt: toBase64(salt),
        iterations,
      },
      encrypted_mek: {
        ciphertext: arrayBufferToBase64(encryptedMEK.ciphertext),
        nonce: toBase64(encryptedMEK.nonce),
        tag: toBase64(encryptedMEK.tag),
      },
      encryption: {
        cipher: 'aes-256-gcm',
        tag_length: this.TAG_LENGTH / 8, // Convert bits to bytes
      },
    }

    // Upload root meta.json to remote
    await RemoteService.putRootMeta(rootMeta, signal)

    // Cache root meta.json locally
    await CacheService.saveRootMeta(rootMeta)

    // Create empty map
    const map = MapService.createMap()

    // Encrypt map
    const mapText = JSON.stringify(map, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Upload encrypted map to remote
    await RemoteService.putMap(encryptedMap, signal)

    // Cache encrypted map locally
    await CacheService.saveMap(encryptedMap)

    return {
      mek,
      rootMeta,
      map,
    }
  }

  /**
   * Bootstrap: Load root meta, derive MEK, and decrypt map
   * This is the entry point for accessing the multi-notebook system
   */
  static async bootstrap(passphrase: string, signal?: AbortSignal): Promise<BootstrapResult> {
    // Try to get root meta from cache first
    let rootMeta = await CacheService.getRootMeta()

    // If not in cache, fetch from remote
    if (!rootMeta) {
      rootMeta = await RemoteService.getRootMeta(signal)

      // Cache it for future use
      await CacheService.saveRootMeta(rootMeta)
    }

    if (!rootMeta) {
      throw new Error('Root meta not found. Please initialize root storage first.')
    }

    // Decode PBKDF2 parameters
    const salt = fromBase64(rootMeta.kdf.salt)
    const pbkdf2Params = {
      iterations: rootMeta.kdf.iterations,
    }

    // Derive key
    const derivedKey = await CryptoService.derivePBKDF2Key(passphrase, salt, pbkdf2Params)

    // Decode encrypted MEK
    const encryptedMEK = {
      ciphertext: base64ToArrayBuffer(rootMeta.encrypted_mek.ciphertext),
      nonce: fromBase64(rootMeta.encrypted_mek.nonce),
      tag: fromBase64(rootMeta.encrypted_mek.tag),
    }

    // Decrypt MEK
    const mek = await CryptoService.decryptMEK(encryptedMEK, derivedKey)

    // Try to get map from cache first
    let encryptedMapData = await CacheService.getMap()

    // If not in cache, fetch from remote
    if (!encryptedMapData) {
      encryptedMapData = await RemoteService.getMap(signal)

      // Cache it for future use
      await CacheService.saveMap(encryptedMapData)
    }

    if (!encryptedMapData) {
      throw new Error('Map not found')
    }

    // Decrypt map
    const mapDecrypted = await CryptoService.unpackAndDecrypt(encryptedMapData, mek)
    const mapText = new TextDecoder().decode(mapDecrypted)
    const map = JSON.parse(mapText) as Map

    return {
      mek,
      rootMeta,
      map,
    }
  }

  /**
   * Initialize a new notebook and add it to the map
   * Requires MEK and current map (from bootstrap)
   */
  static async initializeNotebook(
    mek: CryptoKey,
    currentMap: Map,
    title: string,
    passphrase: string,
    userId: string,
    kdfParams?: Argon2idKDFParams,
    signal?: AbortSignal,
  ): Promise<NotebookInitResult> {
    const notebookId = crypto.randomUUID()

    // Generate FEK
    const fek = await CryptoService.generateFEK()

    // Generate salt for Argon2id KDF
    const salt = CryptoService.generateSalt()

    // KDF parameters
    const iterations = kdfParams?.iterations ?? this.DEFAULT_KDF_ITERATIONS
    const memory = kdfParams?.memory ?? this.DEFAULT_KDF_MEMORY
    const parallelism = kdfParams?.parallelism ?? this.DEFAULT_KDF_PARALLELISM

    // Derive KEK from lookup_key using Argon2id
    const kek = await CryptoService.deriveKEK(passphrase, salt, {
      iterations,
      memory,
      parallelism,
    })

    // Encrypt FEK with KEK
    const encryptedFEK = await CryptoService.encryptFEK(fek, kek)

    // Create notebook meta.json
    const meta: NotebookMetaJson = {
      version: this.NOTEBOOK_META_VERSION,
      user_id: userId,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64(salt),
        iterations,
        memory,
        parallelism,
      },
      encrypted_fek: {
        ciphertext: arrayBufferToBase64(encryptedFEK.ciphertext),
        nonce: toBase64(encryptedFEK.nonce),
        tag: toBase64(encryptedFEK.tag),
      },
      encryption: {
        cipher: 'aes-256-gcm',
        tag_length: this.TAG_LENGTH / 8, // Convert bits to bytes
      },
    }

    // Upload notebook meta.json to remote
    await RemoteService.putNotebookMeta(notebookId, meta, signal)

    // Cache notebook meta.json locally
    await CacheService.saveNotebookMeta(notebookId, meta)

    // Create empty manifest
    const manifest = ManifestService.createManifest(notebookId)

    // Encrypt manifest
    const manifestText = JSON.stringify(manifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const encryptedManifest = await CryptoService.encryptAndPack(manifestBytes, fek)

    // Upload encrypted manifest to remote
    await RemoteService.putManifest(notebookId, encryptedManifest, signal)

    // Cache encrypted manifest locally
    await CacheService.saveManifest(notebookId, encryptedManifest)

    // Add notebook to map with our notebookId
    const updatedMap: Map = {
      ...currentMap,
      last_updated: new Date().toISOString(),
      entries: [
        ...currentMap.entries,
        {
          uuid: notebookId,
          title,
        },
      ],
    }

    // Encrypt updated map
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Upload encrypted map to remote
    await RemoteService.putMap(encryptedMap, signal)

    // Cache encrypted map locally
    await CacheService.saveMap(encryptedMap)

    return {
      notebookId,
      fek,
      meta,
      map: updatedMap,
    }
  }

  /**
   * Load an existing notebook
   */
  static async loadNotebook(
    notebookId: string,
    passphrase: string,
    signal?: AbortSignal,
  ): Promise<NotebookLoadResult> {
    // Try to get notebook meta.json from cache first
    let meta = await CacheService.getNotebookMeta(notebookId)

    // If not in cache, fetch from remote
    if (!meta) {
      meta = await RemoteService.getNotebookMeta(notebookId, signal)

      // Cache it for future use
      await CacheService.saveNotebookMeta(notebookId, meta)
    }

    if (!meta) {
      throw new Error('Failed to load notebook')
    }

    // Decode Argon2id KDF parameters
    const salt = fromBase64(meta.kdf.salt)
    const kdfParams = {
      iterations: meta.kdf.iterations,
      memory: meta.kdf.memory,
      parallelism: meta.kdf.parallelism,
    }

    // Derive KEK from passphrase using Argon2id
    const kek = await CryptoService.deriveKEK(passphrase, salt, kdfParams)

    // Decode encrypted FEK
    const encryptedFEK = {
      ciphertext: base64ToArrayBuffer(meta.encrypted_fek.ciphertext),
      nonce: fromBase64(meta.encrypted_fek.nonce),
      tag: fromBase64(meta.encrypted_fek.tag),
    }

    // Decrypt FEK
    const fek = await CryptoService.decryptFEK(encryptedFEK, kek)

    return {
      notebookId,
      fek,
      meta,
    }
  }

  /**
   * Get all notebooks from a map
   * Returns notebook UUIDs and titles
   */
  static getNotebooksFromMap(map: Map): Array<{ uuid: string; title: string }> {
    return map.entries.map((entry) => ({
      uuid: entry.uuid,
      title: entry.title,
    }))
  }

  /**
   * Update notebook title in map
   * Returns updated map
   */
  static async updateNotebookTitle(
    mek: CryptoKey,
    currentMap: Map,
    notebookId: string,
    newTitle: string,
    signal?: AbortSignal,
  ): Promise<Map> {
    // Update map with new title
    const updatedMap = MapService.updateEntry(currentMap, notebookId, newTitle)

    // Encrypt updated map
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Upload encrypted map to remote
    await RemoteService.putMap(encryptedMap, signal)

    // Cache encrypted map locally
    await CacheService.saveMap(encryptedMap)

    return updatedMap
  }

  /**
   * Delete notebook from map
   * Returns updated map
   * Note: This only removes from map, not the actual notebook data
   */
  static async deleteNotebookFromMap(
    mek: CryptoKey,
    currentMap: Map,
    notebookId: string,
    signal?: AbortSignal,
  ): Promise<Map> {
    // Remove notebook from map
    const updatedMap = MapService.removeEntry(currentMap, notebookId)

    // Encrypt updated map
    const mapText = JSON.stringify(updatedMap, null, 2)
    const mapBytes = new TextEncoder().encode(mapText)
    const encryptedMap = await CryptoService.encryptAndPack(mapBytes, mek)

    // Upload encrypted map to remote
    await RemoteService.putMap(encryptedMap, signal)

    // Cache encrypted map locally
    await CacheService.saveMap(encryptedMap)

    return updatedMap
  }

  /**
   * Re-key an existing notebook with a new passphrase
   * This changes the passphrase used to encrypt the FEK without re-encrypting
   * all the notebook data. Only the meta.json is updated with new KDF params
   * and a new encrypted FEK.
   */
  static async rekeyNotebook(
    notebookId: string,
    fek: CryptoKey,
    newPassphrase: string,
    kdfParams?: Argon2idKDFParams,
    signal?: AbortSignal,
  ): Promise<NotebookRekeyResult> {
    // Get current meta.json to preserve user_id
    const currentMeta = await CacheService.getNotebookMeta(notebookId)

    if (!currentMeta) {
      throw new Error('Cannot rekey: notebook meta.json not found in cache')
    }

    // Generate NEW salt for new passphrase (critical for security)
    const newSalt = CryptoService.generateSalt()

    // KDF parameters (use provided or defaults)
    const iterations = kdfParams?.iterations ?? this.DEFAULT_KDF_ITERATIONS
    const memory = kdfParams?.memory ?? this.DEFAULT_KDF_MEMORY
    const parallelism = kdfParams?.parallelism ?? this.DEFAULT_KDF_PARALLELISM

    // Derive NEW KEK from new passphrase using Argon2id
    const newKek = await CryptoService.deriveKEK(newPassphrase, newSalt, {
      iterations,
      memory,
      parallelism,
    })

    // Re-encrypt the SAME FEK with the NEW KEK
    const encryptedFEK = await CryptoService.encryptFEK(fek, newKek)

    // Create updated meta.json
    const newMeta: NotebookMetaJson = {
      version: this.NOTEBOOK_META_VERSION,
      user_id: currentMeta.user_id,
      kdf: {
        algorithm: 'argon2id',
        salt: toBase64(newSalt),
        iterations,
        memory,
        parallelism,
      },
      encrypted_fek: {
        ciphertext: arrayBufferToBase64(encryptedFEK.ciphertext),
        nonce: toBase64(encryptedFEK.nonce),
        tag: toBase64(encryptedFEK.tag),
      },
      encryption: {
        cipher: 'aes-256-gcm',
        tag_length: this.TAG_LENGTH / 8,
      },
    }

    // Upload new meta.json to remote
    await RemoteService.putNotebookMeta(notebookId, newMeta, signal)

    // Update cache
    await CacheService.saveNotebookMeta(notebookId, newMeta)

    return {
      notebookId,
      meta: newMeta,
    }
  }
}
