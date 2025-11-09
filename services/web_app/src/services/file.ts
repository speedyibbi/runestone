import { del, get, post, put } from '@/utils/api'
import { useLookupStore } from '@/stores/lookup'

/**
 * FileService handles file operations via signed URLs
 * Uses the server's file manager API to get pre-signed URLs
 * All operations go through the server which authenticates via lookup key
 */
export default class FileService {
  private static readonly basePath = '/api/file' // Server endpoint for file operations

  /**
   * Get the lookup key from the store
   */
  private static get lookup() {
    return useLookupStore().getLookupKey()
  }

  /**
   * Get a file from the file manager
   * Requests a signed URL from the server, then fetches the file directly from the file manager
   */
  static async getFile(path: string, signal?: AbortSignal) {
    let response = await get({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
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
  static async upsertFile(path: string, file: File, signal?: AbortSignal) {
    let response = await post({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
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
  static async deleteFile(path: string, signal?: AbortSignal) {
    let response = await del({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
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

  /**
   * List files in a directory
   * Requests a list of files from the server, then lists the files directly from the file manager
   */
  static async listFiles(path: string, signal?: AbortSignal) {
    let response = await get({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
      signal,
    })

    if (!response.ok) {
      throw new Error('Failed to list files')
    }

    return response
  }
}
