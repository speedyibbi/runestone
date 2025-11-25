import { argon2id } from '@noble/hashes/argon2'
import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { sha256 } from '@noble/hashes/sha2'
import type {
  CryptoWorkerRequest,
  CryptoWorkerResponse,
  SerializedCryptoKey,
  SerializedEncryptedData,
} from '@/interfaces/crypto-worker'

/**
 * Crypto Worker - Handles heavy cryptographic operations in a separate thread
 */

// Type declaration for app config (injected by Vite at build time)
declare const __APP_CONFIG__: import('@runestone/config').Config['web_app']

// Constants from app config
const AES_ALGORITHM = 'AES-GCM'
const AES_KEY_LENGTH = __APP_CONFIG__.crypto.aes.keyLength
const AES_IV_LENGTH = __APP_CONFIG__.crypto.aes.ivLength
const AES_TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength
const KEK_LENGTH = __APP_CONFIG__.crypto.kek.length
const KDF_SALT_LENGTH = __APP_CONFIG__.crypto.kdf.saltLength
const KDF_ARGON2ID_ITERATIONS = __APP_CONFIG__.crypto.kdf.argon2id.iterations
const KDF_ARGON2ID_MEMORY = __APP_CONFIG__.crypto.kdf.argon2id.memory
const KDF_ARGON2ID_PARALLELISM = __APP_CONFIG__.crypto.kdf.argon2id.parallelism
const KDF_PBKDF2_ITERATIONS = __APP_CONFIG__.crypto.kdf.pbkdf2.iterations

/**
 * Generate random value (used for salt or nonce)
 */
function generateRandomValue(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Pack EncryptedData into storage format: nonce + ciphertext + tag
 */
function packEncrypted(encryptedData: SerializedEncryptedData): Uint8Array {
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
function unpackEncrypted(data: ArrayBuffer): SerializedEncryptedData {
  const nonceLength = AES_IV_LENGTH
  const tagLength = AES_TAG_LENGTH / 8 // Convert bits to bytes
  const tagStart = data.byteLength - tagLength

  const nonce = new Uint8Array(data.slice(0, nonceLength))
  const ciphertext = data.slice(nonceLength, tagStart)
  const tag = new Uint8Array(data.slice(tagStart))

  return { ciphertext, nonce, tag }
}

/**
 * Serialize a CryptoKey to transferable format
 */
async function serializeCryptoKey(key: CryptoKey): Promise<SerializedCryptoKey> {
  const keyData = await crypto.subtle.exportKey('raw', key)
  return { keyData: new Uint8Array(keyData) }
}

/**
 * Deserialize a CryptoKey from transferable format
 */
async function deserializeCryptoKey(
  serialized: SerializedCryptoKey,
  extractable: boolean = true,
): Promise<CryptoKey> {
  // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const keyBuffer = serialized.keyData.buffer.slice(
    serialized.keyData.byteOffset,
    serialized.keyData.byteOffset + serialized.keyData.byteLength,
  ) as ArrayBuffer

  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    extractable,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Derive Key Encryption Key (KEK) from passphrase
 */
async function deriveKEK(
  passphrase: string,
  algorithm: 'argon2id' | 'pbkdf2-sha256',
  salt: Uint8Array,
  iterations: number,
  memory?: number,
  parallelism?: number,
): Promise<SerializedCryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase)
  let derivedKey: Uint8Array

  if (algorithm === 'argon2id') {
    // Derive key using Argon2id
    derivedKey = argon2id(passphraseBytes, salt, {
      t: iterations, // time cost
      m: memory ?? KDF_ARGON2ID_MEMORY, // memory cost in KiB
      p: parallelism ?? KDF_ARGON2ID_PARALLELISM, // parallelism
      dkLen: KEK_LENGTH / 8, // output length in bytes (32 bytes = 256 bits)
    })
  } else {
    // Derive key using PBKDF2-SHA256
    derivedKey = pbkdf2(sha256, passphraseBytes, salt, {
      c: iterations,
      dkLen: AES_KEY_LENGTH / 8, // output length in bytes (32 bytes = 256 bits)
    })
  }

  // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const keyBuffer = derivedKey.buffer.slice(
    derivedKey.byteOffset,
    derivedKey.byteOffset + derivedKey.byteLength,
  ) as ArrayBuffer

  // Import as AES key
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    false, // not extractable for KEK
    ['encrypt', 'decrypt'],
  )

  return serializeCryptoKey(key)
}

