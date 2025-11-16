import type { EncryptedData, PBKDF2Params, Argon2idParams } from '@/interfaces/crypto'

/**
 * Encryption configuration for meta files
 */
export interface EncryptionConfig {
  cipher: string
  tag_length: number
}

/**
 * Root meta structure (unencrypted)
 */
export interface RootMeta {
  version: number
  kdf: PBKDF2Params
  encrypted_mek: EncryptedData
  encryption: EncryptionConfig
}

/**
 * Notebook meta structure (unencrypted)
 */
export interface NotebookMeta {
  version: number
  kdf: Argon2idParams
  encrypted_fek: EncryptedData
  encryption: EncryptionConfig
}
