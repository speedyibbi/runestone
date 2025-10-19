import { del, get, post } from "@/utils/api"
import { useLookupStore } from "@/stores/lookup"

export default class FileService {
  private static readonly basePath = '/api/file'

  private static get lookup() {
    return useLookupStore().getLookupKey()
  }

  static async getFile(path: string) {
    const response = await get({
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

    const {signedURL} = await response.json()

    return signedURL
  }

  static async upsertFile(path: string) {
    const response = await post({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to upsert file')
    }

    const {signedURL} = await response.json()

    return signedURL
  }

  static async deleteFile(path: string) {
    const response = await del({
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

    const {signedURL} = await response.json()

    return signedURL
  }
}
