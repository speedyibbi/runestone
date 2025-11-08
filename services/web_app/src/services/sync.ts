import RemoteService from '@/services/remote'
import CacheService from '@/services/cache'
import CryptoService from '@/services/crypto'
import ManifestService, { type Manifest, type ManifestEntry } from '@/services/manifest'

/**
 * Sync progress information
 */
export interface SyncProgress {
  phase: 'idle' | 'fetching_manifest' | 'comparing' | 'downloading' | 'uploading' | 'saving_manifest'
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

/**
 * SyncService handles synchronization between remote and local cache
 * Uses Last-Write-Wins conflict resolution strategy
 */
export default class SyncService {
  /**
   * Perform full sync operation
   */
  static async sync(options: SyncOptions): Promise<SyncResult> {
    const { notebookId, fek, onProgress, signal } = options
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Phase 1: Fetch manifests
      this.notifyProgress(onProgress, {
        phase: 'fetching_manifest',
        current: 0,
        total: 2,
      })

      const [remoteManifestEncrypted, cachedManifestEncrypted] = await Promise.all([
        RemoteService.getManifest(notebookId, signal),
        CacheService.getManifest(notebookId),
      ])

      this.notifyProgress(onProgress, {
        phase: 'fetching_manifest',
        current: 2,
        total: 2,
      })

      // Decrypt remote manifest
      const remoteManifestDecrypted = await CryptoService.unpackAndDecrypt(
        remoteManifestEncrypted,
        fek,
      )
      const remoteManifestText = new TextDecoder().decode(remoteManifestDecrypted)
      const remoteManifest = JSON.parse(remoteManifestText) as Manifest

      // Decrypt cached manifest if it exists
      let cachedManifest: Manifest | null = null
      if (cachedManifestEncrypted) {
        const cachedManifestDecrypted = await CryptoService.unpackAndDecrypt(
          cachedManifestEncrypted,
          fek,
        )
        const cachedManifestText = new TextDecoder().decode(cachedManifestDecrypted)
        cachedManifest = JSON.parse(cachedManifestText) as Manifest
      }

      // Phase 2: Compare manifests
      this.notifyProgress(onProgress, {
        phase: 'comparing',
        current: 0,
        total: 1,
      })

      const syncActions = this.compareManifests(cachedManifest, remoteManifest)

      this.notifyProgress(onProgress, {
        phase: 'comparing',
        current: 1,
        total: 1,
      })

      // Phase 3: Download missing/updated blobs
      let downloaded = 0
      if (syncActions.toDownload.length > 0) {
        downloaded = await this.downloadBlobs(
          notebookId,
          syncActions.toDownload,
          signal,
          (current, total) => {
            this.notifyProgress(onProgress, {
              phase: 'downloading',
              current,
              total,
            })
          },
          errors,
        )
      }

      // Phase 4: Upload new/modified blobs
      let uploaded = 0
      if (syncActions.toUpload.length > 0) {
        uploaded = await this.uploadBlobs(
          notebookId,
          syncActions.toUpload,
          signal,
          (current, total) => {
            this.notifyProgress(onProgress, {
              phase: 'uploading',
              current,
              total,
            })
          },
          errors,
        )
      }

      // Phase 5: Merge manifests and save
      this.notifyProgress(onProgress, {
        phase: 'saving_manifest',
        current: 0,
        total: 1,
      })

      const { manifest: mergedManifest, conflicts } = cachedManifest
        ? ManifestService.mergeManifests(cachedManifest, remoteManifest)
        : { manifest: remoteManifest, conflicts: 0 }

      // Encrypt merged manifest
      const mergedManifestText = JSON.stringify(mergedManifest, null, 2)
      const mergedManifestBytes = new TextEncoder().encode(mergedManifestText)
      const encryptedMergedManifest = await CryptoService.encryptAndPack(
        mergedManifestBytes,
        fek,
      )

      // Save to both remote and cache
      await Promise.all([
        RemoteService.putManifest(notebookId, encryptedMergedManifest, signal),
        CacheService.saveManifest(notebookId, encryptedMergedManifest),
      ])

      this.notifyProgress(onProgress, {
        phase: 'saving_manifest',
        current: 1,
        total: 1,
      })

      const duration = Date.now() - startTime

      // Final notification
      this.notifyProgress(onProgress, {
        phase: 'idle',
        current: 0,
        total: 0,
      })

      return {
        success: errors.length === 0,
        downloaded,
        uploaded,
        conflicts,
        errors,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const isAborted = error instanceof Error && error.name === 'AbortError'
      const errorMessage = isAborted
        ? 'Sync cancelled'
        : error instanceof Error
          ? error.message
          : String(error)

      if (!isAborted) {
        errors.push(errorMessage)
      }

      this.notifyProgress(onProgress, {
        phase: 'idle',
        current: 0,
        total: 0,
      })

      return {
        success: false,
        downloaded: 0,
        uploaded: 0,
        conflicts: 0,
        errors,
        duration,
      }
    }
  }

