import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import type { SyncProgress, SyncResult } from '@/interfaces/sync'
import type { SearchServiceResult, SearchOptions } from '@/interfaces/search'

// ==================== Interfaces ====================

export interface CodexInfo {
  uuid: string
  title: string
}

export interface RuneInfo {
  uuid: string
  title: string
  last_updated: string
}

export interface CurrentRuneState extends RuneInfo {
  isDirty: boolean
}

export interface SigilInfo {
  uuid: string
  title: string
  last_updated: string
}

export interface UseCodexOptions {
  autoSave?: boolean
  autoSaveDelay?: number
  showNotifications?: boolean
}

export interface UseCodexReturn {
  // State
  currentCodex: Ref<CodexInfo | null>
  currentRune: Ref<CurrentRuneState | null>
  codexes: Ref<CodexInfo[]>
  runes: Ref<RuneInfo[]>
  sigils: Ref<SigilInfo[]>

  // Loading states
  isLoadingCodex: Ref<boolean>
  isLoadingRune: Ref<boolean>
  isSavingRune: Ref<boolean>
  isSyncing: Ref<boolean>

  // Computed
  hasUnsavedChanges: ComputedRef<boolean>
  canSave: ComputedRef<boolean>
  hasOpenCodex: ComputedRef<boolean>
  hasOpenRune: ComputedRef<boolean>

  // Codex operations
  refreshCodexList: () => void
  openCodex: (codexId: string) => Promise<void>
  createCodex: (title: string) => Promise<string>
  renameCodex: (newTitle: string) => Promise<void>
  deleteCodex: () => Promise<void>
  closeCodex: () => void

  // Rune operations
  refreshRuneList: () => void
  openRune: (runeId: string) => Promise<void>
  createRune: (title: string, content?: string) => Promise<string>
  saveCurrentRune: (silent?: boolean) => Promise<void>
  renameRune: (runeId: string, newTitle: string) => Promise<void>
  deleteRune: (runeId: string) => Promise<void>
  duplicateRune: (runeId: string) => Promise<string>
  closeRune: () => void
  searchRunes: (query: string, options?: SearchOptions) => Promise<SearchServiceResult>

  // Sigil operations
  refreshSigilList: () => void
  createSigil: (file: File) => Promise<string>
  getSigilUrl: (sigilId: string) => Promise<string>
  deleteSigil: (sigilId: string) => Promise<void>

  // Sync operations
  syncCurrentCodex: (onProgress?: (progress: SyncProgress) => void) => Promise<SyncResult>
  syncAllCodexes: (
    onProgress?: (codexId: string, title: string, progress: SyncProgress) => void,
  ) => Promise<Record<string, SyncResult>>
  lastSyncTime: Ref<string | null>

  // Utility
  clearError: () => void
  getEditorContent: () => string
  setEditorContent: (content: string) => void
  isDirectory: (runeTitle: string) => boolean
  createAutoSaveCallback: () => ((update: ViewUpdate) => void) | undefined
  error: Ref<Error | null>
}

// ==================== Main Composable ====================

