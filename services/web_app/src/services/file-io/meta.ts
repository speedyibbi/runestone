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
   * Serialize RootMeta to plain object (converts Uint8Array and ArrayBuffer to arrays for JSON)
   */
  static serializeRootMeta(meta: RootMeta): any {
    return {
      version: meta.version,
      kdf: {
        algorithm: meta.kdf.algorithm,
        salt: Array.from(meta.kdf.salt),
        iterations: meta.kdf.iterations,
      },
      encrypted_mek: {
        ciphertext: Array.from(new Uint8Array(meta.encrypted_mek.ciphertext)),
        nonce: Array.from(meta.encrypted_mek.nonce),
        tag: Array.from(meta.encrypted_mek.tag),
      },
      encryption: meta.encryption,
    }
  }

  /**
   * Deserialize RootMeta from plain object (restores Uint8Array and ArrayBuffer types)
   */
  static deserializeRootMeta(obj: any): RootMeta {
    return {
      version: obj.version,
      kdf: {
        algorithm: obj.kdf.algorithm,
        salt: new Uint8Array(obj.kdf.salt),
        iterations: obj.kdf.iterations,
      },
      encrypted_mek: {
        ciphertext: new Uint8Array(obj.encrypted_mek.ciphertext).buffer,
        nonce: new Uint8Array(obj.encrypted_mek.nonce),
        tag: new Uint8Array(obj.encrypted_mek.tag),
      },
      encryption: obj.encryption,
    }
  }

  /**
   * Serialize NotebookMeta to plain object (converts Uint8Array and ArrayBuffer to arrays for JSON)
   */
  static serializeNotebookMeta(meta: NotebookMeta): any {
    return {
      version: meta.version,
      kdf: {
        algorithm: meta.kdf.algorithm,
        salt: Array.from(meta.kdf.salt),
        iterations: meta.kdf.iterations,
        memory: meta.kdf.memory,
        parallelism: meta.kdf.parallelism,
      },
      encrypted_fek: {
        ciphertext: Array.from(new Uint8Array(meta.encrypted_fek.ciphertext)),
        nonce: Array.from(meta.encrypted_fek.nonce),
        tag: Array.from(meta.encrypted_fek.tag),
      },
      encryption: meta.encryption,
    }
  }

  /**
   * Deserialize NotebookMeta from plain object (restores Uint8Array and ArrayBuffer types)
   */
  static deserializeNotebookMeta(obj: any): NotebookMeta {
    return {
      version: obj.version,
      kdf: {
        algorithm: obj.kdf.algorithm,
        salt: new Uint8Array(obj.kdf.salt),
        iterations: obj.kdf.iterations,
        memory: obj.kdf.memory,
        parallelism: obj.kdf.parallelism,
      },
      encrypted_fek: {
        ciphertext: new Uint8Array(obj.encrypted_fek.ciphertext).buffer,
        nonce: new Uint8Array(obj.encrypted_fek.nonce),
        tag: new Uint8Array(obj.encrypted_fek.tag),
      },
      encryption: obj.encryption,
    }
  }

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
