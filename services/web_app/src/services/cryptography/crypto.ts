import { argon2id } from '@noble/hashes/argon2'
import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { sha256 } from '@noble/hashes/sha2'
import type { Argon2idParams, PBKDF2Params, KDFParams, EncryptedData } from '@/interfaces/crypto'

/**
 * CryptoService handles all encryption/decryption operations
 * Uses Argon2id/PBKDF2 for key derivation and AES-256-GCM for encryption
 */
export default class CryptoService {
  private static readonly AES_ALGORITHM = 'AES-GCM'
  private static readonly AES_KEY_LENGTH = __APP_CONFIG__.crypto.aes.keyLength
  private static readonly AES_IV_LENGTH = __APP_CONFIG__.crypto.aes.ivLength
  private static readonly AES_TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength
  private static readonly KEK_LENGTH = __APP_CONFIG__.crypto.kek.length
  private static readonly KDF_SALT_LENGTH = __APP_CONFIG__.crypto.kdf.saltLength
  private static readonly KDF_ARGON2ID_ITERATIONS = __APP_CONFIG__.crypto.kdf.argon2id.iterations
  private static readonly KDF_ARGON2ID_MEMORY = __APP_CONFIG__.crypto.kdf.argon2id.memory
  private static readonly KDF_ARGON2ID_PARALLELISM = __APP_CONFIG__.crypto.kdf.argon2id.parallelism
  private static readonly KDF_PBKDF2_ITERATIONS = __APP_CONFIG__.crypto.kdf.pbkdf2.iterations