/**
 * Generate a random encryption key
 */
async function generateKey(): Promise<SerializedCryptoKey> {
  const key = await crypto.subtle.generateKey(
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    true, // extractable
    ['encrypt', 'decrypt'],
  )

  return serializeCryptoKey(key)
}

/**
 * Encrypt a key with a derived key
 */
async function encryptKey(
  key: SerializedCryptoKey,
  derivedKey: SerializedCryptoKey,
): Promise<SerializedEncryptedData> {
  const keyToEncrypt = await deserializeCryptoKey(key)
  const kek = await deserializeCryptoKey(derivedKey, false)

  const keyBytes = await crypto.subtle.exportKey('raw', keyToEncrypt)
  const nonce = generateRandomValue(AES_IV_LENGTH)

  // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const nonceBuffer = nonce.buffer.slice(
    nonce.byteOffset,
    nonce.byteOffset + nonce.byteLength,
  ) as ArrayBuffer

  const encrypted = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv: nonceBuffer,
      tagLength: AES_TAG_LENGTH,
    },
    kek,
    keyBytes,
  )

  // GCM appends the tag at the end of ciphertext
  const tagLengthBytes = AES_TAG_LENGTH / 8
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
 */
async function decryptKey(
  encryptedData: SerializedEncryptedData,
  derivedKey: SerializedCryptoKey,
): Promise<SerializedCryptoKey> {
  const kek = await deserializeCryptoKey(derivedKey, false)

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

  const nonceBuffer = encryptedData.nonce.buffer.slice(
    encryptedData.nonce.byteOffset,
    encryptedData.nonce.byteOffset + encryptedData.nonce.byteLength,
  ) as ArrayBuffer

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: AES_ALGORITHM,
      iv: nonceBuffer,
      tagLength: AES_TAG_LENGTH,
    },
    kek,
    combinedBuffer,
  )

  // Import decrypted key
  const key = await crypto.subtle.importKey(
    'raw',
    decryptedData,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt'],
  )

  return serializeCryptoKey(key)
}

/**
 * Export key as raw bytes
 */
async function exportKey(key: SerializedCryptoKey): Promise<Uint8Array> {
  // Already serialized, just return the key data
  return key.keyData
}

/**
 * Import key from raw bytes
 */
async function importKey(data: Uint8Array): Promise<SerializedCryptoKey> {
  // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const dataBuffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer

  const key = await crypto.subtle.importKey(
    'raw',
    dataBuffer,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt'],
  )

  return serializeCryptoKey(key)
}

/**
 * Encrypt blob data
 */
async function encryptBlob(
  data: ArrayBuffer,
  key: SerializedCryptoKey,
): Promise<SerializedEncryptedData> {
  const cryptoKey = await deserializeCryptoKey(key)
  const nonce = generateRandomValue(AES_IV_LENGTH)

  // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
  const nonceBuffer = nonce.buffer.slice(
    nonce.byteOffset,
    nonce.byteOffset + nonce.byteLength,
  ) as ArrayBuffer

  const encrypted = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv: nonceBuffer,
      tagLength: AES_TAG_LENGTH,
    },
    cryptoKey,
    data,
  )

  // GCM appends the tag at the end of ciphertext
  const tagLengthBytes = AES_TAG_LENGTH / 8
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
async function decryptBlob(
  encryptedData: SerializedEncryptedData,
  key: SerializedCryptoKey,
): Promise<ArrayBuffer> {
  const cryptoKey = await deserializeCryptoKey(key)

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

  const nonceBuffer = encryptedData.nonce.buffer.slice(
    encryptedData.nonce.byteOffset,
    encryptedData.nonce.byteOffset + encryptedData.nonce.byteLength,
  ) as ArrayBuffer

  return await crypto.subtle.decrypt(
    {
      name: AES_ALGORITHM,
      iv: nonceBuffer,
      tagLength: AES_TAG_LENGTH,
    },
    cryptoKey,
    combinedBuffer,
  )
}

