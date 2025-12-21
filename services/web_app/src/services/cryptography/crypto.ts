import type { Argon2idParams, PBKDF2Params, EncryptedData } from '@/interfaces/crypto'
import type { SerializedCryptoKey } from '@/interfaces/crypto-worker'
import { cryptoWorker } from '@/services/cryptography/crypto-worker-client'

/**
 * CryptoService handles all encryption/decryption operations
 * Uses Argon2id/PBKDF2 for key derivation and AES-256-GCM for encryption
 * Heavy computations are offloaded to a dedicated Web Worker
 * 
 * When FEATURE_CRYPTOGRAPHY is disabled, all operations pass through data unencrypted
 */
export default class CryptoService {
  private static readonly AES_ALGORITHM = 'AES-GCM'
  private static readonly AES_KEY_LENGTH = __APP_CONFIG__.crypto.aes.keyLength
  private static readonly FEATURE_CRYPTOGRAPHY = __APP_CONFIG__.global.featureFlags.cryptography

  /**
   * Generate a dummy key when cryptography is disabled
   * Returns a minimal valid CryptoKey for interface compatibility
   */
  private static async generateDummyKey(): Promise<CryptoKey> {
    // Create a simple dummy key (32 bytes of zeros)
    const dummyKeyData = new Uint8Array(32)
    return await crypto.subtle.importKey(
      'raw',
      dummyKeyData,
      { name: this.AES_ALGORITHM, length: this.AES_KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * Serialize a CryptoKey to transferable format for worker communication
   */
  private static async serializeKey(key: CryptoKey): Promise<SerializedCryptoKey> {
    const keyData = await crypto.subtle.exportKey('raw', key)
    return { keyData: new Uint8Array(keyData) }
  }

  /**
   * Deserialize a CryptoKey from worker format
   */
  private static async deserializeKey(serialized: SerializedCryptoKey): Promise<CryptoKey> {
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const keyBuffer = serialized.keyData.buffer.slice(
      serialized.keyData.byteOffset,
      serialized.keyData.byteOffset + serialized.keyData.byteLength,
    ) as ArrayBuffer

    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: this.AES_ALGORITHM, length: this.AES_KEY_LENGTH },
      true, // extractable
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * Convert EncryptedData to serializable format for worker
   */
  private static serializeEncryptedData(data: EncryptedData): {
    ciphertext: ArrayBuffer
    nonce: Uint8Array
    tag: Uint8Array
  } {
    return {
      ciphertext: data.ciphertext,
      nonce: data.nonce,
      tag: data.tag,
    }
  }

  /**
   * Convert worker encrypted data to EncryptedData
   */
  private static deserializeEncryptedData(data: {
    ciphertext: ArrayBuffer
    nonce: Uint8Array
    tag: Uint8Array
  }): EncryptedData {
    return {
      ciphertext: data.ciphertext,
      nonce: data.nonce,
      tag: data.tag,
    }
  }

  /**
   * Derive Map Key Encryption Key (MKEK) from passphrase using PBKDF2
   */
  static async deriveMKEK(passphrase: string, params?: PBKDF2Params): Promise<CryptoKey> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return await this.generateDummyKey()
    }

    const workerParams = params
      ? {
          salt: params.salt,
          iterations: params.iterations,
        }
      : undefined

    const serializedKey = await cryptoWorker.deriveMKEK(passphrase, workerParams)
    return await this.deserializeKey(serializedKey)
  }

  /**
   * Derive File Key Encryption Key (FKEK) from passphrase using Argon2id
   */
  static async deriveFKEK(passphrase: string, params?: Argon2idParams): Promise<CryptoKey> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return await this.generateDummyKey()
    }

    const workerParams = params
      ? {
          salt: params.salt,
          iterations: params.iterations,
          memory: params.memory,
          parallelism: params.parallelism,
        }
      : undefined

