import RemoteService from '@/services/l2-storage/remote'
import CacheService from '@/services/l2-storage/cache'
import CryptoService from '@/services/cryptography/crypto'
import ManifestService from '@/services/file-io/manifest'
import MapService from '@/services/file-io/map'
import type { Manifest, ManifestEntry } from '@/interfaces/manifest'
import type { Map } from '@/interfaces/map'
import type { RootMeta, NotebookMeta } from '@/interfaces/meta'
import type { SyncProgress, SyncResult, SyncOptions, RootSyncOptions } from '@/interfaces/sync'

/**
 * SyncService handles synchronization between remote and local cache
 * Uses Last-Write-Wins conflict resolution strategy
 */
export default class SyncService {
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

  /**
   * Compare manifests and determine sync actions
   * Verifies that blobs actually exist in cache (not just manifest entries)
   */
  private static async compareManifests(
    cached: Manifest | null,
    remote: Manifest | null,
    lookupHash: string,
    notebookId: string,
  ): Promise<{
    toDownload: ManifestEntry[]
    toUpload: ManifestEntry[]
    toDeleteRemotely: string[]
    toDeleteLocally: string[]
  }> {
    if (remote && !cached) {
      return { toDownload: remote.entries, toUpload: [], toDeleteRemotely: [], toDeleteLocally: [] }
    } else if (!remote && cached) {
      return { toDownload: [], toUpload: cached.entries, toDeleteRemotely: [], toDeleteLocally: [] }
    }

    if (!cached || !remote) {
      throw new Error('Manifest not found in either remote or cache')
    }

    const toDownload: ManifestEntry[] = []
    const toUpload: ManifestEntry[] = []
    const toDeleteRemotely: string[] = []
    const toDeleteLocally: string[] = []

    const cachedEntries = new Map<string, ManifestEntry>()
    for (const entry of cached.entries) {
      cachedEntries.set(entry.uuid, entry)
    }

    const remoteEntries = new Map<string, ManifestEntry>()
    for (const entry of remote.entries) {
      remoteEntries.set(entry.uuid, entry)
    }

    const cachedManifestTime = new Date(cached.last_updated).getTime()
    const remoteManifestTime = new Date(remote.last_updated).getTime()

    // Check remote entries (download if missing or newer, or delete if removed locally)
    for (const remoteEntry of remote.entries) {
      const cachedEntry = cachedEntries.get(remoteEntry.uuid)

      if (!cachedEntry) {
        // Entry doesn't exist in cache manifest
        const remoteEntryTime = new Date(remoteEntry.last_updated).getTime()

        if (remoteManifestTime > cachedManifestTime || remoteEntryTime > cachedManifestTime) {
          // Remote manifest or entry is newer - this is a new entry, download it
          toDownload.push(remoteEntry)
        } else {
          // Cached manifest is newer and doesn't have this entry - it was deleted locally
          // Delete it from remote
          toDeleteRemotely.push(remoteEntry.uuid)
        }
      } else {
        // Entry exists in manifest - check if blob file actually exists in cache
        const blobExists = await CacheService.getBlob(lookupHash, notebookId, remoteEntry.uuid)

        if (!blobExists) {
          // Manifest entry exists but blob file is missing - download
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
    }

    // Check cached entries (upload if missing remotely or newer, or delete if removed remotely)
    for (const cachedEntry of cached.entries) {
      const remoteEntry = remoteEntries.get(cachedEntry.uuid)

      if (!remoteEntry) {
        // Entry doesn't exist remotely
        const cachedEntryTime = new Date(cachedEntry.last_updated).getTime()

        if (cachedManifestTime > remoteManifestTime || cachedEntryTime > remoteManifestTime) {
          // Local manifest or entry is newer - this is a new entry, upload it
          toUpload.push(cachedEntry)
        } else {
          // Remote manifest is newer and doesn't have this entry - it was deleted remotely
          // Delete it from cache
          toDeleteLocally.push(cachedEntry.uuid)
        }
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

    return { toDownload, toUpload, toDeleteRemotely, toDeleteLocally }
  }

  /**
   * Download blobs from remote
   */
  private static async downloadBlobs(
    lookupHash: string,
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
        await CacheService.upsertBlob(lookupHash, notebookId, entry.uuid, encryptedBlob)

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
    lookupHash: string,
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
        const encryptedBlob = await CacheService.getBlob(lookupHash, notebookId, entry.uuid)

        if (!encryptedBlob) {
          errors.push(`Blob ${entry.uuid} not found in cache`)
          onProgress(i + 1, entries.length)
          continue
        }

        // Upload encrypted blob to remote
        await RemoteService.upsertBlob(notebookId, entry.uuid, encryptedBlob, signal)

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
   * Delete blobs from remote
   */
  private static async deleteBlobsRemotely(
    notebookId: string,
    uuids: string[],
    signal: AbortSignal | undefined,
    onProgress: (current: number, total: number) => void,
    errors: string[],
  ): Promise<number> {
    let deleted = 0

    for (let i = 0; i < uuids.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('Sync cancelled', 'AbortError')
      }

      const uuid = uuids[i]
      try {
        // Delete blob from remote
        await RemoteService.deleteBlob(notebookId, uuid, signal)

        deleted++
        onProgress(i + 1, uuids.length)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }
        const errorMessage = `Failed to delete blob ${uuid} from remote: ${error}`
        errors.push(errorMessage)
        onProgress(i + 1, uuids.length)
      }
    }

    return deleted
  }

  /**
   * Delete blobs from cache
   */
  private static async deleteBlobsLocally(
    lookupHash: string,
    notebookId: string,
    uuids: string[],
    signal: AbortSignal | undefined,
    onProgress: (current: number, total: number) => void,
    errors: string[],
  ): Promise<number> {
    let deleted = 0

    for (let i = 0; i < uuids.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('Sync cancelled', 'AbortError')
      }

      const uuid = uuids[i]
      try {
        // Delete blob from cache
        await CacheService.deleteBlob(lookupHash, notebookId, uuid)

        deleted++
        onProgress(i + 1, uuids.length)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error
        }
        const errorMessage = `Failed to delete blob ${uuid} from cache: ${error}`
        errors.push(errorMessage)
        onProgress(i + 1, uuids.length)
      }
    }

    return deleted
  }

  /**
   * Perform full sync operation
   * Syncs notebook meta, manifest, and blobs
   */
  static async sync(options: SyncOptions): Promise<SyncResult> {
    const { notebookId, lookupHash, fek, onProgress, signal } = options
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Phase 0: Sync notebook meta (unencrypted)
      try {
        let remoteNotebookMeta: NotebookMeta | null = null
        let cachedNotebookMeta: NotebookMeta | null = null

        try {
          remoteNotebookMeta = await RemoteService.getNotebookMeta(notebookId, signal)
        } catch {
          // Remote notebook meta doesn't exist - will upload from cache
        }

        cachedNotebookMeta = await CacheService.getNotebookMeta(lookupHash, notebookId)

        // Sync notebook meta (cache is source of truth if both exist)
        if (cachedNotebookMeta) {
          // Upload to remote if missing or different
          if (
            !remoteNotebookMeta ||
            JSON.stringify(remoteNotebookMeta) !== JSON.stringify(cachedNotebookMeta)
          ) {
            await RemoteService.upsertNotebookMeta(notebookId, cachedNotebookMeta, signal)
          }
        } else if (remoteNotebookMeta) {
          // Download to cache if missing
          await CacheService.upsertNotebookMeta(lookupHash, notebookId, remoteNotebookMeta)
        } else {
          errors.push('Notebook meta not found in either remote or cache')
        }
      } catch (error) {
        const errorMessage = `Failed to sync notebook meta: ${error instanceof Error ? error.message : String(error)}`
        errors.push(errorMessage)
      }

      // Phase 1: Fetch manifests
      this.notifyProgress(onProgress, {
        phase: 'fetching_manifest',
        current: 0,
        total: 2,
      })

      // Fetch both manifests, handling missing files gracefully
      let remoteManifestEncrypted: ArrayBuffer | null = null
      let cachedManifestEncrypted: ArrayBuffer | null = null

      try {
        remoteManifestEncrypted = await RemoteService.getManifest(notebookId, signal)
      } catch {
        // Remote manifest doesn't exist - will upload from cache
      }

      cachedManifestEncrypted = await CacheService.getManifest(lookupHash, notebookId)

      this.notifyProgress(onProgress, {
        phase: 'fetching_manifest',
        current: 2,
        total: 2,
      })

      // Decrypt manifests if they exist
      let remoteManifest: Manifest | null = null
      if (remoteManifestEncrypted) {
        const remoteManifestDecrypted = await CryptoService.unpackAndDecrypt(
          remoteManifestEncrypted,
          fek,
        )
        const remoteManifestText = new TextDecoder().decode(remoteManifestDecrypted)
        remoteManifest = JSON.parse(remoteManifestText) as Manifest
      }

      let cachedManifest: Manifest | null = null
      if (cachedManifestEncrypted) {
        const cachedManifestDecrypted = await CryptoService.unpackAndDecrypt(
          cachedManifestEncrypted,
          fek,
        )
        const cachedManifestText = new TextDecoder().decode(cachedManifestDecrypted)
        cachedManifest = JSON.parse(cachedManifestText) as Manifest
      }

      // Handle case where neither manifest exists
      if (!remoteManifest && !cachedManifest) {
        throw new Error('Manifest not found in either remote or cache')
      }

      // Phase 2: Compare manifests
      this.notifyProgress(onProgress, {
        phase: 'comparing',
        current: 0,
        total: 1,
      })

      // Determine sync actions based on which manifests exist
      let syncActions: {
        toDownload: ManifestEntry[]
        toUpload: ManifestEntry[]
        toDeleteRemotely: string[]
        toDeleteLocally: string[]
      }

      syncActions = await this.compareManifests(
        cachedManifest,
        remoteManifest,
        lookupHash,
        notebookId,
      )

      this.notifyProgress(onProgress, {
        phase: 'comparing',
        current: 1,
        total: 1,
      })

      // Phase 3: Download missing/updated blobs
      let downloaded = 0
      if (syncActions.toDownload.length > 0) {
        downloaded = await this.downloadBlobs(
          lookupHash,
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
          lookupHash,
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

      // Phase 5: Delete blobs from remote
      let deletedRemotely = 0
      if (syncActions.toDeleteRemotely.length > 0) {
        deletedRemotely = await this.deleteBlobsRemotely(
          notebookId,
          syncActions.toDeleteRemotely,
          signal,
          (current, total) => {
            this.notifyProgress(onProgress, {
              phase: 'deleting_remote',
              current,
              total,
            })
          },
          errors,
        )
      }

      // Phase 6: Delete blobs from cache
      let deletedLocally = 0
      if (syncActions.toDeleteLocally.length > 0) {
        deletedLocally = await this.deleteBlobsLocally(
          lookupHash,
          notebookId,
          syncActions.toDeleteLocally,
          signal,
          (current, total) => {
            this.notifyProgress(onProgress, {
              phase: 'deleting_local',
              current,
              total,
            })
          },
          errors,
        )
      }

      // Phase 7: Merge manifests and save
      this.notifyProgress(onProgress, {
        phase: 'saving_manifest',
        current: 0,
        total: 1,
      })

      // Determine the final manifest to save
      let mergedManifest: Manifest
      let conflicts = 0

      if (remoteManifest && cachedManifest) {
        // Both exist - merge them
        const mergeResult = ManifestService.merge(cachedManifest, remoteManifest)
        mergedManifest = mergeResult.manifest
        conflicts = mergeResult.conflicts
      } else if (remoteManifest) {
        // Only remote exists - use it as the merged manifest
        mergedManifest = remoteManifest
      } else if (cachedManifest) {
        // Only cache exists - use it as the merged manifest
        mergedManifest = cachedManifest
      } else {
        // Neither exists (already handled above)
        throw new Error('Manifest not found in either remote or cache')
      }

      // Encrypt merged manifest
      const mergedManifestText = JSON.stringify(mergedManifest, null, 2)
      const mergedManifestBytes = new TextEncoder().encode(mergedManifestText)
      const encryptedMergedManifest = await CryptoService.encryptAndPack(mergedManifestBytes, fek)

      // Save to both remote and cache
      await Promise.all([
        RemoteService.upsertManifest(notebookId, encryptedMergedManifest, signal),
        CacheService.upsertManifest(lookupHash, notebookId, encryptedMergedManifest),
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
        deletedRemotely,
        deletedLocally,
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
        deletedRemotely: 0,
        deletedLocally: 0,
        conflicts: 0,
        errors,
        duration,
      }
    }
  }

  /**
   * Sync root-level data (root meta and map)
   * Root meta is unencrypted JSON, map is encrypted with MEK
   */
  static async syncRoot(options: RootSyncOptions): Promise<SyncResult> {
    const { lookupHash, mek, onProgress, signal } = options
    const startTime = Date.now()
    const errors: string[] = []

    try {
      this.notifyProgress(onProgress, {
        phase: 'syncing_root',
        current: 0,
        total: 4,
      })

      // Phase 1: Fetch root meta from both sources
      let remoteRootMeta: RootMeta | null = null
      let cachedRootMeta: RootMeta | null = null

      try {
        remoteRootMeta = await RemoteService.getRootMeta(signal)
      } catch {
        // Remote root meta doesn't exist - will upload from cache
      }

      cachedRootMeta = await CacheService.getRootMeta(lookupHash)

      this.notifyProgress(onProgress, {
        phase: 'syncing_root',
        current: 1,
        total: 4,
      })

      // Determine which root meta to use (cache should be source of truth if both exist)
      if (cachedRootMeta) {
        // Upload to remote if missing or different
        if (!remoteRootMeta || JSON.stringify(remoteRootMeta) !== JSON.stringify(cachedRootMeta)) {
          await RemoteService.upsertRootMeta(cachedRootMeta, signal)
        }
      } else if (remoteRootMeta) {
        // Download to cache if missing
        await CacheService.upsertRootMeta(lookupHash, remoteRootMeta)
      } else {
        errors.push('Root meta not found in either remote or cache')
      }

      this.notifyProgress(onProgress, {
        phase: 'syncing_root',
        current: 2,
        total: 4,
      })

      // Phase 2: Fetch encrypted maps from both sources
      let remoteMapEncrypted: ArrayBuffer | null = null
      let cachedMapEncrypted: ArrayBuffer | null = null

      try {
        remoteMapEncrypted = await RemoteService.getMap(signal)
      } catch {
        // Remote map doesn't exist - will upload from cache
      }

      cachedMapEncrypted = await CacheService.getMap(lookupHash)

      // Decrypt maps if they exist
      let remoteMap: Map | null = null
      if (remoteMapEncrypted) {
        const remoteMapDecrypted = await CryptoService.unpackAndDecrypt(remoteMapEncrypted, mek)
        const remoteMapText = new TextDecoder().decode(remoteMapDecrypted)
        remoteMap = JSON.parse(remoteMapText) as Map
      }

      let cachedMap: Map | null = null
      if (cachedMapEncrypted) {
        const cachedMapDecrypted = await CryptoService.unpackAndDecrypt(cachedMapEncrypted, mek)
        const cachedMapText = new TextDecoder().decode(cachedMapDecrypted)
        cachedMap = JSON.parse(cachedMapText) as Map
      }

      this.notifyProgress(onProgress, {
        phase: 'syncing_root',
        current: 3,
        total: 4,
      })

      // Merge maps and save
      let finalMap: Map
      let conflicts = 0

      if (remoteMap && cachedMap) {
        // Both exist - merge them
        const mergeResult = MapService.merge(cachedMap, remoteMap)
        finalMap = mergeResult.map
        conflicts = mergeResult.conflicts
      } else if (remoteMap) {
        // Only remote exists
        finalMap = remoteMap
      } else if (cachedMap) {
        // Only cache exists
        finalMap = cachedMap
      } else {
        errors.push('Map not found in either remote or cache')
        // Create an empty map as fallback
        finalMap = MapService.create()
      }

      // Encrypt and save final map to both locations
      const finalMapText = JSON.stringify(finalMap, null, 2)
      const finalMapBytes = new TextEncoder().encode(finalMapText)
      const encryptedFinalMap = await CryptoService.encryptAndPack(finalMapBytes, mek)

      await Promise.all([
        RemoteService.upsertMap(encryptedFinalMap, signal),
        CacheService.upsertMap(lookupHash, encryptedFinalMap),
      ])

      this.notifyProgress(onProgress, {
        phase: 'syncing_root',
        current: 4,
        total: 4,
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
        downloaded: 0, // Not tracking individual file downloads for root sync
        uploaded: 0, // Not tracking individual file uploads for root sync
        deletedRemotely: 0, // Root sync doesn't delete blobs
        deletedLocally: 0, // Root sync doesn't delete blobs
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
        deletedRemotely: 0,
        deletedLocally: 0,
        conflicts: 0,
        errors,
        duration,
      }
    }
  }
}
