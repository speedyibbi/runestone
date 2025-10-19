import { del, get, post } from "@/utils/api"

export default class FileService {
  private static readonly lookup = ''
  private static readonly basePath = '/api/file'

  static async getFile(path: string) {
     return await get({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });
  }

  static async upsertFile(path: string) {
    return await post({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });
  }

  static async deleteFile(path: string) {
    return await del({
      endpoint: this.basePath,
      headers: {
        'x-lookup': this.lookup,
      },
      querystring: {
        path,
      },
    });
  }
}
