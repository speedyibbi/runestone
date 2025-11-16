import type { EncryptedData, PBKDF2Params, Argon2idParams } from '@/interfaces/crypto'
import type { RootMeta, NotebookMeta } from '@/interfaces/meta'

/**
 * MetaService handles meta data operations for both root and notebook meta files
 * Pure data manipulation without I/O
 */
export default class MetaService {
  private static readonly ROOT_META_VERSION = __APP_CONFIG__.root.meta.version
  private static readonly NOTEBOOK_META_VERSION = __APP_CONFIG__.notebook.meta.version
  private static readonly CIPHER = 'aes-256-gcm'
  private static readonly TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength / 8

  /**
   * Create a new root meta
   */
  static createRootMeta(kdfParams: PBKDF2Params, encryptedMek: EncryptedData): RootMeta {
    return {
      version: this.ROOT_META_VERSION,
      kdf: kdfParams,
      encrypted_mek: encryptedMek,
      encryption: {
        cipher: this.CIPHER,
        tag_length: this.TAG_LENGTH,
      },
    }
  }

  /**
   * Create a new notebook meta
   */
  static createNotebookMeta(kdfParams: Argon2idParams, encryptedFek: EncryptedData): NotebookMeta {
    return {
      version: this.NOTEBOOK_META_VERSION,
      kdf: kdfParams,
      encrypted_fek: encryptedFek,
      encryption: {
        cipher: this.CIPHER,
        tag_length: this.TAG_LENGTH,
      },
    }
  }

  /**
   * Update root meta's encrypted MEK
   */
  static updateRootMek(meta: RootMeta, encryptedMek: EncryptedData): RootMeta {
    return {
      ...meta,
      encrypted_mek: encryptedMek,
    }
  }

  /**
   * Update notebook meta's encrypted FEK
   */
  static updateNotebookFek(meta: NotebookMeta, encryptedFek: EncryptedData): NotebookMeta {
    return {
      ...meta,
      encrypted_fek: encryptedFek,
    }
  }

  /**
   * Update root meta's KDF parameters
   */
  static updateRootKdf(meta: RootMeta, kdfParams: PBKDF2Params): RootMeta {
    return {
      ...meta,
      kdf: kdfParams,
    }
  }

  /**
   * Update notebook meta's KDF parameters
   */
  static updateNotebookKdf(meta: NotebookMeta, kdfParams: Argon2idParams): NotebookMeta {
    return {
      ...meta,
      kdf: kdfParams,
    }
  }
}
