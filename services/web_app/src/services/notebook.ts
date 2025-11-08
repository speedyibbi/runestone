import CryptoService from '@/services/crypto'
import RemoteService from '@/services/remote'
import CacheService from '@/services/cache'
import ManifestService from '@/services/manifest'
import { toBase64, fromBase64, arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/helpers'

/**
 * meta.json structure
 */
export interface MetaJson {
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
 * KDF parameters for notebook initialization
 */
export interface KDFParams {
  iterations?: number
  memory?: number
  parallelism?: number
}

/**
 * Notebook initialization result
 */
export interface NotebookInitResult {
  notebookId: string
  fek: CryptoKey
  meta: MetaJson
}

/**
 * Notebook load result
 */
export interface NotebookLoadResult {
  notebookId: string
  fek: CryptoKey
  meta: MetaJson
}

/**
 * Notebook rekey result
 */
export interface NotebookRekeyResult {
  notebookId: string
  meta: MetaJson
}

/**
 * NotebookService handles notebook initialization and loading
 * Orchestrates crypto bootstrap and initial setup
 */
export default class NotebookService {
  private static readonly META_VERSION = __APP_CONFIG__.notebook.meta.version
  private static readonly DEFAULT_KDF_ITERATIONS = __APP_CONFIG__.crypto.kdf.defaultIterations
  private static readonly DEFAULT_KDF_MEMORY = __APP_CONFIG__.crypto.kdf.defaultMemory
  private static readonly DEFAULT_KDF_PARALLELISM = __APP_CONFIG__.crypto.kdf.defaultParallelism
  private static readonly TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength

  /**
   * Initialize a new notebook
   */
  static async initializeNotebook(
    email: string,
    passphrase: string,
    kdfParams?: KDFParams,
    signal?: AbortSignal,
  ): Promise<NotebookInitResult> {
    const notebookId = crypto.randomUUID()

    // Generate FEK
    const fek = await CryptoService.generateFEK()

    // Generate salt for KDF
    const salt = CryptoService.generateSalt()

    // KDF parameters
    const iterations = kdfParams?.iterations ?? this.DEFAULT_KDF_ITERATIONS
    const memory = kdfParams?.memory ?? this.DEFAULT_KDF_MEMORY
    const parallelism = kdfParams?.parallelism ?? this.DEFAULT_KDF_PARALLELISM

    // Derive KEK from passphrase
    const kek = await CryptoService.deriveKEK(passphrase, salt, {
      iterations,
      memory,
      parallelism,
    })

    // Encrypt FEK with KEK
    const encryptedFEK = await CryptoService.encryptFEK(fek, kek)

    // Create meta.json
    const meta: MetaJson = {
      version: this.META_VERSION,
      user_id: email,
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

    // Upload meta.json to remote
    await RemoteService.putMeta(notebookId, meta, signal)

    // Cache meta.json locally
    await CacheService.saveMeta(notebookId, meta)

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

    return {
      notebookId,
      fek,
      meta,
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
    // Try to get meta.json from cache first
    let meta = await CacheService.getMeta(notebookId)

    // If not in cache, fetch from remote
    if (!meta) {
      meta = await RemoteService.getMeta(notebookId, signal)
      
      // Cache it for future use
      await CacheService.saveMeta(notebookId, meta)
    }

    if (!meta) {
      throw new Error('Failed to load notebook')
    }

    // Decode KDF parameters
    const salt = fromBase64(meta.kdf.salt)
    const kdfParams = {
      iterations: meta.kdf.iterations,
      memory: meta.kdf.memory,
      parallelism: meta.kdf.parallelism,
    }

    // Derive KEK from passphrase
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
   * Re-key an existing notebook with a new passphrase
   * This changes the passphrase used to encrypt the FEK without re-encrypting
   * all the notebook data. Only the meta.json is updated with new KDF params
   * and a new encrypted FEK.
   */
  static async rekeyNotebook(
    notebookId: string,
    fek: CryptoKey,
    newPassphrase: string,
    kdfParams?: KDFParams,
    signal?: AbortSignal,
  ): Promise<NotebookRekeyResult> {
    // Get current meta.json to preserve user_id
    const currentMeta = await CacheService.getMeta(notebookId)
    
    if (!currentMeta) {
      throw new Error('Cannot rekey: notebook meta.json not found in cache')
    }

    // Generate NEW salt for new passphrase (critical for security)
    const newSalt = CryptoService.generateSalt()

    // KDF parameters (use provided or defaults)
    const iterations = kdfParams?.iterations ?? this.DEFAULT_KDF_ITERATIONS
    const memory = kdfParams?.memory ?? this.DEFAULT_KDF_MEMORY
    const parallelism = kdfParams?.parallelism ?? this.DEFAULT_KDF_PARALLELISM

    // Derive NEW KEK from new passphrase
    const newKek = await CryptoService.deriveKEK(newPassphrase, newSalt, {
      iterations,
      memory,
      parallelism,
    })

    // Re-encrypt the SAME FEK with the NEW KEK
    const encryptedFEK = await CryptoService.encryptFEK(fek, newKek)

    // Create updated meta.json
    const newMeta: MetaJson = {
      version: this.META_VERSION,
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
    await RemoteService.putMeta(notebookId, newMeta, signal)

    // Update cache
    await CacheService.saveMeta(notebookId, newMeta)

    return {
      notebookId,
      meta: newMeta,
    }
  }
}
