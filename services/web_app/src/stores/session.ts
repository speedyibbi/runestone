import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import OrchestrationService from '@/services/orchestration/orchestrator'
import type { Map } from '@/interfaces/map'
import { ManifestEntryType, MediaEntryType, type Manifest } from '@/interfaces/manifest'
import type { Settings } from '@/interfaces/settings'
import type { SyncProgress, SyncResult } from '@/interfaces/sync'
import type { SearchServiceResult, SearchOptions } from '@/interfaces/search'
import type { GraphData, GraphQueryOptions } from '@/interfaces/graph'

/**
 * Session store for managing user session state
 * NOTE: All state is in-memory only, nothing is persisted
 */
export const useSessionStore = defineStore('session', () => {
  // ==================== State ====================
  const lookupHash = ref<string | null>(null)

  const root = ref<{
    mek: CryptoKey | null
    map: Map | null
    settings: Settings | null
  }>({
    mek: null,
    map: null,
    settings: null,
  })

  const notebook = ref<{
    fek: CryptoKey | null
    manifest: Manifest | null
  }>({
    fek: null,
    manifest: null,
  })

  // Track blob URLs for automatic cleanup
  // Map of sigilId -> blob URL
  const sigilUrlCache = ref<globalThis.Map<string, string>>(new globalThis.Map())

  // ==================== Computed ====================
  const isActive = computed(() => lookupHash.value !== null)
  const hasOpenCodex = computed(
    () => notebook.value.fek !== null && notebook.value.manifest !== null,
  )

  // ==================== Session Management ====================

  /**
   * Setup session with explicit authentication mode
   * mode: 'auto' | 'login' | 'signup'
   * - 'auto': Automatic detection (login if exists, signup if not)
   * - 'login': Must be existing user, fails if account not found
   * - 'signup': Must be new user, fails if account already exists
   */
  async function setup(
    userPassphrase: string,
    mode: 'auto' | 'login' | 'signup' = 'auto',
    signal?: AbortSignal,
  ): Promise<void> {
    // If lookupHash is already set, return early
    if (lookupHash.value) {
      throw new Error('Session already active')
    }

    // IMPORTANT: Compute and set lookupHash immediately
    // This is required because FileService needs it for remote operations
    const computedLookupHash = OrchestrationService.computeLookupHash(userPassphrase)
    lookupHash.value = computedLookupHash

    try {
      // Check if user data exists in cache
      const existsInCache = await OrchestrationService.existsInCache(computedLookupHash)

      if (existsInCache) {
        // User exists in cache
        if (mode === 'signup') {
          throw new Error('Account already exists. Please log in instead.')
        }

        // Bootstrap from cache (for both 'auto' and 'login' modes)
        const result = await OrchestrationService.bootstrapFromCache(computedLookupHash)

        // Update state
        root.value.mek = result.mek
        root.value.map = result.map
        root.value.settings = result.settings
      } else {
        // Cache is empty - check if user exists remotely
        const existsRemotely = await OrchestrationService.existsRemotely(signal)

        if (existsRemotely) {
          // User exists remotely
          if (mode === 'signup') {
            throw new Error('Account already exists. Please log in instead.')
          }

          // Bootstrap from remote (for both 'auto' and 'login' modes)
          const result = await OrchestrationService.bootstrapFromRemote(computedLookupHash, signal)

          // Update state
          root.value.mek = result.mek
          root.value.map = result.map
          root.value.settings = result.settings
        } else {
          // User does not exist
          if (mode === 'login') {
            throw new Error('Account not found. Please check your credentials or sign up.')
          }

          // Initialize new account (for both 'auto' and 'signup' modes)
          const result = await OrchestrationService.initialize(computedLookupHash)

          // Update state
          root.value.mek = result.mek
          root.value.map = result.map
          root.value.settings = result.settings
        }
      }
    } catch (error) {
      // If setup fails, clear the session state
      lookupHash.value = null
      throw error
    }
  }

  /**
   * Clear all session state and logout
   */
  function teardown(): void {
    if (hasOpenCodex.value) {
      closeCodex()
    }

    lookupHash.value = null
    root.value = {
      mek: null,
      map: null,
      settings: null,
    }
    notebook.value = {
      fek: null,
      manifest: null,
    }
  }

  /**
   * Get the lookup hash for the current session
   */
  function getLookupHash(): string | null {
    return lookupHash.value
  }

  // ==================== Settings Operations ====================

  /**
   * Get current settings
   */
  function getSettings(): Settings {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!root.value.settings) {
      throw new Error('Settings not loaded')
    }
    return root.value.settings
  }

  /**
   * Update settings
   */
  async function saveSettings(partialSettings: Partial<Settings>): Promise<void> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!lookupHash.value) {
      throw new Error('Lookup hash is not set')
    }

    if (!root.value.mek) {
      throw new Error('MEK is not available')
    }

    if (!root.value.settings) {
      throw new Error('Settings not loaded')
    }

    // Merge partial updates with current settings
    const updatedSettings = await OrchestrationService.saveSettings(
      { ...root.value.settings, ...partialSettings },
      lookupHash.value,
      root.value.mek,
    )

    // Update state
    root.value.settings = updatedSettings
  }

  // ==================== Settings Watcher ====================

  /**
   * Watch for settings changes
   */
  watch(
    () => root.value.settings,
    (newSettings, oldSettings) => {
      // Only update if settings actually changed and we have required values
      if (!newSettings || !lookupHash.value || !root.value.mek) {
        return
      }

      // Remove last_updated from settings
      const newSettings_ = { ...newSettings } as Partial<Settings>
      delete newSettings_.last_updated

      const oldSettings_ = { ...oldSettings } as Partial<Settings>
      delete oldSettings_.last_updated

      // Compare settings
      if (JSON.stringify(newSettings_) === JSON.stringify(oldSettings_)) {
        return
      }

      // Update scheduler with new settings
      OrchestrationService.startScheduler(lookupHash.value, root.value.mek, newSettings).catch(
        (error) => {
          console.warn('Failed to update auto sync scheduler:', error)
        },
      )
    },
    { deep: true },
  )

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
   * Loads the codex into session state
   */
  async function openCodex(codexId: string): Promise<void> {
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

    // Load notebook
    const result = await OrchestrationService.loadNotebook(codexId, lookupHash.value)

    // Update session state
    notebook.value.fek = result.fek
    notebook.value.manifest = result.manifest
  }

  /**
   * Create a new codex
   */
  async function createCodex(title: string): Promise<string> {
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
    )

    // Update map in session state
    root.value.map = result.map

    return result.notebookId
  }

  /**
   * Rename the currently open codex
   */
  async function renameCodex(newTitle: string): Promise<void> {
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
      lookupHash.value,
      fek,
      root.value.mek!,
      notebook.value.manifest!,
      root.value.map!,
    )

    // Update session state
    root.value.map = result.map
    notebook.value.manifest = result.manifest
  }

  /**
   * Delete the currently open codex
   */
  async function deleteCodex(): Promise<void> {
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
      lookupHash.value,
      root.value.mek,
      notebook.value.manifest!,
      root.value.map!,
    )

    // Update map in session state and close the codex
    root.value.map = result.map
    closeCodex()
  }

  /**
   * Close the currently open codex (unload from memory)
   */
  async function closeCodex(): Promise<void> {
    // Unload notebook
    await OrchestrationService.unloadNotebook()

    // Revoke all blob URLs for this codex
    revokeAllSigilUrls()

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

  // ==================== Rune (Note) Operations ====================

  /**
   * List all runes in the currently open codex
   */
  function listRunes(): Array<{ uuid: string; title: string; last_updated: string }> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    // Filter for note entries only
    return notebook.value.manifest.entries
      .filter((entry) => entry.type === ManifestEntryType.NOTE)
      .map((entry) => ({
        uuid: entry.uuid,
        title: entry.title,
        last_updated: entry.last_updated,
      }))
  }

  /**
   * Get rune content (decrypted markdown)
   */
  async function getRune(runeId: string): Promise<string> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Verify rune exists and is a note
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === runeId)
    if (!entry) {
      throw new Error(`Rune with ID ${runeId} not found`)
    }

    if (entry.type !== ManifestEntryType.NOTE) {
      throw new Error(`Blob with ID ${runeId} is not a rune`)
    }

    // Get blob data
    const result = await OrchestrationService.getBlob(
      codexId,
      runeId,
      lookupHash.value!,
      notebook.value.fek,
      notebook.value.manifest,
    )

    // Convert ArrayBuffer to string (markdown)
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(result.data)
  }

  /**
   * Create a new rune
   */
  async function createRune(title: string, content: string): Promise<string> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Convert string (markdown) to ArrayBuffer
    const encoder = new TextEncoder()
    const data = encoder.encode(content)

    // Create note blob
    const result = await OrchestrationService.createBlob(
      codexId,
      data,
      { type: ManifestEntryType.NOTE, title },
      lookupHash.value!,
      notebook.value.fek,
      notebook.value.manifest,
    )

    // Update manifest in session state
    notebook.value.manifest = result.manifest

    return result.uuid
  }

  /**
   * Update a rune's content and/or title
   */
  async function updateRune(
    runeId: string,
    updates: { title?: string; content?: string },
  ): Promise<void> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Verify rune exists and is a note
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === runeId)
    if (!entry) {
      throw new Error(`Rune with ID ${runeId} not found`)
    }

    if (entry.type !== ManifestEntryType.NOTE) {
      throw new Error(`Blob with ID ${runeId} is not a rune`)
    }

    // Determine what data to use
    let data: Uint8Array
    if (updates.content !== undefined) {
      // Use provided content
      const encoder = new TextEncoder()
      data = encoder.encode(updates.content)
    } else {
      // Content not changed, fetch existing content
      const result = await OrchestrationService.getBlob(
        codexId,
        runeId,
        lookupHash.value!,
        notebook.value.fek,
        notebook.value.manifest,
      )
      data = new Uint8Array(result.data)
    }

    // Determine what title to use
    const title = updates.title !== undefined ? updates.title : entry.title

    // Update blob
    const result = await OrchestrationService.updateBlob(
      codexId,
      runeId,
      data,
      { type: ManifestEntryType.NOTE, title },
      lookupHash.value!,
      notebook.value.fek,
      notebook.value.manifest,
    )

    // Update manifest in session state
    notebook.value.manifest = result.manifest
  }

  /**
   * Delete a rune
   */
  async function deleteRune(runeId: string): Promise<void> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Verify rune exists and is a note
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === runeId)
    if (!entry) {
      throw new Error(`Rune with ID ${runeId} not found`)
    }

    if (entry.type !== ManifestEntryType.NOTE) {
      throw new Error(`Blob with ID ${runeId} is not a rune`)
    }

    // Delete blob
    const result = await OrchestrationService.deleteBlob(
      codexId,
      runeId,
      lookupHash.value!,
      notebook.value.fek,
      notebook.value.manifest,
    )

    // Update manifest in session state
    notebook.value.manifest = result.manifest
  }

  // ==================== Sigil (Media) Operations ====================

  /**
   * List all sigils in the currently open codex
   */
  function listSigils(): Array<{ uuid: string; title: string; last_updated: string }> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    // Filter for media entries only
    return notebook.value.manifest.entries
      .filter((entry) => Object.values(MediaEntryType).includes(entry.type as MediaEntryType))
      .map((entry) => ({
        uuid: entry.uuid,
        title: entry.title,
        last_updated: entry.last_updated,
      }))
  }

  /**
   * Get sigil data (decrypted ArrayBuffer)
   */
  async function getSigil(sigilId: string): Promise<ArrayBuffer> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Verify sigil exists and is a media entry
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === sigilId)
    if (!entry) {
      throw new Error(`Sigil with ID ${sigilId} not found`)
    }

    if (!(Object.values(MediaEntryType).includes(entry.type as MediaEntryType))) {
      throw new Error(`Blob with ID ${sigilId} is not a sigil`)
    }

    // Get blob data
    const result = await OrchestrationService.getBlob(
      codexId,
      sigilId,
      lookupHash.value!,
      notebook.value.fek,
    )

    return result.data
  }

  /**
   * Create a new sigil
   */
  async function createSigil(title: string, data: ArrayBuffer, type?: MediaEntryType): Promise<string> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Create media blob
    const result = await OrchestrationService.createBlob(
      codexId,
      data,
      { type: type ?? MediaEntryType.IMAGE, title },
      lookupHash.value!,
      notebook.value.fek,
      notebook.value.manifest,
    )

    // Update manifest in session state
    notebook.value.manifest = result.manifest

    return result.uuid
  }

  /**
   * Delete a sigil
   */
  async function deleteSigil(sigilId: string): Promise<void> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Verify sigil exists and is a media entry
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === sigilId)
    if (!entry) {
      throw new Error(`Sigil with ID ${sigilId} not found`)
    }

    if (!(Object.values(MediaEntryType).includes(entry.type as MediaEntryType))) {
      throw new Error(`Blob with ID ${sigilId} is not a sigil`)
    }

    // Revoke blob URL if cached
    revokeSigilUrl(sigilId)

    // Delete blob
    const result = await OrchestrationService.deleteBlob(
      codexId,
      sigilId,
      lookupHash.value!,
      notebook.value.fek,
      notebook.value.manifest,
    )

    // Update manifest in session state
    notebook.value.manifest = result.manifest
  }

  /**
   * Get sigil as blob URL (for display in UI)
   * Automatically manages URL lifecycle - old URLs are revoked when new ones are created
   * Returns an object with the URL and a manual revoke function
   */
  async function getSigilUrl(sigilId: string): Promise<{ url: string; revoke: () => void }> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    const codexId = notebook.value.manifest.notebook_id

    // Verify sigil exists and is a media entry
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === sigilId)
    if (!entry) {
      throw new Error(`Sigil with ID ${sigilId} not found`)
    }

    if (!(Object.values(MediaEntryType).includes(entry.type as MediaEntryType))) {
      throw new Error(`Blob with ID ${sigilId} is not a sigil`)
    }

    // If we already have a URL for this sigil, return it
    const existingUrl = sigilUrlCache.value.get(sigilId)
    if (existingUrl) {
      return {
        url: existingUrl,
        revoke: () => revokeSigilUrl(sigilId),
      }
    }

    // Get blob data
    const result = await OrchestrationService.getBlob(
      codexId,
      sigilId,
      lookupHash.value!,
      notebook.value.fek,
    )

    // Infer MIME type from file extension (basic detection)
    const ext = entry.title.split('.').pop()?.toLowerCase()
    let mimeType = 'application/octet-stream'
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg'
        break
      case 'png':
        mimeType = 'image/png'
        break
      case 'gif':
        mimeType = 'image/gif'
        break
      case 'webp':
        mimeType = 'image/webp'
        break
      case 'svg':
        mimeType = 'image/svg+xml'
        break
      case 'bmp':
        mimeType = 'image/bmp'
        break
      case 'ico':
        mimeType = 'image/x-icon'
        break
      case 'mp3':
        mimeType = 'audio/mpeg'
        break
      case 'wav':
        mimeType = 'audio/wav'
        break
      case 'ogg':
        mimeType = 'audio/ogg'
        break
      case 'mp4':
        mimeType = 'video/mp4'
        break
      case 'webm':
        mimeType = 'video/webm'
        break
    }

    // Create blob and URL
    const blob = new Blob([result.data], { type: mimeType })
    const url = URL.createObjectURL(blob)

    // Cache the URL for automatic cleanup
    sigilUrlCache.value.set(sigilId, url)

    // Return URL and revoke function
    return {
      url,
      revoke: () => revokeSigilUrl(sigilId),
    }
  }

  /**
   * Manually revoke a specific sigil's blob URL
   */
  function revokeSigilUrl(sigilId: string): void {
    const url = sigilUrlCache.value.get(sigilId)
    if (url) {
      URL.revokeObjectURL(url)
      sigilUrlCache.value.delete(sigilId)
    }
  }

  /**
   * Revoke all cached sigil blob URLs
   * Automatically called when closing codex or logging out
   */
  function revokeAllSigilUrls(): void {
    sigilUrlCache.value.forEach((url: string) => {
      URL.revokeObjectURL(url)
    })
    sigilUrlCache.value.clear()
  }

  /**
   * Get the manifest entry type for a sigil ID
   */
  function getSigilEntryType(sigilId: string): MediaEntryType | null {
    if (!hasOpenCodex.value) {
      return null
    }

    if (!notebook.value.manifest) {
      return null
    }

    // Find the entry in the manifest
    const entry = notebook.value.manifest.entries.find((e) => e.uuid === sigilId)
    if (!entry) {
      return null
    }

    // Check if it's a media entry type
    if (Object.values(MediaEntryType).includes(entry.type as MediaEntryType)) {
      return entry.type as MediaEntryType
    }

    return null
  }

  // ==================== Sync Operations ====================

  /**
   * Sync the currently open codex
   * Downloads new/updated blobs from remote and uploads local changes
   */
  async function syncCurrentCodex(
    onProgress?: (progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<SyncResult> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    if (!notebook.value.fek) {
      throw new Error('FEK is not available')
    }

    if (!root.value.mek) {
      throw new Error('MEK is not available')
    }

    if (!notebook.value.manifest) {
      throw new Error('Manifest is not loaded')
    }

    await OrchestrationService.syncRoot(lookupHash.value!, root.value.mek, onProgress, signal)

    const codexId = notebook.value.manifest.notebook_id

    // Sync the notebook
    const result = await OrchestrationService.syncNotebook(
      codexId,
      lookupHash.value!,
      notebook.value.fek,
      onProgress,
      signal,
    )

    return result
  }

  /**
   * Sync all codexes
   * Syncs all notebooks in the map (including ones not currently open)
   */
  async function syncAllCodexes(
    onProgress?: (codexId: string, codexTitle: string, progress: SyncProgress) => void,
    signal?: AbortSignal,
  ): Promise<Record<string, SyncResult>> {
    if (!isActive.value) {
      throw new Error('Session is not active')
    }

    if (!lookupHash.value) {
      throw new Error('Lookup hash is not set')
    }

    if (!root.value.mek) {
      throw new Error('MEK is not available')
    }

    if (!root.value.map) {
      throw new Error('Map is not loaded')
    }

    // Create a map of codex IDs to titles for progress callback
    const codexTitles = new globalThis.Map<string, string>()
    root.value.map.entries.forEach((entry) => {
      codexTitles.set(entry.uuid, entry.title)
    })

    await OrchestrationService.syncRoot(lookupHash.value!, root.value.mek, () => {}, signal)

    // Sync all notebooks with enhanced progress callback
    const results = await OrchestrationService.syncAllNotebooks(
      root.value.map,
      lookupHash.value,
      onProgress
        ? (codexId, progress) => {
            const title = codexTitles.get(codexId) || 'Unknown'
            onProgress(codexId, title, progress)
          }
        : undefined,
      signal,
    )

    return results
  }

  /**
   * Get the last sync timestamp for the currently open codex
   * Returns the last_updated timestamp from the manifest
   */
  function getLastSyncTime(): string | null {
    if (!hasOpenCodex.value || !notebook.value.manifest) {
      return null
    }

    return notebook.value.manifest.last_updated
  }

  // ==================== Search Operations ====================

  /**
   * Search runes in the currently open codex
   */
  async function searchRunes(query: string, options?: SearchOptions): Promise<SearchServiceResult> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    return await OrchestrationService.searchNotes(query, options)
  }

  // ==================== Graph Operations ====================

  /**
   * Get graph data for the currently open codex
   * Supports various query types: full graph, neighborhood, shortest path, orphans, hubs
   */
  async function getGraph(options: GraphQueryOptions = {}): Promise<GraphData> {
    if (!hasOpenCodex.value) {
      throw new Error('No codex is currently open')
    }

    return await OrchestrationService.getGraph(options)
  }

  return {
    // Computed
    isActive,
    hasOpenCodex,

    // Session Management
    setup,
    teardown,
    getLookupHash,

    // Settings Operations
    getSettings,
    saveSettings,

    // Codex Operations
    listCodexes,
    openCodex,
    createCodex,
    renameCodex,
    deleteCodex,
    closeCodex,
    getCurrentCodex,

    // Rune Operations
    listRunes,
    getRune,
    createRune,
    updateRune,
    deleteRune,

    // Sigil Operations
    listSigils,
    getSigil,
    createSigil,
    deleteSigil,
    getSigilUrl,
    revokeSigilUrl,
    revokeAllSigilUrls,
    getSigilEntryType,

    // Sync Operations
    syncCurrentCodex,
    syncAllCodexes,
    getLastSyncTime,

    // Search Operations
    searchRunes,

    // Graph Operations
    getGraph,
  }
})
