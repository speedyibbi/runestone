import type {
  CryptoWorkerRequest,
  CryptoWorkerResponse,
  SerializedCryptoKey,
  SerializedEncryptedData,
} from '@/interfaces/crypto-worker'
import { CryptoWorkerMessageType as MessageType } from '@/interfaces/crypto-worker'

/**
 * CryptoWorkerClient - Provides a clean API for communicating with the crypto worker
 * Handles message passing, promise-based responses, and transferable objects
 */
export class CryptoWorkerClient {
  private worker: Worker
  private pendingRequests: Map<
    string,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >
  private requestIdCounter: number

  constructor() {
    this.worker = new Worker(new URL('@/workers/crypto.worker.ts', import.meta.url), {
      type: 'module',
    })

    this.pendingRequests = new Map()
    this.requestIdCounter = 0

    // Handle messages from worker
    this.worker.onmessage = (event: MessageEvent<CryptoWorkerResponse>) => {
      const response = event.data
      const pending = this.pendingRequests.get(response.id)

      if (!pending) {
        console.warn(`Received response for unknown request: ${response.id}`)
        return
      }

      this.pendingRequests.delete(response.id)

      if (response.success) {
        pending.resolve(response)
      } else {
        pending.reject(new Error(response.error || 'Unknown worker error'))
      }
    }

    // Handle worker errors
    this.worker.onerror = (error) => {
      console.error('Crypto worker error:', error)
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests.entries()) {
        pending.reject(new Error('Worker error'))
        this.pendingRequests.delete(id)
      }
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${++this.requestIdCounter}_${Date.now()}`
  }

  /**
   * Send a request to the worker and wait for response
   */
  private async sendRequest<T extends CryptoWorkerResponse>(
    request: CryptoWorkerRequest,
    transferables: Transferable[] = [],
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject })
      this.worker.postMessage(request, transferables)
    })
  }

  /**
   * Derive MKEK from passphrase using PBKDF2
   */
  async deriveMKEK(
    passphrase: string,
    params?: { salt: Uint8Array; iterations: number },
  ): Promise<SerializedCryptoKey> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.DERIVE_MKEK,
      passphrase,
      params,
    }

    const response = await this.sendRequest(request)
    if (!('key' in response) || !response.key) {
      throw new Error('Failed to derive MKEK')
    }
    return response.key
  }

  /**
   * Derive FKEK from passphrase using Argon2id
   */
  async deriveFKEK(
    passphrase: string,
    params?: { salt: Uint8Array; iterations: number; memory: number; parallelism: number },
  ): Promise<SerializedCryptoKey> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.DERIVE_FKEK,
      passphrase,
      params,
    }

    const response = await this.sendRequest(request)
    if (!('key' in response) || !response.key) {
      throw new Error('Failed to derive FKEK')
    }
    return response.key
  }

  /**
   * Generate a random encryption key
   */
  async generateKey(): Promise<SerializedCryptoKey> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.GENERATE_KEY,
    }

    const response = await this.sendRequest(request)
    if (!('key' in response) || !response.key) {
      throw new Error('Failed to generate key')
    }
    return response.key
  }

  /**
   * Encrypt a key with a derived key
   */
  async encryptKey(
    key: SerializedCryptoKey,
    derivedKey: SerializedCryptoKey,
  ): Promise<SerializedEncryptedData> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.ENCRYPT_KEY,
      key,
      derivedKey,
    }

    const response = await this.sendRequest(request)
    if (!('encryptedData' in response) || !response.encryptedData) {
      throw new Error('Failed to encrypt key')
    }
    return response.encryptedData
  }

  /**
   * Decrypt a key with a derived key
   */
  async decryptKey(
    encryptedData: SerializedEncryptedData,
    derivedKey: SerializedCryptoKey,
  ): Promise<SerializedCryptoKey> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.DECRYPT_KEY,
      encryptedData,
      derivedKey,
    }

    const response = await this.sendRequest(request)
    if (!('key' in response) || !response.key) {
      throw new Error('Failed to decrypt key')
    }
    return response.key
  }

  /**
   * Export key as raw bytes
   */
  async exportKey(key: SerializedCryptoKey): Promise<Uint8Array> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.EXPORT_KEY,
      key,
    }

    const response = await this.sendRequest(request)
    if (!('data' in response) || !response.data || !(response.data instanceof Uint8Array)) {
      throw new Error('Failed to export key')
    }
    return response.data
  }

  /**
   * Import key from raw bytes
   */
  async importKey(data: Uint8Array): Promise<SerializedCryptoKey> {
    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.IMPORT_KEY,
      data,
    }

    const response = await this.sendRequest(request)
    if (!('key' in response) || !response.key) {
      throw new Error('Failed to import key')
    }
    return response.key
  }

  /**
   * Encrypt blob data
   */
  async encryptBlob(data: ArrayBuffer, key: SerializedCryptoKey): Promise<SerializedEncryptedData> {
    // Clone the buffer to avoid transferring it (since we need to keep the original)
    const dataClone = data.slice(0)

    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.ENCRYPT_BLOB,
      data: dataClone,
      key,
    }

    // Transfer the cloned data buffer to avoid copying
    const response = await this.sendRequest(request, [dataClone])
    if (!('encryptedData' in response) || !response.encryptedData) {
      throw new Error('Failed to encrypt blob')
    }
    return response.encryptedData
  }

  /**
   * Decrypt blob data
   */
  async decryptBlob(
    encryptedData: SerializedEncryptedData,
    key: SerializedCryptoKey,
  ): Promise<ArrayBuffer> {
    // Clone the ciphertext to avoid transferring it
    const ciphertextClone = encryptedData.ciphertext.slice(0)

    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.DECRYPT_BLOB,
      encryptedData: {
        ciphertext: ciphertextClone,
        nonce: encryptedData.nonce,
        tag: encryptedData.tag,
      },
      key,
    }

    // Transfer the cloned ciphertext buffer to avoid copying
    const response = await this.sendRequest(request, [ciphertextClone])
    if (!('data' in response) || !response.data || !(response.data instanceof ArrayBuffer)) {
      throw new Error('Failed to decrypt blob')
    }
    return response.data
  }

  /**
   * Encrypt data and pack into storage format
   */
  async encryptAndPack(data: ArrayBuffer, key: SerializedCryptoKey): Promise<Uint8Array> {
    // Clone the buffer to avoid transferring it
    const dataClone = data.slice(0)

    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.ENCRYPT_AND_PACK,
      data: dataClone,
      key,
    }

    // Transfer the cloned data buffer to avoid copying
    const response = await this.sendRequest(request, [dataClone])
    if (!('data' in response) || !response.data || !(response.data instanceof Uint8Array)) {
      throw new Error('Failed to encrypt and pack')
    }
    return response.data
  }

  /**
   * Unpack storage format and decrypt data
   */
  async unpackAndDecrypt(data: ArrayBuffer, key: SerializedCryptoKey): Promise<ArrayBuffer> {
    // Clone the buffer to avoid transferring it
    const dataClone = data.slice(0)

    const request: CryptoWorkerRequest = {
      id: this.generateRequestId(),
      type: MessageType.UNPACK_AND_DECRYPT,
      data: dataClone,
      key,
    }

    // Transfer the cloned data buffer to avoid copying
    const response = await this.sendRequest(request, [dataClone])
    if (!('data' in response) || !response.data || !(response.data instanceof ArrayBuffer)) {
      throw new Error('Failed to unpack and decrypt')
    }
    return response.data
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    this.worker.terminate()
    this.pendingRequests.clear()
  }
}

// Export singleton instance
export const cryptoWorker = new CryptoWorkerClient()
