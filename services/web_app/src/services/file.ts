import { del, get, post, put } from '@/utils/api'
import { useLookupStore } from '@/stores/lookup'

/**
 * FileService handles file operations via signed URLs
 * Uses the server's file manager API to get pre-signed URLs
 * le operations go through the server which authenticates via lookup key
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
   * @param path - The path to the file
   * @returns Response object containing the file data
   */
  static async getFile(path: string) {
    let response = await get({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get file')
    }

    const { signedURL } = await response.json()

    response = await get({
      endpoint: signedURL,
    })

    if (!response.ok) {
      throw new Error('Failed to get file')
    }

    return response
  }

  /**
   * Upload or update a file in the file manager
   * Requests a signed URL from the server, then uploads the file directly to the file manager
   * @param path - The path where the file should be stored
   * @param file - The file to upload
   * @returns Response object from the upload operation
   */
  static async upsertFile(path: string, file: File) {
    let response = await post({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to save file')
    }

    const { signedURL } = await response.json()

    response = await put({
      endpoint: signedURL,
      body: file,
    })

    if (!response.ok) {
      throw new Error('Failed to save file')
    }

    return response
  }

  /**
   * Delete a file from the file manager
   * Requests a signed URL from the server, then deletes the file directly from the file manager
   * @param path - The path to the file to delete
   * @returns Response object from the delete operation
   */
  static async deleteFile(path: string) {
    let response = await del({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to delete file')
    }

    const { signedURL } = await response.json()

    response = await del({
      endpoint: signedURL,
    })

    if (!response.ok) {
      throw new Error('Failed to delete file')
    }

    return response
  }
}