/**
 * Encrypt data and pack into storage format
 */
async function encryptAndPack(data: ArrayBuffer, key: SerializedCryptoKey): Promise<Uint8Array> {
  const encryptedData = await encryptBlob(data, key)
  return packEncrypted(encryptedData)
}

/**
 * Unpack storage format and decrypt data
 */
async function unpackAndDecrypt(data: ArrayBuffer, key: SerializedCryptoKey): Promise<ArrayBuffer> {
  const encryptedData = unpackEncrypted(data)
  return await decryptBlob(encryptedData, key)
}

/**
 * Handle incoming messages from main thread
 */
async function handleMessage(request: CryptoWorkerRequest): Promise<CryptoWorkerResponse> {
  try {
    switch (request.type) {
      case 'DERIVE_MKEK': {
        const salt = request.params?.salt ?? generateRandomValue(KDF_SALT_LENGTH)
        const iterations = request.params?.iterations ?? KDF_PBKDF2_ITERATIONS
        const key = await deriveKEK(request.passphrase, 'pbkdf2-sha256', salt, iterations)
        return { id: request.id, success: true, key }
      }

      case 'DERIVE_FKEK': {
        const salt = request.params?.salt ?? generateRandomValue(KDF_SALT_LENGTH)
        const iterations = request.params?.iterations ?? KDF_ARGON2ID_ITERATIONS
        const memory = request.params?.memory ?? KDF_ARGON2ID_MEMORY
        const parallelism = request.params?.parallelism ?? KDF_ARGON2ID_PARALLELISM
        const key = await deriveKEK(
          request.passphrase,
          'argon2id',
          salt,
          iterations,
          memory,
          parallelism,
        )
        return { id: request.id, success: true, key }
      }

      case 'GENERATE_KEY': {
        const key = await generateKey()
        return { id: request.id, success: true, key }
      }

      case 'ENCRYPT_KEY': {
        const encryptedData = await encryptKey(request.key, request.derivedKey)
        return { id: request.id, success: true, encryptedData }
      }

      case 'DECRYPT_KEY': {
        const key = await decryptKey(request.encryptedData, request.derivedKey)
        return { id: request.id, success: true, key }
      }

      case 'EXPORT_KEY': {
        const data = await exportKey(request.key)
        return { id: request.id, success: true, data }
      }

      case 'IMPORT_KEY': {
        const key = await importKey(request.data)
        return { id: request.id, success: true, key }
      }

      case 'ENCRYPT_BLOB': {
        const encryptedData = await encryptBlob(request.data, request.key)
        return { id: request.id, success: true, encryptedData }
      }

      case 'DECRYPT_BLOB': {
        const data = await decryptBlob(request.encryptedData, request.key)
        return { id: request.id, success: true, data }
      }

      case 'ENCRYPT_AND_PACK': {
        const data = await encryptAndPack(request.data, request.key)
        return { id: request.id, success: true, data }
      }

      case 'UNPACK_AND_DECRYPT': {
        const data = await unpackAndDecrypt(request.data, request.key)
        return { id: request.id, success: true, data }
      }

      default:
        throw new Error(`Unknown message type: ${(request as any).type}`)
    }
  } catch (error) {
    return {
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Worker message handler
 */
self.onmessage = async (event: MessageEvent<CryptoWorkerRequest>) => {
  const request = event.data
  const response = await handleMessage(request)

  // Extract transferable objects for zero-copy transfer
  const transferables: Transferable[] = []

  if (response.success) {
    // Add ArrayBuffers to transferables
    if ('data' in response && response.data instanceof ArrayBuffer) {
      transferables.push(response.data)
    }
    if ('encryptedData' in response && response.encryptedData) {
      if (response.encryptedData.ciphertext instanceof ArrayBuffer) {
        transferables.push(response.encryptedData.ciphertext)
      }
    }
  }

  self.postMessage(response, { transfer: transferables })
}

// Export empty object for module compatibility
export {}
