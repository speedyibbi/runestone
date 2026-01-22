import { del, get, post, put } from '@/utils/api'
import { useSessionStore } from '@/stores/session'

/**
 * FileService handles file operations via signed URLs
 * Uses the server's file manager API to get pre-signed URLs
 * All operations go through the server which authenticates via lookup hash
 */
export default class FileService {
  private static readonly basePath = '/api/file' // Server endpoint for file operations

  /**
   * Get the lookup hash from the session store
   */
  private static get lookupHash() {
    const session = useSessionStore()
    const hash = session.getLookupHash()
    if (!hash) {
      throw new Error('Session not initialized - lookup hash is not available')
    }
    return hash
  }

  /**
   * Get a file from the file manager
   * Requests a signed URL from the server, then fetches the file directly from the file manager
   */
  static async getFile(path: string, signal?: AbortSignal): Promise<Response> {
    let response = await get({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookupHash,
      },
      querystring: {
        path,
      },
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to get file')
    }

    const { signedURL } = await response.json()

    response = await get({
      endpoint: signedURL,
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to get file')
    }

    return response
  }

  /**
   * Upload or update a file in the file manager
   * Requests a signed URL from the server, then uploads the file directly to the file manager
   */
  static async upsertFile(path: string, file: File, signal?: AbortSignal): Promise<Response> {
    let response = await post({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookupHash,
      },
      querystring: {
        path,
        contentLength: file.size.toString(),
      },
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to save file')
    }

    const { signedURL } = await response.json()

    response = await put({
      endpoint: signedURL,
      body: file,
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to save file')
    }

    return response
  }

  /**
   * Delete a file from the file manager
   * Requests a signed URL from the server, then deletes the file directly from the file manager
   */
  static async deleteFile(path: string, signal?: AbortSignal): Promise<Response> {
    let response = await del({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookupHash,
      },
      querystring: {
        path,
      },
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to delete file')
    }

    const { signedURL } = await response.json()

    response = await del({
      endpoint: signedURL,
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to delete file')
    }

    return response
  }
}
