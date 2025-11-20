/**
 * Sync progress information
 */
export interface SyncProgress {
  phase:
    | 'idle'
    | 'fetching_manifest'
    | 'comparing'
    | 'downloading'
    | 'uploading'
    | 'saving_manifest'
  current: number
  total: number
}

/**
 * Sync result information
 */
export interface SyncResult {
  success: boolean
  downloaded: number
  uploaded: number
  conflicts: number
  errors: string[]
  duration: number
}

/**
 * Sync options
 */
export interface SyncOptions {
  notebookId: string
  fek: CryptoKey
  onProgress?: (progress: SyncProgress) => void
  signal?: AbortSignal
}
