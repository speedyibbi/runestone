import { argon2id } from '@noble/hashes/argon2'

/**
 * KDF parameters for Argon2id
 */
export interface KDFParams {
  algorithm: 'argon2id'
  salt: Uint8Array
  iterations: number // time cost
  memory: number // memory cost in KiB
  parallelism: number
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  ciphertext: ArrayBuffer
  nonce: Uint8Array
  tag: Uint8Array // GCM authentication tag
}

/**
 * CryptoService handles all encryption/decryption operations
 * Uses Argon2id for key derivation and AES-256-GCM for encryption
 */
export default class CryptoService {
  private static readonly AES_KEY_LENGTH = __APP_CONFIG__.crypto.aes.keyLength
  private static readonly AES_ALGORITHM = __APP_CONFIG__.crypto.aes.algorithm
  private static readonly IV_LENGTH = __APP_CONFIG__.crypto.aes.ivLength
  private static readonly TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength
  private static readonly KEK_LENGTH = __APP_CONFIG__.crypto.kek.length
  private static readonly SALT_LENGTH = __APP_CONFIG__.crypto.kdf.saltLength

  /**
   * Generate random salt for KDF
   */
  static generateSalt(length?: number): Uint8Array {
    const saltLength = length ?? this.SALT_LENGTH
    return crypto.getRandomValues(new Uint8Array(saltLength))
  }

