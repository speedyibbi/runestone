import { defineStore } from 'pinia'
import NotebookService from '@/services/notebook'
import RemoteService from '@/services/remote'
import CacheService from '@/services/cache'
import CryptoService from '@/services/crypto'
import SyncService, { type SyncProgress, type SyncResult } from '@/services/sync'
import ManifestService, { type Manifest, type ManifestEntry } from '@/services/manifest'

/**
 * Manager Store State Interface
 */
interface ManagerState {
  // Session state
  activeNotebookId: string | null
  fek: CryptoKey | null
  isUnlocked: boolean

  // Decrypted data (in memory only)
  decryptedManifest: Manifest | null
  decryptedBlobs: Map<
    string,
    {
      content: ArrayBuffer
      timestamp: number
    }
  >

  // Sync state
  syncStatus: 'idle' | 'syncing' | 'error'
  lastSyncTime: number | null
  syncProgress: SyncProgress | null
}

/**
 * Manager Store
 * Central orchestrator for all notebook operations
 * Stores FEK and decrypted content in memory only
 */
export const useManagerStore = defineStore('manager', {
  state: (): ManagerState => ({
    activeNotebookId: null,
    fek: null,
    isUnlocked: false,
    decryptedManifest: null,
    decryptedBlobs: new Map(),
    syncStatus: 'idle',
    lastSyncTime: null,
    syncProgress: null,
  }),

  getters: {
    /**
     * Get list of all notes
     */
    notes: (state): ManifestEntry[] => {
      return state.decryptedManifest?.entries.filter((e) => e.type === 'note') ?? []
    },

    /**
     * Get list of all images
     */
    images: (state): ManifestEntry[] => {
      return state.decryptedManifest?.entries.filter((e) => e.type === 'image') ?? []
    },

    /**
     * Is the store ready for operations?
     */
    isReady: (state): boolean => {
      return state.isUnlocked && state.fek !== null && state.decryptedManifest !== null
    },

    /**
     * Is sync in progress?
     */
    isSyncing: (state): boolean => {
      return state.syncStatus === 'syncing'
    },
  },

  actions: {
    /**
     * Discover all available notebooks
     */
    async discoverNotebooks(forceRefresh = false): Promise<string[]> {
      return await NotebookService.discoverNotebooks(forceRefresh)
    },

    /**
     * Create a new notebook and automatically unlock it
     */
    async createNotebook(
      email: string,
      passphrase: string,
      signal?: AbortSignal,
    ): Promise<string> {
      const { notebookId, fek, meta } = await NotebookService.initializeNotebook(
        email,
        passphrase,
        undefined,
        signal,
      )

      // Automatically unlock the new notebook
      this.activeNotebookId = notebookId
      this.fek = fek
      this.isUnlocked = true

      // Load the empty manifest
      await this.loadManifest()

      // Trigger initial sync
      await this.sync()

      return notebookId
    },

    /**
     * Unlock a notebook with passphrase
     */
    async unlock(notebookId: string, passphrase: string, signal?: AbortSignal): Promise<void> {
      try {
        // Load notebook and get FEK
        const { fek, meta } = await NotebookService.loadNotebook(notebookId, passphrase, signal)

        // Set session state
        this.activeNotebookId = notebookId
        this.fek = fek
        this.isUnlocked = true

        // Load and decrypt manifest
        await this.loadManifest()

        // Trigger initial sync
        await this.sync()
      } catch (error) {
        // Clean up on failure
        this.lock()
        throw error
      }
    },

    /**
     * Lock the notebook and clear all sensitive data from memory
     */
    lock(): void {
      // Clear FEK - CRITICAL for security
      this.fek = null

      // Clear decrypted data
      this.decryptedManifest = null
      this.decryptedBlobs.clear()

      // Reset session state
      this.activeNotebookId = null
      this.isUnlocked = false

      // Reset sync state
      this.syncStatus = 'idle'
      this.lastSyncTime = null
      this.syncProgress = null
    },

    /**
     * Load and decrypt the manifest (internal method)
     */
    async loadManifest(): Promise<void> {
      if (!this.fek || !this.activeNotebookId) {
        throw new Error('No active session')
      }

      // Try to get from cache first
      let encryptedManifest = await CacheService.getManifest(this.activeNotebookId)

      // If not in cache, fetch from remote
      if (!encryptedManifest) {
        encryptedManifest = await RemoteService.getManifest(this.activeNotebookId)
        await CacheService.saveManifest(this.activeNotebookId, encryptedManifest)
      }

      // Decrypt manifest
      const decrypted = await CryptoService.unpackAndDecrypt(encryptedManifest, this.fek)
      const manifestText = new TextDecoder().decode(decrypted)
      this.decryptedManifest = JSON.parse(manifestText) as Manifest
    },

    /**
     * Save manifest to cache and remote (internal helper)
     */
    async saveManifest(): Promise<void> {
      if (!this.fek || !this.activeNotebookId || !this.decryptedManifest) {
        throw new Error('No active session')
      }

      // Encrypt manifest
      const manifestText = JSON.stringify(this.decryptedManifest, null, 2)
      const manifestBytes = new TextEncoder().encode(manifestText)
      const encryptedManifest = await CryptoService.encryptAndPack(manifestBytes, this.fek)

      // Save to cache and remote
      await Promise.all([
        CacheService.saveManifest(this.activeNotebookId, encryptedManifest),
        RemoteService.putManifest(this.activeNotebookId, encryptedManifest),
      ])
    },

    /**
     * Update a manifest entry
     */
    async updateManifestEntry(entry: ManifestEntry): Promise<void> {
      if (!this.fek || !this.activeNotebookId || !this.decryptedManifest) {
        throw new Error('No active session')
      }

      // Use ManifestService to update the manifest immutably
      const existingEntry = ManifestService.findEntry(this.decryptedManifest, entry.uuid)
      
      if (existingEntry) {
        // Update existing entry
        this.decryptedManifest = ManifestService.updateEntry(
          this.decryptedManifest,
          entry.uuid,
          {
            type: entry.type,
            title: entry.title,
            hash: entry.hash,
            size: entry.size,
          }
        )
      } else {
        // Add new entry (this shouldn't normally happen as saveBlob handles creation)
        const { manifest } = ManifestService.addEntry(this.decryptedManifest, {
          type: entry.type,
          title: entry.title,
          hash: entry.hash,
          size: entry.size,
        })
        this.decryptedManifest = manifest
      }

      // Encrypt and save manifest
      await this.saveManifest()
    },

    /**
     * Remove a manifest entry
     */
    async removeManifestEntry(uuid: string): Promise<void> {
      if (!this.fek || !this.activeNotebookId || !this.decryptedManifest) {
        throw new Error('No active session')
      }

      // Use ManifestService to remove entry
      this.decryptedManifest = ManifestService.removeEntry(this.decryptedManifest, uuid)

      // Encrypt and save manifest
      await this.saveManifest()
    },

    /**
     * Get decrypted blob content (with in-memory caching)
     */
    async getBlob(uuid: string, signal?: AbortSignal): Promise<ArrayBuffer> {
      // Check in-memory cache first
      const cached = this.decryptedBlobs.get(uuid)
      if (cached) {
        return cached.content
      }

      if (!this.fek || !this.activeNotebookId) {
        throw new Error('No active session')
      }

      // Get encrypted blob from cache or remote
      let encryptedBlob = await CacheService.getBlob(this.activeNotebookId, uuid)
      if (!encryptedBlob) {
        encryptedBlob = await RemoteService.getBlob(this.activeNotebookId, uuid, signal)
        await CacheService.saveBlob(this.activeNotebookId, uuid, encryptedBlob)
      }

      // Decrypt blob
      const decrypted = await CryptoService.unpackAndDecrypt(encryptedBlob, this.fek)

      // Store in memory cache
      this.decryptedBlobs.set(uuid, {
        content: decrypted,
        timestamp: Date.now(),
      })

      return decrypted
    },

    /**
     * Save blob (encrypt and upload)
     */
    async saveBlob(
      uuid: string,
      content: ArrayBuffer,
      metadata: {
        title: string
        type: 'note' | 'image'
      },
      signal?: AbortSignal,
    ): Promise<void> {
      if (!this.fek || !this.activeNotebookId || !this.decryptedManifest) {
        throw new Error('No active session')
      }

      // Encrypt content
      const encrypted = await CryptoService.encryptAndPack(content, this.fek)

      // Save to cache and remote (parallel)
      await Promise.all([
        CacheService.saveBlob(this.activeNotebookId, uuid, encrypted),
        RemoteService.putBlob(this.activeNotebookId, uuid, encrypted, signal),
      ])

      // Update in-memory cache
      this.decryptedBlobs.set(uuid, {
        content,
        timestamp: Date.now(),
      })

      // Use ManifestService to compute hash
      const hash = await ManifestService.computeHash(content)

      // Check if entry exists
      const existingEntry = ManifestService.findEntry(this.decryptedManifest, uuid)

      if (existingEntry) {
        // Update existing entry
        this.decryptedManifest = ManifestService.updateEntry(
          this.decryptedManifest,
          uuid,
          {
            type: metadata.type,
            title: metadata.title,
            hash,
            size: content.byteLength,
          }
        )
      } else {
        // Add new entry
        const { manifest } = ManifestService.addEntry(this.decryptedManifest, {
          type: metadata.type,
          title: metadata.title,
          hash,
          size: content.byteLength,
        })
        this.decryptedManifest = manifest
      }

      // Encrypt and save manifest
      await this.saveManifest()
    },

    /**
     * Delete blob
     */
    async deleteBlob(uuid: string, signal?: AbortSignal): Promise<void> {
      if (!this.fek || !this.activeNotebookId) {
        throw new Error('No active session')
      }

      // Delete from remote and cache
      await Promise.all([
        RemoteService.deleteBlob(this.activeNotebookId, uuid, signal),
        CacheService.deleteBlob(this.activeNotebookId, uuid),
      ])

      // Remove from memory cache
      this.decryptedBlobs.delete(uuid)

      // Remove from manifest
      await this.removeManifestEntry(uuid)
    },

    /**
     * Synchronize with remote
     */
    async sync(signal?: AbortSignal): Promise<SyncResult | null> {
      // Guard: only one sync at a time
      if (this.syncStatus === 'syncing') {
        return null
      }

      if (!this.fek || !this.activeNotebookId) {
        throw new Error('No active session')
      }

      this.syncStatus = 'syncing'
      this.syncProgress = null

      try {
        const result = await SyncService.sync({
          notebookId: this.activeNotebookId,
          fek: this.fek,
          onProgress: (progress) => {
            this.syncProgress = progress
          },
          signal,
        })

        // Reload manifest after sync (may have merged changes)
        await this.loadManifest()

        // Clear decrypted blob cache (they may be stale)
        this.decryptedBlobs.clear()

        // Update state
        this.lastSyncTime = Date.now()
        this.syncStatus = 'idle'
        this.syncProgress = null

        return result
      } catch (error) {
        this.syncStatus = 'error'
        this.syncProgress = null
        throw error
      }
    },

    /**
     * Get a note's content as text (convenience method)
     */
    async getNoteText(uuid: string, signal?: AbortSignal): Promise<string> {
      const content = await this.getBlob(uuid, signal)
      return new TextDecoder().decode(content)
    },

    /**
     * Save a note's text content (convenience method)
     */
    async saveNoteText(
      uuid: string,
      text: string,
      title: string,
      signal?: AbortSignal,
    ): Promise<void> {
      const content = new TextEncoder().encode(text)
      await this.saveBlob(uuid, content.buffer, { title, type: 'note' }, signal)
    },

    /**
     * Clear notebook list cache
     */
    clearNotebookListCache(): void {
      CacheService.clearNotebookListCache()
    },
  },
})
