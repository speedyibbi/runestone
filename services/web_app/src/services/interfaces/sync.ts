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
    | 'deleting_remote'
    | 'deleting_local'
    | 'saving_manifest'
    | 'syncing_root'
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
  deletedRemotely: number
  deletedLocally: number
  conflicts: number
  errors: string[]
  duration: number
}

/**
 * Sync options
 */
export interface SyncOptions {
  notebookId: string
  lookupHash: string
  fek: CryptoKey
  onProgress?: (progress: SyncProgress) => void
  signal?: AbortSignal
}

/**
 * Root sync options
 */
export interface RootSyncOptions {
  lookupHash: string
  mek: CryptoKey
  onProgress?: (progress: SyncProgress) => void
  signal?: AbortSignal
}
