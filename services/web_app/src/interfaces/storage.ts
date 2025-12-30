/**
 * File type identifiers for storage operations
 */
export type FileType = 'rootMeta' | 'map' | 'notebookMeta' | 'manifest' | 'blob' | 'searchIndex'

/**
 * Path parameters for building file paths
 */
export interface PathParams {
  type: FileType
  notebookId?: string
  uuid?: string
}
