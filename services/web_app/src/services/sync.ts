import type { Manifest, ManifestEntry } from '@/services/notebook'
import NotebookService from '@/services/notebook'
import ManifestManager from '@/services/manifest'
import OPFSService from '@/services/opfs'
import CryptoService from '@/services/crypto'
import FileService from '@/services/file'

/**
 * Sync status information
 */
export interface SyncStatus {
  inProgress: boolean
  lastSyncTime: string | null
  error: string | null
  progress: {
    phase: 'idle' | 'fetching' | 'comparing' | 'downloading' | 'uploading' | 'saving'
    current: number
    total: number
  }
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
 * Options for sync operation
 */
export interface SyncOptions {
  notebookId: string
  fek: CryptoKey
  onProgress?: (status: SyncStatus) => void
  downloadOnly?: boolean // Only download, don't upload
  uploadOnly?: boolean // Only upload, don't download
}

/**
 * SyncService handles synchronization between remote server and local OPFS cache
 * Implements Last-Write-Wins conflict resolution strategy
 */
export default class SyncService {
  private static currentSync: Map<string, Promise<SyncResult>> = new Map()
  private static syncStatus: Map<string, SyncStatus> = new Map()
  private static readonly IV_LENGTH = __APP_CONFIG__.crypto.aes.ivLength
  private static readonly TAG_LENGTH = __APP_CONFIG__.crypto.aes.tagLength

  /**
   * Get current sync status for a notebook
   */
  static getSyncStatus(notebookId: string): SyncStatus {
    return (
      this.syncStatus.get(notebookId) ?? {
        inProgress: false,
        lastSyncTime: null,
        error: null,
        progress: {
          phase: 'idle',
          current: 0,
          total: 0,
        },
      }
    )
  }

  /**
   * Update sync status
   */
  private static updateStatus(
    notebookId: string,
    updates: Partial<SyncStatus>,
  ): void {
    const current = this.getSyncStatus(notebookId)
    const updated = { ...current, ...updates }
    this.syncStatus.set(notebookId, updated)
  }