export function useCodex(
  editorView?: Ref<EditorView | null>,
  options: UseCodexOptions = {},
): UseCodexReturn {
  const { autoSave = true, autoSaveDelay = 1000, showNotifications = true } = options

  // Stores and utilities
  const sessionStore = useSessionStore()
  const toast = useToast()

  // ==================== State ====================

  // Current state
  const currentCodex = ref<CodexInfo | null>(null)
  const currentRune = ref<CurrentRuneState | null>(null)

  // Lists
  const codexes = ref<CodexInfo[]>([])
  const runes = ref<RuneInfo[]>([])
  const sigils = ref<SigilInfo[]>([])

  // Loading states
  const isLoadingCodex = ref(false)
  const isLoadingRune = ref(false)
  const isSavingRune = ref(false)
  const isSyncing = ref(false)

  // Error state
  const error = ref<Error | null>(null)

  // Sync state
  const lastSyncTime = ref<string | null>(null)

  // Auto-save tracking
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  let lastSavedContent = ''

  // ==================== Computed Properties ====================

  const hasUnsavedChanges = computed(() => currentRune.value?.isDirty ?? false)

  const canSave = computed(
    () => currentRune.value !== null && currentRune.value.isDirty && !isSavingRune.value,
  )

  const hasOpenCodex = computed(() => currentCodex.value !== null)

  const hasOpenRune = computed(() => currentRune.value !== null)

  // ==================== Utility Functions ====================

  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  /**
   * Set error state (no toast for editor errors)
   */
  function setError(err: Error | string, showToast = false) {
    const errorObj = typeof err === 'string' ? new Error(err) : err
    error.value = errorObj
    // Editor errors are shown in status bar, not toasts
  }

  /**
   * Check if a rune title represents a directory
   * Directories are runes with titles ending in '/'
   */
  function isDirectory(runeTitle: string): boolean {
    return runeTitle.endsWith('/')
  }

  /**
   * Get editor content
   */
  function getEditorContent(): string {
    if (!editorView?.value) return ''
    return editorView.value.state.doc.toString()
  }

  /**
   * Set editor content
   */
  function setEditorContent(content: string) {
    if (!editorView?.value) {
      return
    }

    editorView.value.dispatch({
      changes: {
        from: 0,
        to: editorView.value.state.doc.length,
        insert: content,
      },
    })
  }

  /**
   * Mark current rune as dirty
   */
  function markDirty() {
    if (currentRune.value) {
      currentRune.value.isDirty = true
    }
  }

  /**
   * Mark current rune as clean (saved)
   */
  function markClean() {
    if (currentRune.value) {
      currentRune.value.isDirty = false
    }
    lastSavedContent = getEditorContent()
  }

  /**
   * Cancel auto-save timer
   */
  function cancelAutoSave() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
      autoSaveTimer = null
    }
  }

  /**
   * Schedule auto-save
   */
  function scheduleAutoSave() {
    if (!autoSave || !currentRune.value) return

    cancelAutoSave()

    autoSaveTimer = setTimeout(async () => {
      if (canSave.value) {
        await saveCurrentRune(true)
      }
    }, autoSaveDelay)
  }

  // ==================== Codex Operations ====================

  /**
   * Refresh the list of codexes from the session store
   */
  function refreshCodexList() {
    try {
      if (!sessionStore.isActive) {
        codexes.value = []
        return
      }

      codexes.value = sessionStore.listCodexes()
    } catch (err) {
      setError(err as Error)
      codexes.value = []
    }
  }

  /**
   * Open a codex by ID
   * Loads the codex into session and updates current state
   */
  async function openCodex(codexId: string): Promise<void> {
    clearError()
    isLoadingCodex.value = true

    try {
      // Close current if any
      if (currentCodex.value) {
        closeCodex()
      }

      // Open in session store
      await sessionStore.openCodex(codexId)

      // Update state
      const codexInfo = sessionStore.getCurrentCodex()
      if (codexInfo) {
        currentCodex.value = codexInfo
      }

      // Load runes and sigils
      refreshRuneList()
      refreshSigilList()

      // Update sync time
      lastSyncTime.value = sessionStore.getLastSyncTime()

      if (showNotifications) {
        toast.success(`Opened: ${codexInfo?.title}`)
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isLoadingCodex.value = false
    }
  }

  /**
   * Create a new codex
   */
  async function createCodex(title: string): Promise<string> {
    clearError()

    try {
      if (!title.trim()) {
        throw new Error('Codex title cannot be empty')
      }

      const codexId = await sessionStore.createCodex(title.trim())

      // Refresh codex list
      refreshCodexList()

      if (showNotifications) {
        toast.success(`Created codex: ${title}`)
      }

      return codexId
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Rename the currently open codex
   */
  async function renameCodex(newTitle: string): Promise<void> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      if (!newTitle.trim()) {
        throw new Error('Codex title cannot be empty')
      }

      await sessionStore.renameCodex(newTitle.trim())

      // Update current codex info
      currentCodex.value.title = newTitle.trim()

      // Refresh codex list
      refreshCodexList()

      if (showNotifications) {
        toast.success('Codex renamed successfully')
      }
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Delete the currently open codex
   */
  async function deleteCodex(): Promise<void> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      const codexTitle = currentCodex.value.title

      await sessionStore.deleteCodex()

      // Close the codex
      closeCodex()

      // Refresh codex list
      refreshCodexList()

      if (showNotifications) {
        toast.success(`Deleted codex: ${codexTitle}`)
      }
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Close the currently open codex
   * Cleans up state and clears editor
   */
  function closeCodex(): void {
    cancelAutoSave()

    // Close in session store
    sessionStore.closeCodex()

    // Clear state
    currentCodex.value = null
    currentRune.value = null
    runes.value = []
    sigils.value = []
    lastSyncTime.value = null

    // Clear editor
    if (editorView?.value) {
      setEditorContent('')
    }

    lastSavedContent = ''
  }

  // ==================== Rune Operations ====================

  /**
   * Refresh the list of runes from the session store
   */
  function refreshRuneList() {
    try {
      if (!sessionStore.hasOpenCodex) {
        runes.value = []
        return
      }

      runes.value = sessionStore.listRunes()
    } catch (err) {
      setError(err as Error)
      runes.value = []
    }
  }

  /**
   * Open a rune by ID
   * Loads the rune content into the editor
   * Directories cannot be opened in the editor
   */
  async function openRune(runeId: string): Promise<void> {
    clearError()
    isLoadingRune.value = true

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      // Check for unsaved changes
      if (hasUnsavedChanges.value && currentRune.value && autoSave) {
        // Auto-save before switching
        await saveCurrentRune(true)
      }

      // Cancel any pending auto-save
      cancelAutoSave()

      // Get rune info
      const runeInfo = runes.value.find((r) => r.uuid === runeId)
      if (!runeInfo) {
        throw new Error(`Rune with ID ${runeId} not found`)
      }

      // Check if it's a directory
      if (isDirectory(runeInfo.title)) {
        throw new Error('Cannot open directories in the editor')
      }

      // Fetch rune content
      const content = await sessionStore.getRune(runeId)

      // Update current rune state
      currentRune.value = {
        uuid: runeInfo.uuid,
        title: runeInfo.title,
        last_updated: runeInfo.last_updated,
        isDirty: false,
      }

      // Load content into editor
      // Try to set content immediately, but don't wait if editor isn't ready
      if (editorView?.value) {
        setEditorContent(content)
        lastSavedContent = content
      } else {
        // Editor not ready yet, store content and let watch handle it
        lastSavedContent = content
      }

      // Status shown in status bar, not toast
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isLoadingRune.value = false
    }
  }

  /**
   * Create a new rune
   * Can create both regular runes and directories (titles ending in '/')
   */
  async function createRune(title: string, content: string = ''): Promise<string> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      if (!title.trim()) {
        throw new Error('Rune title cannot be empty')
      }

      const runeId = await sessionStore.createRune(title.trim(), content)

      // Refresh rune list
      refreshRuneList()

      // Status shown in status bar, not toast

      return runeId
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Save the currently open rune
   */
  async function saveCurrentRune(silent: boolean = false): Promise<void> {
    clearError()

    try {
      if (!currentRune.value) {
        throw new Error('No rune is currently open')
      }

      if (!currentRune.value.isDirty) {
        // Nothing to save
        return
      }

      isSavingRune.value = true

      const content = getEditorContent()

      await sessionStore.updateRune(currentRune.value.uuid, { content })

      // Mark as clean
      markClean()

      // Update last_updated timestamp
      const updatedRuneInfo = sessionStore
        .listRunes()
        .find((r) => r.uuid === currentRune.value?.uuid)
      if (updatedRuneInfo && currentRune.value) {
        currentRune.value.last_updated = updatedRuneInfo.last_updated
      }

      // Refresh rune list
      refreshRuneList()

      // Status shown in status bar, not toast
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSavingRune.value = false
    }
  }

  /**
   * Rename a rune
   * If renaming a directory, also renames all children to update their paths
   */
  async function renameRune(runeId: string, newTitle: string): Promise<void> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      if (!newTitle.trim()) {
        throw new Error('Rune title cannot be empty')
      }

      const runeInfo = runes.value.find((r) => r.uuid === runeId)
      if (!runeInfo) {
        throw new Error(`Rune with ID ${runeId} not found`)
      }

      const oldTitle = runeInfo.title
      const trimmedNewTitle = newTitle.trim()
      const isDir = isDirectory(oldTitle)

      // If renaming a directory, find all children and update their paths
      if (isDir) {
        // Get a snapshot of all runes before we start renaming
        // This ensures we don't miss children if the list updates during the operation
        const allRunes = [...runes.value]

        // Find all runes that are children of this directory
        // Children have titles that start with the directory path
        const children = allRunes.filter((r) => {
          // Check if this rune is a child (starts with oldTitle)
          // But not the directory itself
          return r.title.startsWith(oldTitle) && r.uuid !== runeId
        })

        // Sort children by depth (shallowest first) to ensure parent directories are renamed before their children
        const sortedChildren = [...children].sort((a, b) => {
          const aDepth = a.title.split('/').length
          const bDepth = b.title.split('/').length
          return aDepth - bDepth
        })

        // Rename all children first (so parent directories are updated before their children)
        for (const child of sortedChildren) {
          // Replace the old directory path with the new one
          const newChildTitle = child.title.replace(oldTitle, trimmedNewTitle)
          await sessionStore.updateRune(child.uuid, { title: newChildTitle })
        }
      }

      // Rename the rune itself
      await sessionStore.updateRune(runeId, { title: trimmedNewTitle })

      // Update current rune if it's the one being renamed
      if (currentRune.value?.uuid === runeId) {
        currentRune.value.title = trimmedNewTitle
      }

      // Refresh rune list
      refreshRuneList()
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Delete a rune
   * If deleting a directory, also deletes all children recursively
   */
  async function deleteRune(runeId: string): Promise<void> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      const runeInfo = runes.value.find((r) => r.uuid === runeId)
      if (!runeInfo) {
        throw new Error(`Rune with ID ${runeId} not found`)
      }

      const runeTitle = runeInfo.title
      const isDir = isDirectory(runeTitle)

      // If deleting a directory, find all children and delete them first
      if (isDir) {
        // Get a snapshot of all runes before we start deleting
        // This ensures we don't miss children if the list updates during the operation
        const allRunes = [...runes.value]

        // Find all runes that are children of this directory
        // Children have titles that start with the directory path
        const children = allRunes.filter((r) => {
          // Check if this rune is a child (starts with runeTitle)
          // But not the directory itself
          return r.title.startsWith(runeTitle) && r.uuid !== runeId
        })

        // Sort children by depth (deepest first) to ensure children are deleted before their parents
        // This prevents issues if there are nested directories
        const sortedChildren = [...children].sort((a, b) => {
          const aDepth = a.title.split('/').length
          const bDepth = b.title.split('/').length
          return bDepth - aDepth // Reverse order - deepest first
        })

        // Store child count for notification (before deletion)
        const childCount = sortedChildren.length

        // Delete all children first
        for (const child of sortedChildren) {
          await sessionStore.deleteRune(child.uuid)

          // If it's the current rune, close it
          if (currentRune.value?.uuid === child.uuid) {
            currentRune.value = null
            cancelAutoSave()
            setEditorContent('')
            lastSavedContent = ''
          }
        }

        // Status shown in status bar, not toast
      }

      // Delete the rune itself
      await sessionStore.deleteRune(runeId)

      // If it's the current rune, close it
      if (currentRune.value?.uuid === runeId) {
        currentRune.value = null
        cancelAutoSave()
        setEditorContent('')
        lastSavedContent = ''
      }

      // Refresh rune list
      refreshRuneList()

      // Status shown in status bar, not toast
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Duplicate a rune
   * Creates a copy with " (Copy)" suffix
   */
  async function duplicateRune(runeId: string): Promise<string> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      // Get original rune
      const runeInfo = runes.value.find((r) => r.uuid === runeId)
      if (!runeInfo) {
        throw new Error(`Rune with ID ${runeId} not found`)
      }

      // Don't duplicate directories
      if (isDirectory(runeInfo.title)) {
        throw new Error('Cannot duplicate directories')
      }

      // Get content
      const content = await sessionStore.getRune(runeId)

      // Create copy with " (Copy)" suffix
      const newTitle = `${runeInfo.title} (Copy)`
      const newRuneId = await createRune(newTitle, content)

      if (showNotifications) {
        toast.success(`Duplicated: ${runeInfo.title}`)
      }

      return newRuneId
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Close the currently open rune
   */
  function closeRune(): void {
    cancelAutoSave()
    currentRune.value = null

    if (editorView?.value) {
      setEditorContent('')
    }

    lastSavedContent = ''
  }

  /**
   * Search runes by title and content
   */
  async function searchRunes(query: string, options?: SearchOptions): Promise<SearchServiceResult> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      if (!query.trim()) {
        // Return empty results for empty query
        return {
          results: [],
          total: 0,
          query: '',
        }
      }

      const result = await sessionStore.searchRunes(query.trim(), options)

      return result
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  // ==================== Sigil (Image) Operations ====================

  /**
   * Refresh the list of sigils from the session store
   */
  function refreshSigilList() {
    try {
      if (!sessionStore.hasOpenCodex) {
        sigils.value = []
        return
      }

      sigils.value = sessionStore.listSigils()
    } catch (err) {
      setError(err as Error)
      sigils.value = []
    }
  }

  /**
   * Create a new sigil from an image file
   */
  async function createSigil(file: File): Promise<string> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image')
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()

      // Create sigil
      const sigilId = await sessionStore.createSigil(file.name, arrayBuffer)

      // Refresh sigil list
      refreshSigilList()

      // Status shown in status bar, not toast

      return sigilId
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Get a blob URL for a sigil (for display in UI)
   */
  async function getSigilUrl(sigilId: string): Promise<string> {
    try {
      const result = await sessionStore.getSigilUrl(sigilId)
      return result.url
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Delete a sigil
   */
  async function deleteSigil(sigilId: string): Promise<void> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      const sigilInfo = sigils.value.find((s) => s.uuid === sigilId)
      const sigilTitle = sigilInfo?.title || 'Unknown'

      await sessionStore.deleteSigil(sigilId)

      // Refresh sigil list
      refreshSigilList()

      // Status shown in status bar, not toast
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  // ==================== Sync Operations ====================

  /**
   * Sync the currently open codex
   */
  async function syncCurrentCodex(
    onProgress?: (progress: SyncProgress) => void,
  ): Promise<SyncResult> {
    clearError()
    isSyncing.value = true

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      const result = await sessionStore.syncCurrentCodex(onProgress)

      // Update last sync time
      lastSyncTime.value = sessionStore.getLastSyncTime()

      // Refresh lists in case of changes
      refreshRuneList()
      refreshSigilList()

      if (showNotifications) {
        toast.success('Synced successfully')
      }

      return result
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Sync all codexes
   */
  async function syncAllCodexes(
    onProgress?: (codexId: string, title: string, progress: SyncProgress) => void,
  ): Promise<Record<string, SyncResult>> {
    clearError()
    isSyncing.value = true

    try {
      const results = await sessionStore.syncAllCodexes(onProgress)

      // Refresh codex list
      refreshCodexList()

      // Update sync time if current codex was synced
      if (currentCodex.value) {
        lastSyncTime.value = sessionStore.getLastSyncTime()
      }

      if (showNotifications) {
        toast.success('All codexes synced')
      }

      return results
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  // ==================== Editor Content Monitoring ====================

  // Auto-save callback function
  // This will be passed to useEditor to set up the updateListener extension
  function createAutoSaveCallback() {
    if (!autoSave) return undefined

    return (update: ViewUpdate) => {
      if (!currentRune.value) return
      if (!update.docChanged) return // Only proceed if document actually changed

      const currentContent = update.state.doc.toString()

      // Check if content has changed from last saved
      if (currentContent !== lastSavedContent) {
        markDirty()
        scheduleAutoSave()
      }
    }
  }

  // ==================== Initialization ====================

  // Initialize codex list if session is active
  if (sessionStore.isActive) {
    refreshCodexList()

    // Check if there's already an open codex
    const openCodexInfo = sessionStore.getCurrentCodex()
    if (openCodexInfo) {
      currentCodex.value = openCodexInfo
      refreshRuneList()
      refreshSigilList()
      lastSyncTime.value = sessionStore.getLastSyncTime()
    }
  }

  // ==================== Return API ====================

  return {
    // State
    currentCodex,
    currentRune,
    codexes,
    runes,
    sigils,

    // Loading states
    isLoadingCodex,
    isLoadingRune,
    isSavingRune,
    isSyncing,

    // Error state
    error,

    // Computed
    hasUnsavedChanges,
    canSave,
    hasOpenCodex,
    hasOpenRune,

    // Codex operations
    refreshCodexList,
    openCodex,
    createCodex,
    renameCodex,
    deleteCodex,
    closeCodex,

    // Rune operations
    refreshRuneList,
    openRune,
    createRune,
    saveCurrentRune,
    renameRune,
    deleteRune,
    duplicateRune,
    closeRune,
    searchRunes,

    // Sigil operations
    refreshSigilList,
    createSigil,
    getSigilUrl,
    deleteSigil,

    // Sync operations
    syncCurrentCodex,
    syncAllCodexes,
    lastSyncTime,

    // Utility
    clearError,
    getEditorContent,
    setEditorContent,
    isDirectory,
    createAutoSaveCallback,
  }
}
