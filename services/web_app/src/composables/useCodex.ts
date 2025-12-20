import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

export function useCodex() {
  const router = useRouter()
  const sessionStore = useSessionStore()
  const toast = useToast()

  // ===== Codex State =====
  const codexes = ref<Array<{ uuid: string; title: string }>>([])
  const currentCodex = computed(() => sessionStore.getCurrentCodex())
  const isCreatingCodex = ref(false)
  const isLoadingCodex = ref(false)
  const loadingCodexId = ref<string | null>(null)

  // ===== Rune State =====
  const runes = computed(() => sessionStore.listRunes())
  const selectedRuneId = ref<string | null>(null)
  const isLoadingRune = ref(false)
  const isCreatingRune = ref(false)

  // ===== Save State =====
  const isSaving = ref(false)
  const lastSavedContent = ref<string>('')
  const lastCheckContent = ref<string>('')
  const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveStatusTimeout = ref<number | null>(null)
  const autoSaveTimeout = ref<number | null>(null)

  // ===== Editor Reference (to be set by component) =====
  let getEditorContent: (() => string) | null = null
  let setEditorContent: ((content: string) => void) | null = null

  // ===== Codex Management =====
  function loadCodexes() {
    codexes.value = sessionStore.listCodexes()
  }

  async function selectCodex(codexId: string) {
    if (loadingCodexId.value) return

    loadingCodexId.value = codexId

    try {
      await sessionStore.openCodex(codexId)
      router.push(`/codex/${codexId}`)
    } catch (error) {
      console.error('Failed to open codex:', error)
      toast.error('Failed to open codex: ' + (error instanceof Error ? error.message : String(error)))
      loadingCodexId.value = null
    }
  }

  async function createCodex(title: string) {
    if (!title.trim()) {
      toast.error('Please enter a codex title')
      return null
    }

    isLoadingCodex.value = true

    try {
      await sessionStore.createCodex(title)
      loadCodexes()
      return true
    } catch (error) {
      console.error('Failed to create codex:', error)
      toast.error('Failed to create codex: ' + (error instanceof Error ? error.message : String(error)))
      return null
    } finally {
      isLoadingCodex.value = false
    }
  }

  async function renameCodex(newTitle: string) {
    if (!newTitle.trim() || newTitle === currentCodex.value?.title) {
      return false
    }

    try {
      await sessionStore.renameCodex(newTitle)
      return true
    } catch (error) {
      console.error('Failed to rename codex:', error)
      toast.error('Failed to rename codex: ' + (error instanceof Error ? error.message : String(error)))
      return false
    }
  }

  // ===== Rune Management =====
  async function createRune(title: string, content?: string) {
    const runeTitle = title.trim() || 'Untitled Rune'
    const runeContent = content !== undefined ? content : `# ${runeTitle}\n\n`

    try {
      const runeId = await sessionStore.createRune(runeTitle, runeContent)
      return runeId
    } catch (error) {
      console.error('Failed to create rune:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create rune')
      return null
    }
  }

  async function deleteRune(runeId: string) {
    const rune = runes.value.find(r => r.uuid === runeId)
    if (!rune) return false

    try {
      await sessionStore.deleteRune(runeId)
      toast.success(`Deleted "${rune.title}"`)

      // If we deleted the selected rune, clear selection or select another
      if (selectedRuneId.value === runeId) {
        const remainingRunes = runes.value.filter(r => r.uuid !== runeId)
        if (remainingRunes.length > 0) {
          await selectRune(remainingRunes[0].uuid)
        } else {
          selectedRuneId.value = null
          if (setEditorContent) {
            setEditorContent('')
          }
          lastSavedContent.value = ''
          lastCheckContent.value = ''
        }
      }
      return true
    } catch (error) {
      console.error('Failed to delete rune:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete rune')
      return false
    }
  }

  async function duplicateRune(runeId: string) {
    const rune = runes.value.find(r => r.uuid === runeId)
    if (!rune) return null

    try {
      // Get the original rune content
      const content = await sessionStore.getRune(runeId)

      // Create new rune with " (Copy)" suffix
      const newTitle = `${rune.title} (Copy)`
      const newRuneId = await sessionStore.createRune(newTitle, content)

      toast.success(`Duplicated "${rune.title}"`)
      return newRuneId
    } catch (error) {
      console.error('Failed to duplicate rune:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate rune')
      return null
    }
  }

  async function renameRune(runeId: string, newTitle: string) {
    if (!newTitle.trim() || newTitle === runes.value.find(r => r.uuid === runeId)?.title) {
      return false
    }

    try {
      await sessionStore.updateRune(runeId, { title: newTitle })
      return true
    } catch (error) {
      console.error('Failed to rename rune:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to rename rune')
      return false
    }
  }

  // ===== Rune Selection & Loading =====
  async function selectRune(runeId: string) {
    if (selectedRuneId.value === runeId) {
      return
    }

    // Cancel pending auto-save
    cancelAutoSave()

    if (selectedRuneId.value && hasUnsavedChanges()) {
      try {
        await saveRune()
      } catch (error) {
        return
      }
    }

    selectedRuneId.value = runeId
    isLoadingRune.value = true

    try {
      // Fetch rune content from session store
      const content = await sessionStore.getRune(runeId)

      // Load content into editor
      if (setEditorContent) {
        setEditorContent(content)
      }

      // Store as last saved content
      lastSavedContent.value = content
      lastCheckContent.value = content
      saveStatus.value = 'idle'
    } catch (error) {
      console.error('Failed to load rune:', error)
      toast.error('Failed to load rune: ' + (error instanceof Error ? error.message : String(error)))

      // Clear selection and editor on error
      selectedRuneId.value = null
      if (setEditorContent) {
        setEditorContent('')
      }
      lastSavedContent.value = ''
      lastCheckContent.value = ''
    } finally {
      isLoadingRune.value = false
    }
  }

  // ===== Save Functionality =====
  function hasUnsavedChanges(): boolean {
    if (!getEditorContent) return false
    const currentContent = getEditorContent()
    return currentContent !== lastSavedContent.value
  }

  function extractTitleFromContent(content: string): string | null {
    // Extract first # heading from markdown
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      // Match # heading (but not ## or more)
      if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
        const title = trimmed.substring(2).trim()
        if (title) {
          return title
        }
      }
    }
    return null
  }

  async function saveRune() {
    if (!selectedRuneId.value || !getEditorContent) {
      return
    }

    if (isSaving.value) {
      return // Already saving
    }

    const currentContent = getEditorContent()

    // Don't save if content hasn't changed
    if (currentContent === lastSavedContent.value) {
      return
    }

    isSaving.value = true
    saveStatus.value = 'saving'

    try {
      // Extract title from first heading
      const extractedTitle = extractTitleFromContent(currentContent)

      // Update rune with content and optionally title
      const updates: { content: string; title?: string } = { content: currentContent }
      if (extractedTitle) {
        updates.title = extractedTitle
      }

      await sessionStore.updateRune(selectedRuneId.value, updates)

      lastSavedContent.value = currentContent
      saveStatus.value = 'saved'

      // Clear "Saved" status after 2 seconds
      if (saveStatusTimeout.value) {
        clearTimeout(saveStatusTimeout.value)
      }
      saveStatusTimeout.value = window.setTimeout(() => {
        saveStatus.value = 'idle'
        saveStatusTimeout.value = null
      }, 2000)
    } catch (error) {
      console.error('Failed to save rune:', error)
      toast.error('Failed to save: ' + (error instanceof Error ? error.message : String(error)))
      saveStatus.value = 'error'

      // Clear error status after 3 seconds
      if (saveStatusTimeout.value) {
        clearTimeout(saveStatusTimeout.value)
      }
      saveStatusTimeout.value = window.setTimeout(() => {
        saveStatus.value = 'idle'
        saveStatusTimeout.value = null
      }, 3000)

      throw error
    } finally {
      isSaving.value = false
    }
  }

  function scheduleAutoSave() {
    // Cancel existing auto-save timer
    cancelAutoSave()

    // Schedule auto-save after 2 seconds of inactivity
    autoSaveTimeout.value = window.setTimeout(() => {
      if (selectedRuneId.value && hasUnsavedChanges()) {
        saveRune()
      }
      autoSaveTimeout.value = null
    }, 2000)
  }

  function cancelAutoSave() {
    if (autoSaveTimeout.value) {
      clearTimeout(autoSaveTimeout.value)
      autoSaveTimeout.value = null
    }
  }

  function checkForChanges() {
    if (!selectedRuneId.value || isSaving.value || !getEditorContent) {
      return
    }

    const currentContent = getEditorContent()

    // If content changed since last check, schedule auto-save
    if (currentContent !== lastCheckContent.value) {
      lastCheckContent.value = currentContent
      scheduleAutoSave()
    }
  }

  // ===== Keyboard Shortcuts =====
  function handleSaveShortcut(event: KeyboardEvent) {
    // Ctrl+S or Cmd+S to save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault()
      cancelAutoSave()
      saveRune()
    }
  }

  // ===== Auto-save Interval =====
  let contentCheckInterval: number | null = null

  function startAutoSaveInterval() {
    // Check for content changes every 500ms
    contentCheckInterval = window.setInterval(checkForChanges, 500)
  }

  function stopAutoSaveInterval() {
    if (contentCheckInterval) {
      clearInterval(contentCheckInterval)
      contentCheckInterval = null
    }
  }

  // ===== Editor Integration =====
  function setEditorHandlers(
    getContent: () => string,
    setContent: (content: string) => void
  ) {
    getEditorContent = getContent
    setEditorContent = setContent
  }

  // ===== Lifecycle =====
  function setupSaveHandlers() {
    window.addEventListener('keydown', handleSaveShortcut)
    startAutoSaveInterval()
  }

  function cleanupSaveHandlers() {
    window.removeEventListener('keydown', handleSaveShortcut)
    stopAutoSaveInterval()
    cancelAutoSave()
    if (saveStatusTimeout.value) {
      clearTimeout(saveStatusTimeout.value)
    }
  }

  return {
    // State
    codexes,
    currentCodex,
    isCreatingCodex,
    isLoadingCodex,
    loadingCodexId,
    runes,
    selectedRuneId,
    isLoadingRune,
    isCreatingRune,
    isSaving,
    saveStatus,

    // Codex functions
    loadCodexes,
    selectCodex,
    createCodex,
    renameCodex,

    // Rune functions
    createRune,
    deleteRune,
    duplicateRune,
    renameRune,
    selectRune,

    // Save functions
    saveRune,
    hasUnsavedChanges,
    cancelAutoSave,

    // Editor integration
    setEditorHandlers,
    setupSaveHandlers,
    cleanupSaveHandlers,
  }
}
