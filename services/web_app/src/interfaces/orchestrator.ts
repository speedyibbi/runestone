import type { RootMeta, NotebookMeta } from '@/interfaces/meta'
import type { Map } from '@/interfaces/map'
import type { Manifest, ManifestEntryType } from '@/interfaces/manifest'

/**
 * Result of initialize operation
 */
export interface InitializeResult {
  rootMeta: RootMeta
  map: Map
  mek: CryptoKey
}

/**
 * Result of bootstrap operation
 */
export interface BootstrapResult {
  rootMeta: RootMeta
  map: Map
  mek: CryptoKey
}

/**
 * Result of createNotebook operation
 */
export interface CreateNotebookResult {
  notebookId: string
  notebookMeta: NotebookMeta
  manifest: Manifest
  fek: CryptoKey
  map: Map
}

/**
 * Result of loadNotebook operation
 */
export interface LoadNotebookResult {
  notebookId: string
  notebookMeta: NotebookMeta
  manifest: Manifest
  fek: CryptoKey
}

/**
 * Result of updateNotebook operation
 */
export interface UpdateNotebookResult {
  manifest: Manifest
  map: Map
}

/**
 * Result of deleteNotebook operation
 */
export interface DeleteNotebookResult {
  notebookId: string
  map: Map
}

/**
 * Result of getBlob operation
 */
export interface GetBlobResult {
  uuid: string
  data: ArrayBuffer
}

/**
 * Result of createBlob operation
 */
export interface CreateBlobResult {
  uuid: string
  manifest: Manifest
}

/**
 * Result of updateBlob operation
 */
export interface UpdateBlobResult {
  uuid: string
  manifest: Manifest
}

/**
 * Result of deleteBlob operation
 */
export interface DeleteBlobResult {
  uuid: string
  manifest: Manifest
}

/**
 * Blob metadata for update operations
 */
export interface BlobMetadata {
  type: ManifestEntryType
  title: string
}
