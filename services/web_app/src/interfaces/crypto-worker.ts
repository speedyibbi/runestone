/**
 * Message types for communication with crypto worker
 */
export enum CryptoWorkerMessageType {
  // Key derivation
  DERIVE_MKEK = 'DERIVE_MKEK',
  DERIVE_FKEK = 'DERIVE_FKEK',

  // Key operations
  GENERATE_KEY = 'GENERATE_KEY',
  ENCRYPT_KEY = 'ENCRYPT_KEY',
  DECRYPT_KEY = 'DECRYPT_KEY',
  EXPORT_KEY = 'EXPORT_KEY',
  IMPORT_KEY = 'IMPORT_KEY',

  // Blob operations
  ENCRYPT_BLOB = 'ENCRYPT_BLOB',
  DECRYPT_BLOB = 'DECRYPT_BLOB',
  ENCRYPT_AND_PACK = 'ENCRYPT_AND_PACK',
  UNPACK_AND_DECRYPT = 'UNPACK_AND_DECRYPT',
}

/**
 * Serializable representation of CryptoKey for worker communication
 */
export interface SerializedCryptoKey {
  keyData: Uint8Array
}

/**
 * Serializable representation of EncryptedData for worker communication
 */
export interface SerializedEncryptedData {
  ciphertext: ArrayBuffer
  nonce: Uint8Array
  tag: Uint8Array
}

/**
 * Base request message
 */
interface BaseRequest {
  id: string
  type: CryptoWorkerMessageType
}

/**
 * Base response message
 */
interface BaseResponse {
  id: string
  success: boolean
  error?: string
}

// Request types
export interface DeriveMKEKRequest extends BaseRequest {
  type: CryptoWorkerMessageType.DERIVE_MKEK
  passphrase: string
  params?: {
    salt: Uint8Array
    iterations: number
  }
}

export interface DeriveFKEKRequest extends BaseRequest {
  type: CryptoWorkerMessageType.DERIVE_FKEK
  passphrase: string
  params?: {
    salt: Uint8Array
    iterations: number
    memory: number
    parallelism: number
  }
}

export interface GenerateKeyRequest extends BaseRequest {
  type: CryptoWorkerMessageType.GENERATE_KEY
}

export interface EncryptKeyRequest extends BaseRequest {
  type: CryptoWorkerMessageType.ENCRYPT_KEY
  key: SerializedCryptoKey
  derivedKey: SerializedCryptoKey
}

export interface DecryptKeyRequest extends BaseRequest {
  type: CryptoWorkerMessageType.DECRYPT_KEY
  encryptedData: SerializedEncryptedData
  derivedKey: SerializedCryptoKey
}

export interface ExportKeyRequest extends BaseRequest {
  type: CryptoWorkerMessageType.EXPORT_KEY
  key: SerializedCryptoKey
}

export interface ImportKeyRequest extends BaseRequest {
  type: CryptoWorkerMessageType.IMPORT_KEY
  data: Uint8Array
}

export interface EncryptBlobRequest extends BaseRequest {
  type: CryptoWorkerMessageType.ENCRYPT_BLOB
  data: ArrayBuffer
  key: SerializedCryptoKey
}

export interface DecryptBlobRequest extends BaseRequest {
  type: CryptoWorkerMessageType.DECRYPT_BLOB
  encryptedData: SerializedEncryptedData
  key: SerializedCryptoKey
}

export interface EncryptAndPackRequest extends BaseRequest {
  type: CryptoWorkerMessageType.ENCRYPT_AND_PACK
  data: ArrayBuffer
  key: SerializedCryptoKey
}

export interface UnpackAndDecryptRequest extends BaseRequest {
  type: CryptoWorkerMessageType.UNPACK_AND_DECRYPT
  data: ArrayBuffer
  key: SerializedCryptoKey
}

export type CryptoWorkerRequest =
  | DeriveMKEKRequest
  | DeriveFKEKRequest
  | GenerateKeyRequest
  | EncryptKeyRequest
  | DecryptKeyRequest
  | ExportKeyRequest
  | ImportKeyRequest
  | EncryptBlobRequest
  | DecryptBlobRequest
  | EncryptAndPackRequest
  | UnpackAndDecryptRequest

// Response types
export interface DeriveMKEKResponse extends BaseResponse {
  key?: SerializedCryptoKey
}

export interface DeriveFKEKResponse extends BaseResponse {
  key?: SerializedCryptoKey
}

export interface GenerateKeyResponse extends BaseResponse {
  key?: SerializedCryptoKey
}

export interface EncryptKeyResponse extends BaseResponse {
  encryptedData?: SerializedEncryptedData
}

export interface DecryptKeyResponse extends BaseResponse {
  key?: SerializedCryptoKey
}

export interface ExportKeyResponse extends BaseResponse {
  data?: Uint8Array
}

export interface ImportKeyResponse extends BaseResponse {
  key?: SerializedCryptoKey
}

export interface EncryptBlobResponse extends BaseResponse {
  encryptedData?: SerializedEncryptedData
}

export interface DecryptBlobResponse extends BaseResponse {
  data?: ArrayBuffer
}

export interface EncryptAndPackResponse extends BaseResponse {
  data?: Uint8Array
}

export interface UnpackAndDecryptResponse extends BaseResponse {
  data?: ArrayBuffer
}

export type CryptoWorkerResponse =
  | DeriveMKEKResponse
  | DeriveFKEKResponse
  | GenerateKeyResponse
  | EncryptKeyResponse
  | DecryptKeyResponse
  | ExportKeyResponse
  | ImportKeyResponse
  | EncryptBlobResponse
  | DecryptBlobResponse
  | EncryptAndPackResponse
  | UnpackAndDecryptResponse