  /**
   * Generate random value (used for salt or nonce)
   */
  private static generateRandomValue(length: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(length))
  }

  /**
   * Pack EncryptedData into storage format: nonce + ciphertext + tag
   */
  private static packEncrypted(encryptedData: EncryptedData): Uint8Array {
    const combined = new Uint8Array(
      encryptedData.nonce.byteLength +
        encryptedData.ciphertext.byteLength +
        encryptedData.tag.byteLength,
    )

    combined.set(encryptedData.nonce, 0)
    combined.set(new Uint8Array(encryptedData.ciphertext), encryptedData.nonce.byteLength)
    combined.set(
      encryptedData.tag,
      encryptedData.nonce.byteLength + encryptedData.ciphertext.byteLength,
    )

    return combined
  }

  /**
   * Unpack storage format into EncryptedData: nonce + ciphertext + tag
   */
  private static unpackEncrypted(data: ArrayBuffer): EncryptedData {
    const nonceLength = this.AES_IV_LENGTH
    const tagLength = this.AES_TAG_LENGTH / 8 // Convert bits to bytes
    const tagStart = data.byteLength - tagLength

    const nonce = new Uint8Array(data.slice(0, nonceLength))
    const ciphertext = data.slice(nonceLength, tagStart)
    const tag = new Uint8Array(data.slice(tagStart))

    return { ciphertext, nonce, tag }
  }

  /**
   * Derive Key Encryption Key (KEK) from passphrase
   * Used for deriving both MKEK and FKEK
   */
  private static async deriveKEK(passphrase: string, params: KDFParams): Promise<CryptoKey> {
    const passphraseBytes = new TextEncoder().encode(passphrase)
    let derivedKey: Uint8Array

    if (params.algorithm === 'argon2id') {
      // Derive key using Argon2id
      derivedKey = argon2id(passphraseBytes, params.salt, {
        t: params.iterations, // time cost
        m: params.memory, // memory cost in KiB
        p: params.parallelism, // parallelism
        dkLen: this.KEK_LENGTH / 8, // output length in bytes (32 bytes = 256 bits)
      })
    } else {
      // Derive key using PBKDF2-SHA256
      derivedKey = pbkdf2(sha256, passphraseBytes, params.salt, {
        c: params.iterations,
        dkLen: this.AES_KEY_LENGTH / 8, // output length in bytes (32 bytes = 256 bits)
      })
    }

    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const keyBuffer = derivedKey.buffer.slice(
      derivedKey.byteOffset,
      derivedKey.byteOffset + derivedKey.byteLength,
    ) as ArrayBuffer

    // Import as AES key
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: this.AES_ALGORITHM, length: this.AES_KEY_LENGTH },
      false, // not extractable
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * Derive Key Encryption Key (KEK) from passphrase
   * Used for deriving both MKEK and FKEK
   */
  static async deriveMKEK(passphrase: string, params?: PBKDF2Params): Promise<CryptoKey> {
    return await this.deriveKEK(passphrase, {
      algorithm: 'pbkdf2-sha256',
      salt: params?.salt ?? this.generateRandomValue(this.KDF_SALT_LENGTH),
      iterations: params?.iterations ?? this.KDF_PBKDF2_ITERATIONS,
    })
  }

  /**
   * Derive Key Encryption Key (KEK) from passphrase
   * Used for deriving both MKEK and FKEK
   */
  static async deriveFKEK(passphrase: string, params?: Argon2idParams): Promise<CryptoKey> {
    return await this.deriveKEK(passphrase, {
      algorithm: 'argon2id',
      salt: params?.salt ?? this.generateRandomValue(this.KDF_SALT_LENGTH),
      iterations: params?.iterations ?? this.KDF_ARGON2ID_ITERATIONS,
      memory: params?.memory ?? this.KDF_ARGON2ID_MEMORY,
      parallelism: params?.parallelism ?? this.KDF_ARGON2ID_PARALLELISM,
    })
  }

  /**
   * Generate a random encryption key
   * Used for generating both MEK and FEK
   */
  static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.AES_ALGORITHM,
        length: this.AES_KEY_LENGTH,
      },
      true, // extractable
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * Encrypt a key with a derived key
   * Used for encrypting both MEK and FEK
   */
  static async encryptKey(key: CryptoKey, derivedKey: CryptoKey): Promise<EncryptedData> {
    const keyBytes = await this.exportKey(key)
    const nonce = this.generateRandomValue(this.AES_IV_LENGTH)

    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const keyBuffer = keyBytes.buffer.slice(
      keyBytes.byteOffset,
      keyBytes.byteOffset + keyBytes.byteLength,
    ) as ArrayBuffer

    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.AES_ALGORITHM,
        iv: nonce as unknown as BufferSource,
        tagLength: this.AES_TAG_LENGTH,
      },
      derivedKey,
      keyBuffer,
    )

    // GCM appends the tag at the end of ciphertext
    // Split ciphertext and tag
    const tagLengthBytes = this.AES_TAG_LENGTH / 8
    const ciphertext = encrypted.slice(0, encrypted.byteLength - tagLengthBytes)
    const tag = encrypted.slice(encrypted.byteLength - tagLengthBytes)

    return {
      ciphertext,
      nonce,
      tag: new Uint8Array(tag),
    }
  }

  /**
   * Decrypt a key with a derived key
   * Used for decrypting both MEK and FEK
   */
  static async decryptKey(encryptedData: EncryptedData, derivedKey: CryptoKey): Promise<CryptoKey> {
    // Reconstruct the encrypted buffer (ciphertext + tag)
    const combinedLength = encryptedData.ciphertext.byteLength + encryptedData.tag.byteLength
    const combined = new Uint8Array(combinedLength)
    combined.set(new Uint8Array(encryptedData.ciphertext), 0)
    combined.set(encryptedData.tag, encryptedData.ciphertext.byteLength)

    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const combinedBuffer = combined.buffer.slice(
      combined.byteOffset,
      combined.byteOffset + combined.byteLength,
    ) as ArrayBuffer

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: this.AES_ALGORITHM,
        iv: encryptedData.nonce as unknown as BufferSource,
        tagLength: this.AES_TAG_LENGTH,
      },
      derivedKey,
      combinedBuffer,
    )

    const data = new Uint8Array(decryptedData)
    return await this.importKey(data)
  }

  /**
   * Import key from raw bytes
   * Used for importing both MEK and FEK
   */
  static async importKey(data: Uint8Array): Promise<CryptoKey> {
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer
    return await crypto.subtle.importKey(
      'raw',
      buffer,
      { name: this.AES_ALGORITHM, length: this.AES_KEY_LENGTH },
      true, // extractable
      ['encrypt', 'decrypt'],
    )
  }

  /**
   * Export key as raw bytes
   * Used for exporting both MEK and FEK
   */
  static async exportKey(key: CryptoKey): Promise<Uint8Array> {
    const data = await crypto.subtle.exportKey('raw', key)
    return new Uint8Array(data)
  }

  /**
   * Encrypt blob data
   */
  static async encryptBlob(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<EncryptedData> {
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data
    const nonce = this.generateRandomValue(this.AES_IV_LENGTH)
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.AES_ALGORITHM,
        iv: nonce as unknown as BufferSource,
        tagLength: this.AES_TAG_LENGTH,
      },
      key,
      dataBuffer,
    )

    // GCM appends the tag at the end of ciphertext
    const tagLengthBytes = this.AES_TAG_LENGTH / 8
    const ciphertext = encrypted.slice(0, encrypted.byteLength - tagLengthBytes)
    const tag = encrypted.slice(encrypted.byteLength - tagLengthBytes)

    return {
      ciphertext,
      nonce,
      tag: new Uint8Array(tag),
    }
  }

  /**
   * Decrypt blob data
   */
  static async decryptBlob(encryptedData: EncryptedData, key: CryptoKey): Promise<ArrayBuffer> {
    // Reconstruct the encrypted buffer (ciphertext + tag)
    const combinedLength = encryptedData.ciphertext.byteLength + encryptedData.tag.byteLength
    const combined = new Uint8Array(combinedLength)
    combined.set(new Uint8Array(encryptedData.ciphertext), 0)
    combined.set(encryptedData.tag, encryptedData.ciphertext.byteLength)

    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const combinedBuffer = combined.buffer.slice(
      combined.byteOffset,
      combined.byteOffset + combined.byteLength,
    ) as ArrayBuffer

    return await crypto.subtle.decrypt(
      {
        name: this.AES_ALGORITHM,
        iv: encryptedData.nonce as unknown as BufferSource,
        tagLength: this.AES_TAG_LENGTH,
      },
      key,
      combinedBuffer,
    )
  }

  /**
   * Encrypt data and pack into storage format
   */
  static async encryptAndPack(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<Uint8Array> {
    const encryptedData = await this.encryptBlob(data, key)
    return this.packEncrypted(encryptedData)
  }

  /**
   * Unpack storage format and decrypt data
   */
  static async unpackAndDecrypt(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
    const encryptedData = this.unpackEncrypted(data)
    return await this.decryptBlob(encryptedData, key)
  }
}
