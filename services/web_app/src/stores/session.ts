import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import OrchestrationService from '@/services/orchestration/orchestrator'
import type { Map } from '@/interfaces/map'
import type { Manifest } from '@/interfaces/manifest'
import type { SyncProgress } from '@/interfaces/sync'

/**
 * Session store for managing user session state
 * NOTE: All state is in-memory only, nothing is persisted
 */
export const useSessionStore = defineStore('session', () => {
  // ==================== State ====================
  const email = ref<string | null>(null)
  const lookupHash = ref<string | null>(null)

  const root = ref<{
    mek: CryptoKey | null
    map: Map | null
  }>({
    mek: null,
    map: null,
  })

  const notebook = ref<{
    fek: CryptoKey | null
    manifest: Manifest | null
  }>({
    fek: null,
    manifest: null,
  })

  // ==================== Computed ====================
  const isActive = computed(() => email.value !== null && lookupHash.value !== null)
  const hasOpenCodex = computed(() => notebook.value.fek !== null && notebook.value.manifest !== null)

  // ==================== Session Management ====================

  /**
   * Setup session - bootstrap if possible, otherwise initialize
   */
  async function setup(userEmail: string, lookupKey: string, signal?: AbortSignal): Promise<void> {
    // If email and lookupHash are already set, return early
    if (email.value && lookupHash.value) {
      throw new Error('Session already setup')
    }

    // Check if bootstrap is possible
    const canBootstrap = await OrchestrationService.canBootstrap(signal)

    if (canBootstrap) {
      // Bootstrap existing user account
      const result = await OrchestrationService.bootstrap(userEmail, lookupKey, signal)

      // Update state
      email.value = userEmail
      lookupHash.value = result.lookupHash
      root.value.mek = result.mek
      root.value.map = result.map
    } else {
      // Initialize new user account
      const result = await OrchestrationService.initialize(userEmail, lookupKey, signal)

      // Update state
      email.value = userEmail
      lookupHash.value = result.lookupHash
      root.value.mek = result.mek
      root.value.map = result.map
    }
  }

  /**
   * Clear all session state and logout
   */
  function teardown(): void {
    email.value = null
    lookupHash.value = null
    root.value.mek = null
    root.value.map = null
    notebook.value.fek = null
    notebook.value.manifest = null
  }

  /**
   * Get current user email
   */
  function getEmail(): string | null {
    return email.value
  }
  
  /**
   * Get current lookup hash
   */
  function getLookupHash(): string | null {
    return lookupHash.value
  }

  // ==================== Codex (Notebook) Operations ====================

  /**
   * List all available codexes
   */
  function listCodexes(): Array<{ uuid: string; title: string }> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!root.value.map) {
      throw new Error('Map is not loaded')
    }

    return root.value.map.entries.map((entry) => ({
      uuid: entry.uuid,
      title: entry.title,
    }))
  }

  /**
   * Open/load a specific codex
   * Triggers sync and loads the codex into session state
   */
  async function openCodex(
    codexId: string,
    onProgress?: (progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!lookupHash.value) {
      throw new Error('Lookup hash is not set')
    }

    if (!root.value.map) {
      throw new Error('Map is not loaded')
    }

    // Verify codex exists in map
    const codexEntry = root.value.map.entries.find((entry) => entry.uuid === codexId)
    if (!codexEntry) {
      throw new Error(`Codex with ID ${codexId} not found`)
    }

    // Load notebook (includes sync)
    const result = await OrchestrationService.loadNotebook(
      codexId,
      lookupHash.value,
      onProgress,
      signal,
    )

    // Update session state
    notebook.value.fek = result.fek
    notebook.value.manifest = result.manifest
  }

  /**
   * Create a new codex
   */
  async function createCodex(title: string, signal?: AbortSignal): Promise<string> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!lookupHash.value) {
      throw new Error('Lookup hash is not set')
    }

    if (!root.value.mek) {
      throw new Error('MEK is not available')
    }

    // Create notebook
    const result = await OrchestrationService.createNotebook(
      title,
      lookupHash.value,
      root.value.mek,
      root.value.map!,
      signal,
    )

    // Update map in session state
    root.value.map = result.map

    return result.notebookId
  }

  /**
   * Rename the currently open codex
   */
  async function renameCodex(newTitle: string, signal?: AbortSignal): Promise<void> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!lookupHash.value) {
      throw new Error('Lookup hash is not set')
    }

    const codexId = notebook.value.manifest!.notebook_id
    const fek = notebook.value.fek!

    // Update notebook
    const result = await OrchestrationService.updateNotebook(
      codexId,
      newTitle,
      fek,
      root.value.mek!,
      notebook.value.manifest!,
      root.value.map!,
      signal,
    )

    // Update session state
    root.value.map = result.map
    notebook.value.manifest = result.manifest
  }

  /**
   * Delete the currently open codex
   */
  async function deleteCodex(signal?: AbortSignal): Promise<void> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!lookupHash.value) {
      throw new Error('Lookup hash is not set')
    }

    if (!root.value.mek) {
      throw new Error('MEK is not available')
    }

    const codexId = notebook.value.manifest!.notebook_id

    // Delete notebook
    const result = await OrchestrationService.deleteNotebook(
      codexId,
      root.value.mek,
      notebook.value.manifest!,
      root.value.map!,
      signal,
    )

    // Update map in session state and close the codex
    root.value.map = result.map
    closeCodex()
  }

  /**
   * Close the currently open codex (unload from memory)
   */
  function closeCodex(): void {
    notebook.value.fek = null
    notebook.value.manifest = null
  }

  /**
   * Get current codex info
   */
  function getCurrentCodex(): { uuid: string; title: string } | null {
    if (!hasOpenCodex.value || !notebook.value.manifest) {
      return null
    }

    return {
      uuid: notebook.value.manifest.notebook_id,
      title: notebook.value.manifest.notebook_title,
    }
  }

  return {
    // State
    email,
    lookupHash,
    root,
    notebook,

    // Computed
    isActive,
    hasOpenCodex,

    // Session Management
    setup,
    teardown,
    getEmail,
    getLookupHash,

    // Codex Operations
    listCodexes,
    openCodex,
    createCodex,
    renameCodex,
    deleteCodex,
    closeCodex,
    getCurrentCodex,
  }
})
