import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import NotebookService, {
  type Manifest,
  type ManifestEntry,
  type MetaJson,
  type NotebookInitParams,
} from '@/services/notebook'

/**
 * NotebookStore manages notebook state and encryption keys
 * KEK and FEK are stored ONLY in memory - never persisted
 * Decrypted data is stored ONLY in memory - never persisted
 */
export const useNotebookStore = defineStore('notebook', () => {
  // In-memory only - NEVER persisted
  const fek = ref<CryptoKey | null>(null)
  const manifest = ref<Manifest | null>(null)
  const meta = ref<MetaJson | null>(null)

  // Can be persisted (non-sensitive)
  const notebookId = ref<string | null>(null)
  const email = ref<string | null>(null)

  /**
   * Check if user is authenticated (has FEK loaded)
   */
  const isAuthenticated = computed(() => fek.value !== null)

  /**
   * Check if notebook is loaded
   */
  const isNotebookLoaded = computed(() => notebookId.value !== null && manifest.value !== null)

  /**
   * Get current notebook ID
   */
  const currentNotebookId = computed(() => notebookId.value)

  /**
   * Get current manifest entries
   */
  const entries = computed(() => manifest.value?.entries ?? [])

  /**
   * Get notes from manifest
   */
  const notes = computed(() => entries.value.filter((e) => e.type === 'note'))

  /**
   * Get images from manifest
   */
  const images = computed(() => entries.value.filter((e) => e.type === 'image'))

  /**
   * Initialize a new notebook
   * Creates meta.json, generates FEK, creates empty manifest
   */
  async function initializeNotebook(params: NotebookInitParams): Promise<void> {
    if (fek.value !== null) {
      throw new Error('Notebook already loaded. Clear it first.')
    }

    const result = await NotebookService.initializeNotebook(params)

    // Store in memory only
    fek.value = result.fek
    meta.value = result.meta
    notebookId.value = result.notebookId
    email.value = params.email

    // Load initial manifest
    manifest.value = await NotebookService.getManifest(result.notebookId, result.fek)
  }

  /**
   * Load an existing notebook
   * Fetches meta.json, derives KEK from passphrase, decrypts FEK
   */
  async function loadNotebook(
    notebookIdParam: string,
    passphrase: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (fek.value !== null) {
      throw new Error('Notebook already loaded. Clear it first.')
    }

    const result = await NotebookService.loadNotebook(notebookIdParam, passphrase)

    // Store in memory only
    fek.value = result.fek
    meta.value = result.meta
    notebookId.value = result.notebookId
    email.value = result.meta.user_id

    // Load manifest
    manifest.value = await NotebookService.getManifest(result.notebookId, result.fek, signal)
  }

  /**
   * Sync manifest from server
   * Fetches latest manifest and updates local copy
   */
  async function syncManifest(signal?: AbortSignal): Promise<void> {
    if (!fek.value || !notebookId.value) {
      throw new Error('No notebook loaded')
    }

    manifest.value = await NotebookService.getManifest(notebookId.value, fek.value, signal)
  }

  /**
   * Update manifest entry
   * Updates local manifest and uploads to server
   */
  async function updateManifestEntry(
    entry: ManifestEntry,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!fek.value || !notebookId.value || !manifest.value) {
      throw new Error('No notebook loaded')
    }

    // Update local manifest
    const index = manifest.value.entries.findIndex((e) => e.uuid === entry.uuid)
    if (index >= 0) {
      manifest.value.entries[index] = entry
    } else {
      manifest.value.entries.push(entry)
    }

    manifest.value.last_updated = new Date().toISOString()

    // Upload to server
    await NotebookService.putManifest(notebookId.value, manifest.value, fek.value, signal)
  }

  /**
   * Remove entry from manifest
   */
  async function removeManifestEntry(uuid: string, signal?: AbortSignal): Promise<void> {
    if (!fek.value || !notebookId.value || !manifest.value) {
      throw new Error('No notebook loaded')
    }

    // Remove from local manifest
    manifest.value.entries = manifest.value.entries.filter((e) => e.uuid !== uuid)
    manifest.value.last_updated = new Date().toISOString()

    // Upload to server
    await NotebookService.putManifest(notebookId.value, manifest.value, fek.value, signal)
  }

  /**
   * Upload a blob
   * Encrypts data with FEK and uploads to server
   */
  async function uploadBlob(
    uuid: string,
    data: ArrayBuffer | Uint8Array,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!fek.value || !notebookId.value) {
      throw new Error('No notebook loaded')
    }

    await NotebookService.uploadBlob(notebookId.value, uuid, data, fek.value, signal)
  }

  /**
   * Download and decrypt a blob
   * Returns decrypted data in memory only
   */
  async function downloadBlob(uuid: string, signal?: AbortSignal): Promise<ArrayBuffer> {
    if (!fek.value || !notebookId.value) {
      throw new Error('No notebook loaded')
    }

    return await NotebookService.downloadBlob(notebookId.value, uuid, fek.value, signal)
  }

  /**
   * Delete a blob
   */
  async function deleteBlob(uuid: string, signal?: AbortSignal): Promise<void> {
    if (!notebookId.value) {
      throw new Error('No notebook loaded')
    }

    await NotebookService.deleteBlob(notebookId.value, uuid, signal)
  }

  /**
   * Get manifest entry by UUID
   */
  function getEntry(uuid: string): ManifestEntry | undefined {
    return manifest.value?.entries.find((e) => e.uuid === uuid)
  }

  /**
   * Clear all notebook data
   * Removes FEK, manifest, and all sensitive data from memory
   */
  function clearNotebook(): void {
    // Clear all in-memory sensitive data
    fek.value = null
    manifest.value = null
    meta.value = null
    notebookId.value = null
    email.value = null
  }

  return {
    // State (read-only)
    fek: computed(() => fek.value),
    manifest: computed(() => manifest.value),
    meta: computed(() => meta.value),
    notebookId: currentNotebookId,
    email: computed(() => email.value),

    // Computed
    isAuthenticated,
    isNotebookLoaded,
    entries,
    notes,
    images,

    // Methods
    initializeNotebook,
    loadNotebook,
    syncManifest,
    updateManifestEntry,
    removeManifestEntry,
    uploadBlob,
    downloadBlob,
    deleteBlob,
    getEntry,
    clearNotebook,
  }
})

