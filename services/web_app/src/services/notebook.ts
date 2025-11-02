import FileService from '@/services/file'
import CryptoService, { type KDFParams, type EncryptedData } from '@/services/crypto'

/**
 * meta.json structure (unencrypted)
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
 * Manifest entry for a blob
 */
export interface ManifestEntry {
  uuid: string
  type: 'note' | 'image'
  title: string
  version: number
  last_modified: string // ISO 8601 timestamp
  hash: string // sha256-<hash>
  size: number // bytes
}

/**
 * Manifest structure (decrypted form)
 */
export interface Manifest {
  manifest_version: number
  last_updated: string // ISO 8601 timestamp
  notebook_id: string
  entries: ManifestEntry[]
}

/**
 * Notebook initialization parameters
 */
export interface NotebookInitParams {
  email: string
  passphrase: string
  kdfParams?: {
    iterations?: number
    memory?: number
    parallelism?: number
  }
}

/**
 * NotebookService handles notebook operations using FileService and CryptoService
 * All encryption/decryption happens on the client side
 */
export default class NotebookService {
  private static readonly META_VERSION = __APP_CONFIG__.notebook.meta.version
  private static readonly MANIFEST_VERSION = __APP_CONFIG__.notebook.manifest.version
  private static readonly DEFAULT_KDF_ITERATIONS = __APP_CONFIG__.crypto.kdf.defaultIterations
  private static readonly DEFAULT_KDF_MEMORY = __APP_CONFIG__.crypto.kdf.defaultMemory
  private static readonly DEFAULT_KDF_PARALLELISM = __APP_CONFIG__.crypto.kdf.defaultParallelism
  private static readonly IV_LENGTH = __APP_CONFIG__.crypto.aes.ivLength
  private static readonly TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength

  /**
   * Generate a UUID v4
   */
  private static generateUUID(): string {
    return crypto.randomUUID()
  }

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
   * Read meta.json
   */
  static async getMetaJson(notebookId: string): Promise<MetaJson> {
    const path = this.getNotebookPath(notebookId, 'meta.json')
    const response = await FileService.getFile(path)
    return await response.json()
  }

  /**
   * Write meta.json
   */
  static async putMetaJson(notebookId: string, meta: MetaJson): Promise<void> {
    const path = this.getNotebookPath(notebookId, 'meta.json')
    const metaBlob = new Blob([JSON.stringify(meta, null, 2)], {
      type: 'application/json',
    })
    await FileService.upsertFile(path, metaBlob as File)
  }

  /**
   * Read and decrypt manifest.json.enc
   */
  static async getManifest(
    notebookId: string,
    fek: CryptoKey,
  ): Promise<Manifest> {
    const path = this.getNotebookPath(notebookId, 'manifest.json.enc')
    const response = await FileService.getFile(path)
    const encryptedData = await response.arrayBuffer()

    // Extract nonce, ciphertext, and tag
    // Format: nonce + ciphertext + tag
    const nonceLength = this.IV_LENGTH
    const tagLength = this.TAG_LENGTH / 8 // Convert bits to bytes
    const tagStart = encryptedData.byteLength - tagLength

    const nonce = new Uint8Array(encryptedData.slice(0, nonceLength))
    const ciphertext = encryptedData.slice(nonceLength, tagStart)
    const tag = new Uint8Array(encryptedData.slice(tagStart))

    const encrypted: EncryptedData = {
      ciphertext,
      nonce,
      tag,
    }

    const decrypted = await CryptoService.decryptBlob(encrypted, fek)
    const manifestText = new TextDecoder().decode(decrypted)
    return JSON.parse(manifestText) as Manifest
  }

  /**
   * Encrypt and write manifest.json.enc
   */
  static async putManifest(
    notebookId: string,
    manifest: Manifest,
    fek: CryptoKey,
  ): Promise<void> {
    const manifestText = JSON.stringify(manifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)

    const encrypted = await CryptoService.encryptBlob(manifestBytes, fek)

    // Combine nonce + ciphertext + tag for storage
    const combined = new Uint8Array(
      encrypted.nonce.byteLength +
        encrypted.ciphertext.byteLength +
        encrypted.tag.byteLength,
    )
    combined.set(new Uint8Array(encrypted.nonce), 0)
    combined.set(
      new Uint8Array(encrypted.ciphertext),
      encrypted.nonce.byteLength,
    )
    combined.set(
      encrypted.tag,
      encrypted.nonce.byteLength + encrypted.ciphertext.byteLength,
    )

    const path = this.getNotebookPath(notebookId, 'manifest.json.enc')
    const blob = new Blob([combined], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File)
  }

  /**
   * Upload an encrypted blob
   */
  static async uploadBlob(
    notebookId: string,
    uuid: string,
    data: ArrayBuffer | Uint8Array,
    fek: CryptoKey,
  ): Promise<void> {
    const encrypted = await CryptoService.encryptBlob(data, fek)

    // Combine nonce + ciphertext + tag for storage
    const combined = new Uint8Array(
      encrypted.nonce.byteLength +
        encrypted.ciphertext.byteLength +
        encrypted.tag.byteLength,
    )
    combined.set(new Uint8Array(encrypted.nonce), 0)
    combined.set(
      new Uint8Array(encrypted.ciphertext),
      encrypted.nonce.byteLength,
    )
    combined.set(
      encrypted.tag,
      encrypted.nonce.byteLength + encrypted.ciphertext.byteLength,
    )

    const path = this.getBlobPath(notebookId, uuid)
    const blob = new Blob([combined], { type: 'application/octet-stream' })
    await FileService.upsertFile(path, blob as File)
  }