    const serializedKey = await cryptoWorker.deriveFKEK(passphrase, workerParams)
    return await this.deserializeKey(serializedKey)
  }

  /**
   * Generate a random encryption key
   */
  static async generateKey(): Promise<CryptoKey> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return await this.generateDummyKey()
    }

    const serializedKey = await cryptoWorker.generateKey()
    return await this.deserializeKey(serializedKey)
  }

  /**
   * Encrypt a key with a derived key
   */
  static async encryptKey(key: CryptoKey, derivedKey: CryptoKey): Promise<EncryptedData> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      const keyData = await crypto.subtle.exportKey('raw', key)
      return {
        ciphertext: keyData,
        nonce: new Uint8Array(12), // Dummy nonce
        tag: new Uint8Array(16),    // Dummy tag
      }
    }

    const serializedKey = await this.serializeKey(key)
    const serializedDerivedKey = await this.serializeKey(derivedKey)

    const encryptedData = await cryptoWorker.encryptKey(serializedKey, serializedDerivedKey)
    return this.deserializeEncryptedData(encryptedData)
  }

  /**
   * Decrypt a key with a derived key
   */
  static async decryptKey(encryptedData: EncryptedData, derivedKey: CryptoKey): Promise<CryptoKey> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return await this.importKey(new Uint8Array(encryptedData.ciphertext))
    }

    const serializedEncryptedData = this.serializeEncryptedData(encryptedData)
    const serializedDerivedKey = await this.serializeKey(derivedKey)

    const serializedKey = await cryptoWorker.decryptKey(
      serializedEncryptedData,
      serializedDerivedKey,
    )
    return await this.deserializeKey(serializedKey)
  }

  /**
   * Import key from raw bytes
   */
  static async importKey(data: Uint8Array): Promise<CryptoKey> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      // Ensure we have a proper ArrayBuffer
      const keyBuffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ) as ArrayBuffer
      
      return await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: this.AES_ALGORITHM, length: this.AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt'],
      )
    }

    const serializedKey = await cryptoWorker.importKey(data)
    return await this.deserializeKey(serializedKey)
  }

  /**
   * Export key as raw bytes
   */
  static async exportKey(key: CryptoKey): Promise<Uint8Array> {
    const serializedKey = await this.serializeKey(key)
    return await cryptoWorker.exportKey(serializedKey)
  }

  /**
   * Encrypt blob data
   */
  static async encryptBlob(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<EncryptedData> {
    // Ensure we have an ArrayBuffer
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data

    if (!this.FEATURE_CRYPTOGRAPHY) {
      return {
        ciphertext: dataBuffer,
        nonce: new Uint8Array(12), // Dummy nonce
        tag: new Uint8Array(16),    // Dummy tag
      }
    }

    const serializedKey = await this.serializeKey(key)
    const encryptedData = await cryptoWorker.encryptBlob(dataBuffer, serializedKey)
    return this.deserializeEncryptedData(encryptedData)
  }

  /**
   * Decrypt blob data
   */
  static async decryptBlob(encryptedData: EncryptedData, key: CryptoKey): Promise<ArrayBuffer> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return encryptedData.ciphertext
    }

    const serializedEncryptedData = this.serializeEncryptedData(encryptedData)
    const serializedKey = await this.serializeKey(key)

    return await cryptoWorker.decryptBlob(serializedEncryptedData, serializedKey)
  }

  /**
   * Encrypt data and pack into storage format
   */
  static async encryptAndPack(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return data instanceof Uint8Array ? data : new Uint8Array(data)
    }

    // Ensure we have an ArrayBuffer
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data

    const serializedKey = await this.serializeKey(key)
    return await cryptoWorker.encryptAndPack(dataBuffer, serializedKey)
  }

  /**
   * Unpack storage format and decrypt data
   */
  static async unpackAndDecrypt(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
    if (!this.FEATURE_CRYPTOGRAPHY) {
      return data
    }

    const serializedKey = await this.serializeKey(key)
    return await cryptoWorker.unpackAndDecrypt(data, serializedKey)
  }
}
