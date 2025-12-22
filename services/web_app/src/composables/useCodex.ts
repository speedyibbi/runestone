import { ref, computed, watch, type Ref } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import type { EditorView } from '@codemirror/view'

export interface CodexInfo {
  uuid: string
  title: string
}

export interface RuneInfo {
  uuid: string
  title: string
  last_updated: string
  isDirty?: boolean
}

export interface CurrentRuneState extends RuneInfo {
  isDirty: boolean
}

export interface UseCodexOptions {
  autoSave?: boolean
  autoSaveDelay?: number
  showNotifications?: boolean
}

export function useCodex(editorView?: Ref<EditorView | null>, options: UseCodexOptions = {}) {
  const { autoSave = true, autoSaveDelay = 1000, showNotifications = true } = options

  // Stores and utilities
  const sessionStore = useSessionStore()
  const toast = useToast()

  // ==================== State ====================

  // Current codex
  const currentCodex = ref<CodexInfo | null>(null)

  // Current rune (note)
  const currentRune = ref<CurrentRuneState | null>(null)

  // Lists
  const codexes = ref<CodexInfo[]>([])
  const runes = ref<RuneInfo[]>([])

  // Loading states
  const isLoadingCodex = ref(false)
  const isLoadingRune = ref(false)
  const isSavingRune = ref(false)
  const isSyncing = ref(false)

  // Error state
  const error = ref<Error | null>(null)

  // Last sync time
  const lastSyncTime = ref<string | null>(null)

  // Auto-save timer
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  // Track original content for dirty detection
  let lastSavedContent = ''

  // ==================== Computed ====================

  const hasUnsavedChanges = computed(() => currentRune.value?.isDirty ?? false)

  const canSave = computed(() => {
    return currentRune.value !== null && currentRune.value.isDirty && !isSavingRune.value
  })

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
   * Set error state and optionally show toast
   */
  function setError(err: Error | string, showToast = true) {
    const errorObj = typeof err === 'string' ? new Error(err) : err
    error.value = errorObj

    if (showToast && showNotifications) {
      toast.error(errorObj.message)
    }
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
    if (!editorView?.value) return

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
      // Check for unsaved changes
      if (hasUnsavedChanges.value && showNotifications) {
        toast.warning('You have unsaved changes in the current note')
      }

      // Close current codex if any
      if (currentCodex.value) {
        closeCodex()
      }

      // Open the codex in session store
      await sessionStore.openCodex(codexId)

      // Get codex info
      const codexInfo = sessionStore.getCurrentCodex()
      if (codexInfo) {
        currentCodex.value = codexInfo
      }

      // Load runes list
      refreshRuneList()

      // Update last sync time
      lastSyncTime.value = sessionStore.getLastSyncTime()

      if (showNotifications) {
        toast.success(`Opened codex: ${codexInfo?.title}`)
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
   */
  async function openRune(runeId: string): Promise<void> {
    clearError()
    isLoadingRune.value = true

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      // Check for unsaved changes
      if (hasUnsavedChanges.value) {
        // Auto-save before switching
        if (currentRune.value && autoSave) {
          await saveCurrentRune(true)
        }
      }

      // Cancel any pending auto-save
      cancelAutoSave()

      // Get rune info
      const runeInfo = runes.value.find((r) => r.uuid === runeId)
      if (!runeInfo) {
        throw new Error(`Rune with ID ${runeId} not found`)
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
      setEditorContent(content)
      lastSavedContent = content

      if (showNotifications) {
        toast.info(`Opened note: ${runeInfo.title}`)
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isLoadingRune.value = false
    }
  }

  /**
   * Create a new rune
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

      if (showNotifications) {
        toast.success(`Created note: ${title}`)
      }

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

      if (showNotifications && !silent) {
        toast.success('Note saved')
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSavingRune.value = false
    }
  }

  /**
   * Rename a rune
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

      await sessionStore.updateRune(runeId, { title: newTitle.trim() })

      // Update current rune if it's the one being renamed
      if (currentRune.value?.uuid === runeId) {
        currentRune.value.title = newTitle.trim()
      }

      // Refresh rune list
      refreshRuneList()

      if (showNotifications) {
        toast.success('Note renamed')
      }
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }

  /**
   * Delete a rune
   */
  async function deleteRune(runeId: string): Promise<void> {
    clearError()

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      const runeInfo = runes.value.find((r) => r.uuid === runeId)
      const runeTitle = runeInfo?.title || 'Unknown'

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

      if (showNotifications) {
        toast.success(`Deleted note: ${runeTitle}`)
      }
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

  // ==================== Sync Operations ====================

  /**
   * Sync the currently open codex
   * TODO: Implement sync functionality
   */
  async function syncCurrentCodex(): Promise<void> {
    clearError()
    isSyncing.value = true

    try {
      if (!currentCodex.value) {
        throw new Error('No codex is currently open')
      }

      // TODO: Implement actual sync logic
      // Placeholder: simulate sync
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Update last sync time
      lastSyncTime.value = new Date().toISOString()

      if (showNotifications) {
        toast.info('Sync not yet implemented')
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  /**
   * Sync all codexes
   * TODO: Implement sync functionality
   */
  async function syncAllCodexes(): Promise<void> {
    clearError()
    isSyncing.value = true

    try {
      // TODO: Implement actual sync logic
      // Placeholder: simulate sync
      await new Promise((resolve) => setTimeout(resolve, 2000))

      if (showNotifications) {
        toast.info('Sync all not yet implemented')
      }
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  // ==================== Editor Content Monitoring ====================

  // Watch editor content changes for auto-save
  if (editorView && autoSave) {
    // Set up a watcher on the editor view
    watch(
      () => editorView.value?.state.doc.toString(),
      (newContent) => {
        if (!currentRune.value) return

        const currentContent = newContent || ''

        // Check if content has changed from last saved
        if (currentContent !== lastSavedContent) {
          markDirty()
          scheduleAutoSave()
        }
      },
    )
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
      lastSyncTime.value = sessionStore.getLastSyncTime()
    }
  }

  // ==================== Return API ====================

  return {
    // Current State
    currentCodex,
    currentRune,
    codexes,
    runes,

    // Loading States
    isLoadingCodex,
    isLoadingRune,
    isSavingRune,
    isSyncing,

    // Error State
    error,

    // Computed
    hasUnsavedChanges,
    canSave,
    hasOpenCodex,
    hasOpenRune,

    // Codex Operations
    openCodex,
    createCodex,
    renameCodex,
    deleteCodex,
    closeCodex,
    refreshCodexList,

    // Rune Operations
    openRune,
    createRune,
    saveCurrentRune,
    renameRune,
    deleteRune,
    closeRune,
    refreshRuneList,

    // Sync Operations (Placeholders)
    syncCurrentCodex,
    syncAllCodexes,
    lastSyncTime,

    // Utility
    clearError,
    getEditorContent,
    setEditorContent,
  }
}