  /**
   * Download and decrypt a blob
   */
  static async downloadBlob(
    notebookId: string,
    uuid: string,
    fek: CryptoKey,
  ): Promise<ArrayBuffer> {
    const path = this.getBlobPath(notebookId, uuid)
    const response = await FileService.getFile(path)
    const encryptedData = await response.arrayBuffer()

    // Extract nonce, ciphertext, and tag
    // Format: nonce + ciphertext + tag
    const nonceLength = this.IV_LENGTH
    const tagLength = this.TAG_LENGTH / 8 // Convert bits to bytes
    const tagStart = encryptedData.byteLength - tagLength

    const nonce = new Uint8Array(encryptedData.slice(0, nonceLength))
    const ciphertext = encryptedData.slice(nonceLength, tagStart)
    const tag = new Uint8Array(encryptedData.slice(tagStart))

    const encrypted: EncryptedData = {
      ciphertext,
      nonce,
      tag,
    }

    return await CryptoService.decryptBlob(encrypted, fek)
  }

  /**
   * Delete a blob
   */
  static async deleteBlob(notebookId: string, uuid: string): Promise<void> {
    const path = this.getBlobPath(notebookId, uuid)
    await FileService.deleteFile(path)
  }

  /**
   * Initialize a new notebook
   * Creates meta.json with encrypted FEK and empty manifest
   */
  static async initializeNotebook(
    params: NotebookInitParams,
  ): Promise<{
    notebookId: string
    fek: CryptoKey
    meta: MetaJson
  }> {
    const notebookId = this.generateUUID()
    const fek = await CryptoService.generateFEK()

    // Generate salt for KDF
    const salt = CryptoService.generateSalt()

    // KDF parameters
    const kdfParams = {
      iterations: params.kdfParams?.iterations ?? this.DEFAULT_KDF_ITERATIONS,
      memory: params.kdfParams?.memory ?? this.DEFAULT_KDF_MEMORY,
      parallelism: params.kdfParams?.parallelism ?? this.DEFAULT_KDF_PARALLELISM,
    }

    // Derive KEK from passphrase
    const kek = await CryptoService.deriveKEK(
      params.passphrase,
      salt,
      kdfParams,
    )

    // Encrypt FEK with KEK
    const encryptedFEK = await CryptoService.encryptFEK(fek, kek)

    // Create meta.json
    const meta: MetaJson = {
      version: this.META_VERSION,
      user_id: params.email,
      kdf: {
        algorithm: 'argon2id',
        salt: CryptoService.toBase64(salt),
        iterations: kdfParams.iterations,
        memory: kdfParams.memory,
        parallelism: kdfParams.parallelism,
      },
      encrypted_fek: {
        ciphertext: CryptoService.arrayBufferToBase64(encryptedFEK.ciphertext),
        nonce: CryptoService.toBase64(encryptedFEK.nonce),
        tag: CryptoService.toBase64(encryptedFEK.tag),
      },
      encryption: {
        cipher: 'aes-256-gcm',
        tag_length: this.TAG_LENGTH / 8, // Convert bits to bytes
      },
    }

    // Upload meta.json
    await this.putMetaJson(notebookId, meta)

    // Create empty manifest
    const manifest: Manifest = {
      manifest_version: this.MANIFEST_VERSION,
      last_updated: new Date().toISOString(),
      notebook_id: notebookId,
      entries: [],
    }

    // Upload encrypted manifest
    await this.putManifest(notebookId, manifest, fek)

    return {
      notebookId,
      fek,
      meta,
    }
  }

  /**
   * Load an existing notebook
   * Fetches meta.json, derives KEK, decrypts FEK
   */
  static async loadNotebook(
    notebookId: string,
    passphrase: string,
  ): Promise<{
    notebookId: string
    fek: CryptoKey
    meta: MetaJson
  }> {
    // Fetch meta.json
    const meta = await this.getMetaJson(notebookId)

    // Decode KDF parameters
    const salt = CryptoService.fromBase64(meta.kdf.salt)
    const kdfParams: Omit<KDFParams, 'algorithm' | 'salt'> = {
      iterations: meta.kdf.iterations,
      memory: meta.kdf.memory,
      parallelism: meta.kdf.parallelism,
    }

    // Derive KEK from passphrase
    const kek = await CryptoService.deriveKEK(passphrase, salt, kdfParams)

    // Decode encrypted FEK
    const encryptedFEK: EncryptedData = {
      ciphertext: CryptoService.base64ToArrayBuffer(meta.encrypted_fek.ciphertext),
      nonce: CryptoService.fromBase64(meta.encrypted_fek.nonce),
      tag: CryptoService.fromBase64(meta.encrypted_fek.tag),
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
   * Compute SHA-256 hash of data
   */
  static async computeHash(data: ArrayBuffer | Uint8Array): Promise<string> {
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return `sha256-${hashHex}`
  }
}
