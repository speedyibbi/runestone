import { del, get, post, put } from "@/utils/api"
import { useLookupStore } from "@/stores/lookup"

export default class FileService {
  private static readonly basePath = '/api/file'

  private static get lookup() {
    return useLookupStore().getLookupKey()
  }

  static async getFile(path: string) {
    let response = await get({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });

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

  static async upsertFile(path: string, file: File) {
    let response = await post({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });

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

  static async deleteFile(path: string) {
    let response = await del({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });

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
