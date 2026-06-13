/**
 * KDF parameters for Argon2id
 */
export interface Argon2idParams {
  algorithm: 'argon2id'
  salt: Uint8Array
  iterations: number // time cost
  memory: number // memory cost in KiB
  parallelism: number
}

/**
 * KDF parameters for PBKDF2-SHA256
 */
export interface PBKDF2Params {
  algorithm: 'pbkdf2-sha256'
  salt: Uint8Array
  iterations: number
}

/**
 * Union type for all KDF parameters
 */
export type KDFParams = Argon2idParams | PBKDF2Params

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  ciphertext: ArrayBuffer
  nonce: Uint8Array
  tag: Uint8Array // GCM authentication tag
}