  /**
   * Perform full sync operation
   */
  static async sync(options: SyncOptions): Promise<SyncResult> {
    const { notebookId, fek, onProgress, downloadOnly, uploadOnly } = options

    // Check if sync is already in progress
    const existingSync = this.currentSync.get(notebookId)
    if (existingSync) {
      return existingSync
    }

    const startTime = Date.now()
    const errors: string[] = []

    // Initialize status
    this.updateStatus(notebookId, {
      inProgress: true,
      error: null,
      progress: { phase: 'fetching', current: 0, total: 0 },
    })
    this.notifyProgress(notebookId, onProgress)

    const syncPromise = (async (): Promise<SyncResult> => {
      try {
        // Step 1: Fetch remote manifest
        this.updateStatus(notebookId, {
          progress: { phase: 'fetching', current: 0, total: 1 },
        })
        this.notifyProgress(notebookId, onProgress)

        const remoteManifest = await NotebookService.getManifest(notebookId, fek)

        // Step 2: Get local manifest from OPFS
        const localManifestEncrypted = await OPFSService.getManifest(notebookId)
        let localManifest: Manifest | null = null

        if (localManifestEncrypted) {
          // Decrypt local manifest
          const nonceLength = this.IV_LENGTH
          const tagLength = this.TAG_LENGTH / 8
          const tagStart = localManifestEncrypted.byteLength - tagLength

          const nonce = new Uint8Array(localManifestEncrypted.slice(0, nonceLength))
          const ciphertext = localManifestEncrypted.slice(nonceLength, tagStart)
          const tag = new Uint8Array(localManifestEncrypted.slice(tagStart))

          const decrypted = await CryptoService.decryptBlob(
            { ciphertext, nonce, tag },
            fek,
          )
          const manifestText = new TextDecoder().decode(decrypted)
          localManifest = JSON.parse(manifestText) as Manifest
        }

        // Step 3: Compare manifests and determine sync actions
        this.updateStatus(notebookId, {
          progress: { phase: 'comparing', current: 0, total: 1 },
        })
        this.notifyProgress(notebookId, onProgress)

        const syncActions = this.compareManifests(
          localManifest,
          remoteManifest,
          downloadOnly,
          uploadOnly,
        )

        // Step 4: Download missing/updated blobs
        if (!uploadOnly && syncActions.toDownload.length > 0) {
          await this.downloadBlobs(
            notebookId,
            fek,
            syncActions.toDownload,
            (current, total) => {
              this.updateStatus(notebookId, {
                progress: {
                  phase: 'downloading',
                  current,
                  total,
                },
              })
              this.notifyProgress(notebookId, onProgress)
            },
            errors,
          )
        }

        // Step 5: Upload new/modified blobs
        if (!downloadOnly && syncActions.toUpload.length > 0) {
          await this.uploadBlobs(
            notebookId,
            fek,
            syncActions.toUpload,
            (current, total) => {
              this.updateStatus(notebookId, {
                progress: {
                  phase: 'uploading',
                  current,
                  total,
                },
              })
              this.notifyProgress(notebookId, onProgress)
            },
            errors,
          )
        }

        // Step 6: Merge manifests and save
        this.updateStatus(notebookId, {
          progress: { phase: 'saving', current: 0, total: 1 },
        })
        this.notifyProgress(notebookId, onProgress)

        await this.mergeAndSaveManifests(
          notebookId,
          fek,
          localManifest,
          remoteManifest,
        )

        const duration = Date.now() - startTime

        // Update status
        this.updateStatus(notebookId, {
          inProgress: false,
          lastSyncTime: new Date().toISOString(),
          error: errors.length > 0 ? errors.join('; ') : null,
          progress: { phase: 'idle', current: 0, total: 0 },
        })
        this.notifyProgress(notebookId, onProgress)

        return {
          success: errors.length === 0,
          downloaded: syncActions.toDownload.length,
          uploaded: syncActions.toUpload.length,
          conflicts: syncActions.conflicts,
          errors,
          duration,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push(errorMessage)

        this.updateStatus(notebookId, {
          inProgress: false,
          error: errorMessage,
          progress: { phase: 'idle', current: 0, total: 0 },
        })
        this.notifyProgress(notebookId, onProgress)

        return {
          success: false,
          downloaded: 0,
          uploaded: 0,
          conflicts: 0,
          errors,
          duration,
        }
      } finally {
        this.currentSync.delete(notebookId)
      }
    })()

    this.currentSync.set(notebookId, syncPromise)
    return syncPromise
  }

  /**
   * Compare local and remote manifests to determine sync actions
   */
  private static compareManifests(
    localManifest: Manifest | null,
    remoteManifest: Manifest,
    downloadOnly?: boolean,
    uploadOnly?: boolean,
  ): {
    toDownload: ManifestEntry[]
    toUpload: ManifestEntry[]
    conflicts: number
  } {
    const toDownload: ManifestEntry[] = []
    const toUpload: ManifestEntry[] = []
    let conflicts = 0

    if (!localManifest) {
      // No local manifest - download everything
      if (!uploadOnly) {
        toDownload.push(...remoteManifest.entries)
      }
      return { toDownload, toUpload, conflicts }
    }

    const localEntries = new Map<string, ManifestEntry>()
    for (const entry of localManifest.entries) {
      localEntries.set(entry.uuid, entry)
    }

    const remoteEntries = new Map<string, ManifestEntry>()
    for (const entry of remoteManifest.entries) {
      remoteEntries.set(entry.uuid, entry)
    }

    // Check remote entries (download if missing or outdated locally)
    if (!uploadOnly) {
      for (const remoteEntry of remoteManifest.entries) {
        const localEntry = localEntries.get(remoteEntry.uuid)

        if (!localEntry) {
          // Entry doesn't exist locally - download
          toDownload.push(remoteEntry)
        } else {
          // Compare timestamps (Last-Write-Wins)
          const localTime = new Date(localEntry.last_modified).getTime()
          const remoteTime = new Date(remoteEntry.last_modified).getTime()

          if (remoteTime > localTime) {
            // Remote is newer - download
            toDownload.push(remoteEntry)
            conflicts++
          } else if (remoteTime < localTime && remoteEntry.hash !== localEntry.hash) {
            // Local is newer but hashes differ - this will be handled in upload phase
            // Just note the conflict
            conflicts++
          }
        }
      }
    }

    // Check local entries (upload if missing or newer remotely)
    if (!downloadOnly) {
      for (const localEntry of localManifest.entries) {
        const remoteEntry = remoteEntries.get(localEntry.uuid)

        if (!remoteEntry) {
          // Entry doesn't exist remotely - upload
          toUpload.push(localEntry)
        } else {
          // Compare timestamps
          const localTime = new Date(localEntry.last_modified).getTime()
          const remoteTime = new Date(remoteEntry.last_modified).getTime()

          if (localTime > remoteTime && localEntry.hash !== remoteEntry.hash) {
            // Local is newer - upload
            toUpload.push(localEntry)
          }
        }
      }
    }

    return { toDownload, toUpload, conflicts }
  }

  /**
   * Download blobs from remote server
   */
  private static async downloadBlobs(
    notebookId: string,
    fek: CryptoKey,
    entries: ManifestEntry[],
    onProgress: (current: number, total: number) => void,
    errors: string[],
  ): Promise<void> {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        // Check if blob already exists in OPFS and has correct hash
        const cachedBlob = await OPFSService.getBlob(notebookId, entry.uuid)
        if (cachedBlob) {
          // Verify hash by decrypting and recomputing
          const nonceLength = this.IV_LENGTH
          const tagLength = this.TAG_LENGTH / 8
          const tagStart = cachedBlob.byteLength - tagLength

          const nonce = new Uint8Array(cachedBlob.slice(0, nonceLength))
          const ciphertext = cachedBlob.slice(nonceLength, tagStart)
          const tag = new Uint8Array(cachedBlob.slice(tagStart))

          const decrypted = await CryptoService.decryptBlob(
            { ciphertext, nonce, tag },
            fek,
          )
          const computedHash = await NotebookService.computeHash(decrypted)

          if (computedHash === entry.hash) {
            // Blob is already cached and correct - skip download
            onProgress(i + 1, entries.length)
            continue
          }
        }

        // Download encrypted blob directly from server
        const blobPath = `${notebookId}/blobs/${entry.uuid}.enc`
        const response = await FileService.getFile(blobPath)
        const encryptedBlob = await response.arrayBuffer()

        // Save encrypted blob directly to OPFS (no need to decrypt/re-encrypt)
        await OPFSService.saveBlob(notebookId, entry.uuid, encryptedBlob)

        onProgress(i + 1, entries.length)
      } catch (error) {
        const errorMessage = `Failed to download blob ${entry.uuid}: ${error}`
        errors.push(errorMessage)
        console.error(errorMessage)
      }
    }
  }