  /**
   * Generate random nonce for encryption
   */
  static generateNonce(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH))
  }

  /**
   * Derive Key Encryption Key (KEK) from passphrase using Argon2id
   */
  static async deriveKEK(
    passphrase: string,
    salt: Uint8Array,
    params: Omit<KDFParams, 'algorithm' | 'salt'>,
  ): Promise<CryptoKey> {
    // Convert passphrase to Uint8Array
    const passwordBytes = new TextEncoder().encode(passphrase)

    // Derive key using Argon2id
    const derivedKey = argon2id(passwordBytes, salt, {
      t: params.iterations, // time cost
      m: params.memory, // memory cost in KiB
      p: params.parallelism, // parallelism
      dkLen: this.KEK_LENGTH / 8, // output length in bytes (32 bytes = 256 bits)
    })

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
   * Generate a random File Encryption Key (FEK)
   */
  static async generateFEK(): Promise<CryptoKey> {
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
   * Export FEK as raw bytes (for storage/transmission after encryption)
   */
  static async exportFEK(fek: CryptoKey): Promise<Uint8Array> {
    const rawKey = await crypto.subtle.exportKey('raw', fek)
    return new Uint8Array(rawKey)
  }

  /**
   * Import FEK from raw bytes
   */
  static async importFEK(fekBytes: Uint8Array): Promise<CryptoKey> {
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const buffer = fekBytes.buffer.slice(
      fekBytes.byteOffset,
      fekBytes.byteOffset + fekBytes.byteLength,
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
   * Encrypt FEK with KEK
   */
  static async encryptFEK(fek: CryptoKey, kek: CryptoKey): Promise<EncryptedData> {
    const fekBytes = await this.exportFEK(fek)
    const nonce = this.generateNonce()

    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const fekBuffer = fekBytes.buffer.slice(
      fekBytes.byteOffset,
      fekBytes.byteOffset + fekBytes.byteLength,
    ) as ArrayBuffer
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.AES_ALGORITHM,
        iv: nonce as unknown as BufferSource,
        tagLength: this.TAG_LENGTH,
      },
      kek,
      fekBuffer,
    )

    // GCM appends the tag at the end of ciphertext
    // Split ciphertext and tag
    const tagLengthBytes = this.TAG_LENGTH / 8
    const ciphertext = encrypted.slice(0, encrypted.byteLength - tagLengthBytes)
    const tag = encrypted.slice(encrypted.byteLength - tagLengthBytes)

    return {
      ciphertext,
      nonce,
      tag: new Uint8Array(tag),
    }
  }

  /**
   * Decrypt FEK with KEK
   */
  static async decryptFEK(encryptedFEK: EncryptedData, kek: CryptoKey): Promise<CryptoKey> {
    // Reconstruct the encrypted buffer (ciphertext + tag)
    const combinedLength = encryptedFEK.ciphertext.byteLength + encryptedFEK.tag.byteLength
    const combined = new Uint8Array(combinedLength)
    combined.set(new Uint8Array(encryptedFEK.ciphertext), 0)
    combined.set(encryptedFEK.tag, encryptedFEK.ciphertext.byteLength)

    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const combinedBuffer = combined.buffer.slice(
      combined.byteOffset,
      combined.byteOffset + combined.byteLength,
    ) as ArrayBuffer
    const decrypted = await crypto.subtle.decrypt(
      {
        name: this.AES_ALGORITHM,
        iv: encryptedFEK.nonce as unknown as BufferSource,
        tagLength: this.TAG_LENGTH,
      },
      kek,
      combinedBuffer,
    )

    const fekBytes = new Uint8Array(decrypted)
    return await this.importFEK(fekBytes)
  }

  /**
   * Encrypt data blob with FEK
   */
  static async encryptBlob(data: ArrayBuffer | Uint8Array, fek: CryptoKey): Promise<EncryptedData> {
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    const dataBuffer =
      data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data
    const nonce = this.generateNonce()
    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.AES_ALGORITHM,
        iv: nonce as unknown as BufferSource,
        tagLength: this.TAG_LENGTH,
      },
      fek,
      dataBuffer,
    )

    // GCM appends the tag at the end of ciphertext
    const tagLengthBytes = this.TAG_LENGTH / 8
    const ciphertext = encrypted.slice(0, encrypted.byteLength - tagLengthBytes)
    const tag = encrypted.slice(encrypted.byteLength - tagLengthBytes)

    return {
      ciphertext,
      nonce,
      tag: new Uint8Array(tag),
    }
  }

  /**
   * Decrypt data blob with FEK
   */
  static async decryptBlob(encryptedData: EncryptedData, fek: CryptoKey): Promise<ArrayBuffer> {
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
        tagLength: this.TAG_LENGTH,
      },
      fek,
      combinedBuffer,
    )
  }

  /**
   * Pack EncryptedData into storage format: nonce + ciphertext + tag
   */
  static packEncrypted(encrypted: EncryptedData): Uint8Array {
    const combined = new Uint8Array(
      encrypted.nonce.byteLength +
        encrypted.ciphertext.byteLength +
        encrypted.tag.byteLength,
    )
    combined.set(encrypted.nonce, 0)
    combined.set(
      new Uint8Array(encrypted.ciphertext),
      encrypted.nonce.byteLength,
    )
    combined.set(
      encrypted.tag,
      encrypted.nonce.byteLength + encrypted.ciphertext.byteLength,
    )
    return combined
  }

  /**
   * Unpack storage format into EncryptedData: nonce + ciphertext + tag
   */
  static unpackEncrypted(data: ArrayBuffer): EncryptedData {
    const nonceLength = this.IV_LENGTH
    const tagLength = this.TAG_LENGTH / 8 // Convert bits to bytes
    const tagStart = data.byteLength - tagLength

    const nonce = new Uint8Array(data.slice(0, nonceLength))
    const ciphertext = data.slice(nonceLength, tagStart)
    const tag = new Uint8Array(data.slice(tagStart))

    return { ciphertext, nonce, tag }
  }

  /**
   * Encrypt data and pack into storage format
   */
  static async encryptAndPack(
    data: ArrayBuffer | Uint8Array,
    fek: CryptoKey,
  ): Promise<Uint8Array> {
    const encrypted = await this.encryptBlob(data, fek)
    return this.packEncrypted(encrypted)
  }

  /**
   * Unpack storage format and decrypt data
   */
  static async unpackAndDecrypt(
    packedData: ArrayBuffer,
    fek: CryptoKey,
  ): Promise<ArrayBuffer> {
    const encrypted = this.unpackEncrypted(packedData)
    return await this.decryptBlob(encrypted, fek)
  }
}