  /**
   * Compare manifests and determine sync actions
   */
  private static compareManifests(
    cached: Manifest | null,
    remote: Manifest,
  ): {
    toDownload: ManifestEntry[]
    toUpload: ManifestEntry[]
  } {
    const toDownload: ManifestEntry[] = []
    const toUpload: ManifestEntry[] = []

    // If no cached manifest, download everything
    if (!cached) {
      return { toDownload: remote.entries, toUpload: [] }
    }

    const cachedEntries = new Map<string, ManifestEntry>()
    for (const entry of cached.entries) {
      cachedEntries.set(entry.uuid, entry)
    }

    const remoteEntries = new Map<string, ManifestEntry>()
    for (const entry of remote.entries) {
      remoteEntries.set(entry.uuid, entry)
    }

    // Check remote entries (download if missing)
    for (const remoteEntry of remote.entries) {
      const cachedEntry = cachedEntries.get(remoteEntry.uuid)

      if (!cachedEntry) {
        // Entry doesn't exist in cache - download
        toDownload.push(remoteEntry)
      } else {
        // Compare timestamps (Last-Write-Wins)
        const cachedTime = new Date(cachedEntry.last_updated).getTime()
        const remoteTime = new Date(remoteEntry.last_updated).getTime()

        if (remoteTime > cachedTime) {
          // Remote is newer - download
          toDownload.push(remoteEntry)
        }
      }
    }

    // Check cached entries (upload if missing remotely)
    for (const cachedEntry of cached.entries) {
      const remoteEntry = remoteEntries.get(cachedEntry.uuid)

      if (!remoteEntry) {
        // Entry doesn't exist remotely - upload
        toUpload.push(cachedEntry)
      } else {
        // Compare timestamps
        const cachedTime = new Date(cachedEntry.last_updated).getTime()
        const remoteTime = new Date(remoteEntry.last_updated).getTime()

        if (cachedTime > remoteTime) {
          // Cached is newer - upload
          toUpload.push(cachedEntry)
        }
      }
    }

    return { toDownload, toUpload }
  }

  /**
   * Download blobs from remote
   */
  private static async downloadBlobs(
    notebookId: string,
    entries: ManifestEntry[],
    signal: AbortSignal | undefined,
    onProgress: (current: number, total: number) => void,
    errors: string[],
  ): Promise<number> {
    let downloaded = 0

    for (let i = 0; i < entries.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('Sync cancelled', 'AbortError')
      }

      const entry = entries[i]
      try {
        // Download encrypted blob from remote
        const encryptedBlob = await RemoteService.getBlob(notebookId, entry.uuid, signal)

        // Save encrypted blob to cache
        await CacheService.saveBlob(notebookId, entry.uuid, encryptedBlob)

        downloaded++
        onProgress(i + 1, entries.length)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }
        const errorMessage = `Failed to download blob ${entry.uuid}: ${error}`
        errors.push(errorMessage)
        onProgress(i + 1, entries.length)
      }
    }

    return downloaded
  }

  /**
   * Upload blobs to remote
   */
  private static async uploadBlobs(
    notebookId: string,
    entries: ManifestEntry[],
    signal: AbortSignal | undefined,
    onProgress: (current: number, total: number) => void,
    errors: string[],
  ): Promise<number> {
    let uploaded = 0

    for (let i = 0; i < entries.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('Sync cancelled', 'AbortError')
      }

      const entry = entries[i]
      try {
        // Get encrypted blob from cache
        const encryptedBlob = await CacheService.getBlob(notebookId, entry.uuid)

        if (!encryptedBlob) {
          errors.push(`Blob ${entry.uuid} not found in cache`)
          onProgress(i + 1, entries.length)
          continue
        }

        // Upload encrypted blob to remote
        await RemoteService.putBlob(notebookId, entry.uuid, encryptedBlob, signal)

        uploaded++
        onProgress(i + 1, entries.length)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }
        const errorMessage = `Failed to upload blob ${entry.uuid}: ${error}`
        errors.push(errorMessage)
        onProgress(i + 1, entries.length)
      }
    }

    return uploaded
  }

  /**
   * Notify progress callback if provided
   */
  private static notifyProgress(
    callback: ((progress: SyncProgress) => void) | undefined,
    progress: SyncProgress,
  ): void {
    if (callback) {
      callback(progress)
    }
  }
}