  /**
   * Upload blobs to remote server
   */
  private static async uploadBlobs(
    notebookId: string,
    fek: CryptoKey,
    entries: ManifestEntry[],
    onProgress: (current: number, total: number) => void,
    errors: string[],
  ): Promise<void> {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        // Get blob from OPFS
        const encryptedBlob = await OPFSService.getBlob(notebookId, entry.uuid)

        if (!encryptedBlob) {
          errors.push(`Blob ${entry.uuid} not found in local cache`)
          continue
        }

        // Decrypt blob for upload
        const nonceLength = this.IV_LENGTH
        const tagLength = this.TAG_LENGTH / 8
        const tagStart = encryptedBlob.byteLength - tagLength

        const nonce = new Uint8Array(encryptedBlob.slice(0, nonceLength))
        const ciphertext = encryptedBlob.slice(nonceLength, tagStart)
        const tag = new Uint8Array(encryptedBlob.slice(tagStart))

        const decrypted = await CryptoService.decryptBlob(
          { ciphertext, nonce, tag },
          fek,
        )

        // Upload to server (NotebookService.uploadBlob expects decrypted data)
        await NotebookService.uploadBlob(notebookId, entry.uuid, decrypted, fek)

        onProgress(i + 1, entries.length)
      } catch (error) {
        const errorMessage = `Failed to upload blob ${entry.uuid}: ${error}`
        errors.push(errorMessage)
        console.error(errorMessage)
      }
    }
  }

  /**
   * Merge manifests and save to both remote and local
   */
  private static async mergeAndSaveManifests(
    notebookId: string,
    fek: CryptoKey,
    localManifest: Manifest | null,
    remoteManifest: Manifest,
  ): Promise<Manifest> {
    // Start with remote manifest as base
    const manager = new ManifestManager(remoteManifest)

    // Merge local entries (LWW - entries that are newer locally will overwrite)
    if (localManifest) {
      manager.mergeEntries(localManifest.entries)
    }

    const mergedManifest = manager.getManifest()

    // Save to remote server
    await NotebookService.putManifest(notebookId, mergedManifest, fek)

    // Encrypt and save to OPFS
    const manifestText = JSON.stringify(mergedManifest, null, 2)
    const manifestBytes = new TextEncoder().encode(manifestText)
    const encrypted = await CryptoService.encryptBlob(manifestBytes, fek)

    // Combine nonce + ciphertext + tag
    const combined = new Uint8Array(
      encrypted.nonce.byteLength +
        encrypted.ciphertext.byteLength +
        encrypted.tag.byteLength,
    )
    combined.set(new Uint8Array(encrypted.nonce), 0)
    combined.set(
      new Uint8Array(encrypted.ciphertext),
      encrypted.nonce.byteLength,
    )
    combined.set(
      encrypted.tag,
      encrypted.nonce.byteLength + encrypted.ciphertext.byteLength,
    )

    await OPFSService.saveManifest(notebookId, combined)

    return mergedManifest
  }

  /**
   * Notify progress callback if provided
   */
  private static notifyProgress(
    notebookId: string,
    onProgress?: (status: SyncStatus) => void,
  ): void {
    if (onProgress) {
      const status = this.getSyncStatus(notebookId)
      onProgress(status)
    }
  }

  /**
   * Cancel ongoing sync operation
   */
  static cancelSync(notebookId: string): void {
    // Note: This is a placeholder - actual cancellation would require
    // abort controllers for fetch operations
    this.updateStatus(notebookId, {
      inProgress: false,
      error: 'Sync cancelled',
      progress: { phase: 'idle', current: 0, total: 0 },
    })
    this.currentSync.delete(notebookId)
  }

  /**
   * Clean up orphaned blobs after sync
   */
  static async cleanupOrphanedBlobs(notebookId: string): Promise<number> {
    // Get manifest from OPFS
    const manifestEncrypted = await OPFSService.getManifest(notebookId)
    if (!manifestEncrypted) {
      return 0
    }

    // We need FEK to decrypt, but we can't store it
    // This method should be called after sync when FEK is available
    // For now, return 0 - caller should handle this differently
    return 0
  }
}

