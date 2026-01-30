<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ViewUpdate } from '@codemirror/view'
import { undoDepth, redoDepth } from '@codemirror/commands'
import { useEditor, type PreviewMode } from '@/composables/useEditor'
import { useCodex, type RuneInfo } from '@/composables/useCodex'
import { useSessionStore } from '@/stores/session'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { useToast } from '@/composables/useToast'
import { MediaEntryType } from '@/interfaces/manifest'
import CodexEditorArea from '@/components/codex/CodexEditorArea.vue'
import CodexRuneList from '@/components/codex/CodexRuneList.vue'
import CodexRuneActions from '@/components/codex/CodexRuneActions.vue'
import SettingsModal from '@/components/codex/SettingsModal.vue'
import CommandPalette from '@/components/codex/CommandPalette.vue'
import CodexGraphView from '@/components/codex/CodexGraphView.vue'
import Modal from '@/components/base/Modal.vue'

const route = useRoute()
const router = useRouter()

// Sidebar state
const sidebarOpen = ref(false)

// Codex rename/delete state
const isRenamingCodex = ref(false)
const codexTitleInput = ref('')
const codexTitleInputRef = ref<HTMLInputElement>()
const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogAction = ref<(() => void) | null>(null)

// Settings modal state
const showSettingsModal = ref(false)

// Command palette state
const showCommandPalette = ref(false)

// Graph view state
const showGraphView = ref(false)

// Add rune modal state
const showAddRuneModal = ref(false)
const newRuneName = ref('')
const newRuneNameInputRef = ref<HTMLInputElement>()

// Touch-based drag and drop state
const draggedRune = ref<RuneInfo | null>(null)
const dragOverRune = ref<RuneInfo | null>(null)
const isDraggingRune = ref(false)
const dragStartPosition = ref({ x: 0, y: 0 })
const dragCurrentPosition = ref({ x: 0, y: 0 })
const showTrashIcon = ref(false)
const isOverTrash = ref(false)
const showEditIcon = ref(false)
const isOverEdit = ref(false)
let dragLongPressTimer: ReturnType<typeof setTimeout> | null = null
let dragHasMoved = false
const sidebarContentRef = ref<HTMLElement | null>(null)

// Scroll-based UI visibility
const showMenuButton = ref(true)
const showAppBar = ref(true)
const lastScrollTop = ref(0)
const scrollThreshold = 3 * 16 // 3rem in pixels
const scrollUpThreshold = 1.5 * 16 // 1.5rem in pixels
let scrollListener: (() => void) | null = null
let lastScrollDirection = 'down' // Track scroll direction

function handleEditorScroll() {
  if (!editorView.value) return

  const scrollTop = editorView.value.scrollDOM.scrollTop
  const scrollDelta = scrollTop - lastScrollTop.value

  // Always show if at the top
  if (scrollTop <= 0) {
    showMenuButton.value = true
    showAppBar.value = true
    lastScrollTop.value = scrollTop
    lastScrollDirection = 'up'
    return
  }

  // Update scroll direction
  if (scrollDelta > 0) {
    lastScrollDirection = 'down'
  } else if (scrollDelta < 0) {
    lastScrollDirection = 'up'
  }

  // Hide if scrolled down more than threshold
  if (scrollTop > scrollThreshold) {
    // Check if scrolling up by more than threshold
    if (scrollDelta < -scrollUpThreshold) {
      // Scrolling up significantly, show UI
      showMenuButton.value = true
      showAppBar.value = true
    } else if (scrollDelta > 0 || (scrollDelta === 0 && lastScrollDirection === 'down')) {
      // Scrolling down or stopped while scrolling down, hide UI
      showMenuButton.value = false
      showAppBar.value = false
    }
  } else {
    // Within threshold, always show
    showMenuButton.value = true
    showAppBar.value = true
  }

  lastScrollTop.value = scrollTop
}

function setupScrollListener() {
  if (!editorView.value) return

  // Cleanup old listener
  if (scrollListener && editorView.value) {
    editorView.value.scrollDOM.removeEventListener('scroll', scrollListener)
    scrollListener = null
  }

  // Setup new listener
  scrollListener = handleEditorScroll
  editorView.value.scrollDOM.addEventListener('scroll', scrollListener, { passive: true })
}

function cleanupScrollListener() {
  if (scrollListener && editorView.value) {
    editorView.value.scrollDOM.removeEventListener('scroll', scrollListener)
    scrollListener = null
  }
}

// Bottom sheet state
const bottomSheetOpen = ref(false)
const bottomSheetHeight = ref(0) // Height in pixels
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartHeight = ref(0)

// Bottom sheet configuration
const DEFAULT_HEIGHT = 0.5 // 50% of viewport height
const MIN_HEIGHT = 0.2 // 20% of viewport height (collapse threshold)
const MAX_HEIGHT = 0.9 // 90% of viewport height (max height)

// Track editor state changes to trigger undo/redo reactivity
const editorStateVersion = ref(0)

// Undo/redo availability - computed from editor state
const canUndo = computed(() => {
  // Access editorStateVersion to make this reactive
  void editorStateVersion.value
  const view = editorViewRef.value
  if (!view) return false
  return undoDepth(view.state) > 0
})

const canRedo = computed(() => {
  // Access editorStateVersion to make this reactive
  void editorStateVersion.value
  const view = editorViewRef.value
  if (!view) return false
  return redoDepth(view.state) > 0
})

// App bar button handlers
function handleUndo() {
  // Don't allow undo in preview mode
  if (previewMode.value === 'preview') return
  
  // Don't allow undo while content is syncing
  if (isSyncingContent) return
  
  // Get the view reference - use editorViewRef for stability
  const view = editorViewRef.value
  if (!view) return
  
  // Don't allow undo if editor is read-only
  if (view.state.readOnly) return
  
  // Check if undo is available
  if (undoDepth(view.state) === 0) return
  
  // Simulate Ctrl/Cmd-Z keyboard shortcut
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const event = new KeyboardEvent('keydown', {
    key: 'z',
    code: 'KeyZ',
    keyCode: 90,
    ctrlKey: !isMac,
    metaKey: isMac,
    bubbles: true,
    cancelable: true,
  })
  
  view.contentDOM.dispatchEvent(event)
}

function handleRedo() {
  // Don't allow redo in preview mode
  if (previewMode.value === 'preview') return
  
  // Don't allow redo while content is syncing
  if (isSyncingContent) return
  
  // Get the view reference - use editorViewRef for stability
  const view = editorViewRef.value
  if (!view) return
  
  // Don't allow redo if editor is read-only
  if (view.state.readOnly) return
  
  // Check if redo is available
  if (redoDepth(view.state) === 0) return
  
  // Simulate Ctrl/Cmd-Shift-Z keyboard shortcut (or Ctrl/Cmd-Y on Windows)
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const event = new KeyboardEvent('keydown', {
    key: isMac ? 'z' : 'y',
    code: isMac ? 'KeyZ' : 'KeyY',
    keyCode: isMac ? 90 : 89,
    ctrlKey: !isMac,
    metaKey: isMac,
    shiftKey: isMac,
    bubbles: true,
    cancelable: true,
  })
  
  view.contentDOM.dispatchEvent(event)
}

function handleSearch() {
  showCommandPalette.value = true
}

async function handleCommandPaletteSelect(runeId: string) {
  await handleOpenRune(runeId)
  showCommandPalette.value = false
}

function handleCommandPaletteCommand(command: string) {
  // Handle commands from the palette
  if (command === 'open-graph') {
    showGraphView.value = true
    sidebarOpen.value = false
  }
  showCommandPalette.value = false
}

function handleCloseGraphView() {
  showGraphView.value = false
}

function handleAddRune() {
  newRuneName.value = ''
  showAddRuneModal.value = true
  // Focus input after modal opens
  nextTick(() => {
    newRuneNameInputRef.value?.focus()
  })
}

async function handleAddRuneConfirm() {
  const name = newRuneName.value.trim()
  if (!name) return
  
  try {
    const runeId = await createRune(name)
    showAddRuneModal.value = false
    newRuneName.value = ''
    await handleOpenRune(runeId)
  } catch (err) {
    console.error('Error creating rune:', err)
    // Keep modal open on error so user can retry
  }
}

function handleAddRuneCancel() {
  showAddRuneModal.value = false
  newRuneName.value = ''
}

function handleAddRuneKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleAddRuneConfirm()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    handleAddRuneCancel()
  }
}

function handleOptions() {
  if (bottomSheetOpen.value) {
    closeBottomSheet()
  } else {
    openBottomSheet()
  }
}

async function handleSync() {
  try {
    await syncCurrentCodex()
    toast.success('Codex synced successfully')
    closeBottomSheet()
  } catch (err) {
    console.error('Error syncing codex:', err)
    toast.error(err instanceof Error ? err.message : 'Failed to sync codex')
  }
}

async function handleExportRune() {
  try {
    await exportRune()
    toast.success('Rune exported successfully')
    closeBottomSheet()
  } catch (err) {
    console.error('Error exporting rune:', err)
    toast.error(err instanceof Error ? err.message : 'Failed to export rune')
  }
}

async function handleExportCodex() {
  try {
    await exportCodex()
    toast.success('Codex exported successfully')
    closeBottomSheet()
  } catch (err) {
    console.error('Error exporting codex:', err)
    toast.error(err instanceof Error ? err.message : 'Failed to export codex')
  }
}

function handlePreviewToggle() {
  // Cycle between 'edit' and 'preview' only (exclude 'split')
  if (previewMode.value === 'edit') {
    previewMode.value = 'preview'
  } else if (previewMode.value === 'preview') {
    previewMode.value = 'edit'
  } else {
    // If in 'split' mode, switch to 'edit'
    previewMode.value = 'edit'
  }
  
  // Apply the preview mode change to the editor
  applyPreviewMode()
}

function openBottomSheet() {
  const viewportHeight = window.innerHeight
  bottomSheetHeight.value = 0 // Start at 0 for animation
  bottomSheetOpen.value = true
  // Set initial height to default after opening
  nextTick(() => {
    requestAnimationFrame(() => {
      bottomSheetHeight.value = viewportHeight * DEFAULT_HEIGHT
    })
  })
}

function closeBottomSheet() {
  // Animate to 0 height, then close
  if (bottomSheetHeight.value > 0) {
    bottomSheetHeight.value = 0
    setTimeout(() => {
      bottomSheetOpen.value = false
    }, 300) // Match transition duration
  } else {
    bottomSheetOpen.value = false
  }
}

// Bottom sheet drag handlers
function handleBottomSheetTouchStart(event: TouchEvent) {
  // Only allow dragging from the handle area
  const target = event.target as HTMLElement
  if (!target.closest('.bottom-sheet-handle') && !target.closest('.bottom-sheet-drag-area')) {
    return
  }
  
  isDragging.value = true
  dragStartY.value = event.touches[0].clientY
  dragStartHeight.value = bottomSheetHeight.value
  event.preventDefault()
}

function handleBottomSheetTouchMove(event: TouchEvent) {
  if (!isDragging.value) return
  
  const currentY = event.touches[0].clientY
  const deltaY = dragStartY.value - currentY // Inverted: dragging up increases height
  const viewportHeight = window.innerHeight
  const newHeight = dragStartHeight.value + deltaY
  
  // Clamp height between 0 and max height
  const minHeightPx = viewportHeight * MIN_HEIGHT
  const maxHeightPx = viewportHeight * MAX_HEIGHT
  
  if (newHeight < minHeightPx) {
    bottomSheetHeight.value = Math.max(0, newHeight)
  } else if (newHeight > maxHeightPx) {
    bottomSheetHeight.value = maxHeightPx
  } else {
    bottomSheetHeight.value = newHeight
  }
  
  event.preventDefault()
}

function handleBottomSheetTouchEnd() {
  if (!isDragging.value) return
  
  isDragging.value = false
  
  const viewportHeight = window.innerHeight
  const minHeightPx = viewportHeight * MIN_HEIGHT
  
  // If height is below collapse threshold, close the sheet
  if (bottomSheetHeight.value < minHeightPx) {
    closeBottomSheet()
  } else {
    // Snap to nearest valid height (default or max)
    if (bottomSheetHeight.value < viewportHeight * DEFAULT_HEIGHT) {
      bottomSheetHeight.value = viewportHeight * DEFAULT_HEIGHT
    } else if (bottomSheetHeight.value > viewportHeight * MAX_HEIGHT * 0.8) {
      bottomSheetHeight.value = viewportHeight * MAX_HEIGHT
    }
  }
}

// Mouse drag handlers for desktop
function handleBottomSheetMouseDown(event: MouseEvent) {
  // Only allow dragging from the handle area
  const target = event.target as HTMLElement
  if (!target.closest('.bottom-sheet-handle') && !target.closest('.bottom-sheet-drag-area')) {
    return
  }
  
  isDragging.value = true
  dragStartY.value = event.clientY
  dragStartHeight.value = bottomSheetHeight.value
  event.preventDefault()
}

function handleBottomSheetMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  
  const currentY = event.clientY
  const deltaY = dragStartY.value - currentY // Inverted: dragging up increases height
  const viewportHeight = window.innerHeight
  const newHeight = dragStartHeight.value + deltaY
  
  // Clamp height between 0 and max height
  const minHeightPx = viewportHeight * MIN_HEIGHT
  const maxHeightPx = viewportHeight * MAX_HEIGHT
  
  if (newHeight < minHeightPx) {
    bottomSheetHeight.value = Math.max(0, newHeight)
  } else if (newHeight > maxHeightPx) {
    bottomSheetHeight.value = maxHeightPx
  } else {
    bottomSheetHeight.value = newHeight
  }
  
  event.preventDefault()
}

function handleBottomSheetMouseUp() {
  if (!isDragging.value) return
  
  isDragging.value = false
  
  const viewportHeight = window.innerHeight
  const minHeightPx = viewportHeight * MIN_HEIGHT
  
  // If height is below collapse threshold, close the sheet
  if (bottomSheetHeight.value < minHeightPx) {
    closeBottomSheet()
  } else {
    // Snap to nearest valid height (default or max)
    if (bottomSheetHeight.value < viewportHeight * DEFAULT_HEIGHT) {
      bottomSheetHeight.value = viewportHeight * DEFAULT_HEIGHT
    } else if (bottomSheetHeight.value > viewportHeight * MAX_HEIGHT * 0.8) {
      bottomSheetHeight.value = viewportHeight * MAX_HEIGHT
    }
  }
}

const editorElement = ref<HTMLElement>()
const previewElement = ref<HTMLElement>()
const editorViewRef = ref<import('@codemirror/view').EditorView | null>(null) as import('vue').Ref<import('@codemirror/view').EditorView | null>
const previewViewRef = ref<import('@codemirror/view').EditorView | null>(null) as import('vue').Ref<import('@codemirror/view').EditorView | null>

const {
  runes,
  currentRune,
  currentCodex,
  hasOpenRune,
  hasOpenCodex,
  openRune,
  isLoadingRune,
  getSigilUrl,
  createAutoSaveCallback,
  isDirectory,
  createRune,
  searchRunes,
  renameCodex,
  deleteCodex,
  renameRune,
  deleteRune,
  exportRune,
  exportCodex,
  syncCurrentCodex,
  isSyncing,
} = useCodex(editorViewRef, { autoSave: true })

const autoSaveCallback = createAutoSaveCallback()

// Get session store for manifest entry type resolver
const sessionStore = useSessionStore()
const toast = useToast()

// Create sigil resolver function
const sigilResolver = async (sigilId: string): Promise<string> => {
  return await getSigilUrl(sigilId)
}

// Create manifest entry type resolver function
const manifestEntryTypeResolver = (sigilId: string): MediaEntryType | null => {
  return sessionStore.getSigilEntryType(sigilId)
}

// Create rune opener function - finds rune by title or UUID and opens it
const runeOpener = async (runeIdentifier: string): Promise<void> => {
  const normalized = runeIdentifier.trim()

  // Check if it's a rune://uuid format
  const runeProtocolPattern =
    /^rune:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  const uuidMatch = normalized.match(runeProtocolPattern)

  if (uuidMatch) {
    // It's a UUID - open directly
    const uuid = uuidMatch[1]
    await openRune(uuid)
    return
  }

  // Otherwise, treat it as a title and find by title
  const foundRune = runes.value.find(
    (rune) => rune.title === normalized || rune.title.toLowerCase() === normalized.toLowerCase(),
  )

  if (foundRune) {
    await openRune(foundRune.uuid)
  } else {
    throw new Error(`Rune "${normalized}" not found`)
  }
}

// Shared preview mode state
const previewMode = ref<PreviewMode>('edit')

// Initialize preview editor for split mode
const previewComposable = useEditor(
  previewElement,
  undefined,
  sigilResolver,
  ref('preview'),
  runeOpener,
  manifestEntryTypeResolver,
)
const { editorView: previewView } = previewComposable

// Combined update callback for auto-save and preview sync
let isSyncingContent = false
const combinedUpdateCallback = (update: ViewUpdate) => {
  // Call auto-save callback if it exists
  if (autoSaveCallback) {
    autoSaveCallback(update)
  }

  // Update editor state version to trigger undo/redo reactivity
  if (update.transactions.length > 0) {
    editorStateVersion.value++
  }

  // Sync to preview editor in split mode
  if (
    previewMode.value === 'split' &&
    update.docChanged &&
    previewView.value &&
    !isSyncingContent
  ) {
    isSyncingContent = true
    const content = update.state.doc.toString()
    const previewContent = previewView.value.state.doc.toString()
    if (content !== previewContent) {
      previewComposable.setContent(content)
    }
    nextTick(() => {
      isSyncingContent = false
    })
  }
}

// Initialize editor with sigil resolver and rune opener
const editorComposable = useEditor(
  editorElement,
  combinedUpdateCallback,
  sigilResolver,
  previewMode,
  runeOpener,
  manifestEntryTypeResolver,
)
const { editorView, togglePreview, applyPreviewMode } = editorComposable

// Media upload handler
const mediaUploadHandler = useMediaUpload({
  editorView: editorViewRef,
  showNotifications: false,
  onError: (error: Error) => {
    console.error('Media upload error:', error.message)
  },
})
const { isDraggingOver, handleFileUpload, insertMediaMarkdown } = mediaUploadHandler

// Hidden file input for sigil upload
const sigilFileInputRef = ref<HTMLInputElement>()

function handleUploadSigil() {
  if (!hasOpenRune.value) return
  sigilFileInputRef.value?.click()
}

async function handleSigilFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !hasOpenRune.value) return

  try {
    // Upload file and get sigil ID
    const sigilId = await handleFileUpload(file)
    
    if (sigilId) {
      // Insert markdown into editor
      insertMediaMarkdown(sigilId, file.name)
      toast.success(`Uploaded: ${file.name}`)
      closeBottomSheet()
    }
  } catch (err) {
    console.error('Error uploading sigil:', err)
    toast.error(err instanceof Error ? err.message : 'Failed to upload sigil')
  } finally {
    // Reset input
    if (input) {
      input.value = ''
    }
  }
}

watch(hasOpenRune, (isOpen) => {
  if (!isOpen) {
    editorElement.value = undefined
  }
})

// Track cleanup functions for upload handlers
let dragDropCleanup: (() => void) | null = null
let pasteCleanup: (() => void) | null = null

/**
 * Setup upload handlers when both editor element and view are ready
 */
function setupUploadHandlers() {
  // Cleanup old handlers first
  if (dragDropCleanup) {
    dragDropCleanup()
    dragDropCleanup = null
  }
  if (pasteCleanup) {
    pasteCleanup()
    pasteCleanup = null
  }

  // Only setup if editor view is available
  if (editorView.value) {
    dragDropCleanup = mediaUploadHandler.setupDragAndDrop()
    pasteCleanup = mediaUploadHandler.setupPasteHandler()
  }
}

watch(
  editorElement,
  (element, oldElement) => {
    if (!element && oldElement && editorView.value) {
      editorComposable.destroy()
      editorViewRef.value = null
    }
    if (element) {
      nextTick(() => {
        if (element && !editorView.value && editorComposable.initializeEditor) {
          editorComposable.initializeEditor()
        }
        // Setup handlers after editor is initialized
        nextTick(() => {
          setupUploadHandlers()
        })
      })
    }
  },
  { immediate: true },
)

// Watch preview element for split mode
watch(
  [previewElement, () => previewMode.value],
  ([element, mode], [oldElement, oldMode]) => {
    if (mode === 'split' && element) {
      // Check if editor view exists and if its parent is still valid
      if (previewView.value) {
        const editorParent = previewView.value.dom.parentElement
        // If element changed or parent is no longer valid (not in DOM or doesn't match), destroy and recreate
        if (
          oldElement !== element ||
          !editorParent ||
          editorParent !== element ||
          !element.isConnected
        ) {
          previewComposable.destroy()
          previewViewRef.value = null
        }
      }

      // Initialize preview editor in split mode
      if (!previewView.value && previewComposable.initializeEditor) {
        nextTick(() => {
          if (element && previewComposable.initializeEditor) {
            previewComposable.initializeEditor()
            previewViewRef.value = previewView.value
            // Sync initial content after initialization
            nextTick(() => {
              if (editorView.value && previewView.value) {
                const content = editorView.value.state.doc.toString()
                previewComposable.setContent(content)
                // Setup scroll sync
                setupScrollSync()
              }
            })
          }
        })
      } else if (previewView.value && editorView.value) {
        // Already initialized, just sync content
        nextTick(() => {
          const content = editorView.value?.state.doc.toString() || ''
          previewComposable.setContent(content)
          // Ensure scroll sync is set up
          setupScrollSync()
        })
      }
    } else if (mode !== 'split' && previewView.value) {
      // Destroy preview editor when not in split mode
      previewComposable.destroy()
      previewViewRef.value = null
    }
  },
  { immediate: true },
)

// Watch preview mode changes to sync content when switching to split
watch(
  () => previewMode.value,
  (mode, oldMode) => {
    if (mode === 'split' && oldMode !== 'split') {
      // Just switched to split mode, ensure preview editor is initialized and synced
      nextTick(() => {
        if (previewElement.value && !previewView.value && previewComposable.initializeEditor) {
          previewComposable.initializeEditor()
          previewViewRef.value = previewView.value
        }
        nextTick(() => {
          if (editorView.value && previewView.value) {
            const content = editorView.value.state.doc.toString()
            previewComposable.setContent(content)
          }
        })
      })
    }
  },
)

// Setup upload handlers when editor view becomes available
watch(editorView, (view, oldView) => {
  if (view) {
    // Wait a tick to ensure DOM is ready
    nextTick(() => {
      setupUploadHandlers()
      // Apply preview mode state when editor view becomes available
      applyPreviewMode()
      // Setup scroll listener for UI visibility
      setupScrollListener()
      // Focus the editor if we just got a view and have an open rune that's not loading
      if (!oldView && hasOpenRune.value && !isLoadingRune.value) {
        focusEditor()
      }
    })
  } else {
    // Cleanup when view is destroyed
    cleanupScrollListener()
    if (dragDropCleanup) {
      dragDropCleanup()
      dragDropCleanup = null
    }
    if (pasteCleanup) {
      pasteCleanup()
      pasteCleanup = null
    }
  }
})

// Watch preview mode changes and apply them
watch(
  () => previewMode.value,
  () => {
    if (editorView.value) {
      nextTick(() => {
        applyPreviewMode()
      })
    }
  },
)

// Apply preview mode when currentRune changes
watch(currentRune, () => {
  // Reset scroll state when switching runes
  lastScrollTop.value = 0
  showMenuButton.value = true
  showAppBar.value = true
  
  if (editorView.value) {
    nextTick(() => {
      applyPreviewMode()
      // Sync content to preview editor if in split mode
      if (previewMode.value === 'split') {
        nextTick(() => {
          if (previewView.value && editorView.value) {
            const content = editorView.value.state.doc.toString()
            previewComposable.setContent(content)
          } else if (previewElement.value && !previewView.value) {
            // Preview element exists but editor not initialized yet, wait for it
            const checkInterval = setInterval(() => {
              if (previewView.value && editorView.value) {
                const content = editorView.value.state.doc.toString()
                previewComposable.setContent(content)
                clearInterval(checkInterval)
              }
            }, 50)
            // Clear interval after 2 seconds to avoid infinite loop
            setTimeout(() => clearInterval(checkInterval), 2000)
          }
        })
      }
    })
  }
})

// Sync content from main editor to preview editor in split mode
watch(
  [editorView, () => previewMode.value],
  ([view, mode]) => {
    if (mode === 'split' && view && previewView.value) {
      // Watch for content changes in the main editor
      const content = view.state.doc.toString()
      const previewContent = previewView.value.state.doc.toString()
      if (content !== previewContent) {
        previewComposable.setContent(content)
      }
    }
  },
  { immediate: true },
)

// Content syncing fallback
watch(
  () => editorView.value?.state.doc.toString(),
  (content) => {
    if (
      previewMode.value === 'split' &&
      content !== undefined &&
      previewView.value &&
      !isSyncingContent
    ) {
      const previewContent = previewView.value.state.doc.toString()
      if (content !== previewContent) {
        isSyncingContent = true
        previewComposable.setContent(content)
        nextTick(() => {
          isSyncingContent = false
        })
      }
    }
  },
)

// Synchronized scrolling for split mode
let isSyncingScroll = false
let editorScrollListener: (() => void) | null = null
let previewScrollListener: (() => void) | null = null

function syncScrollFromEditor() {
  if (!editorView.value || !previewView.value || isSyncingScroll || previewMode.value !== 'split') {
    return
  }

  isSyncingScroll = true

  const editorScroller = editorView.value.scrollDOM
  const previewScroller = previewView.value.scrollDOM

  const editorScrollTop = editorScroller.scrollTop
  const editorScrollHeight = editorScroller.scrollHeight
  const editorClientHeight = editorScroller.clientHeight
  const editorMaxScroll = editorScrollHeight - editorClientHeight

  if (editorMaxScroll > 0) {
    const scrollRatio = editorScrollTop / editorMaxScroll
    const previewScrollHeight = previewScroller.scrollHeight
    const previewClientHeight = previewScroller.clientHeight
    const previewMaxScroll = previewScrollHeight - previewClientHeight

    if (previewMaxScroll > 0) {
      const targetScrollTop = scrollRatio * previewMaxScroll
      previewScroller.scrollTop = targetScrollTop
    }
  }

  nextTick(() => {
    isSyncingScroll = false
  })
}

function syncScrollFromPreview() {
  if (!editorView.value || !previewView.value || isSyncingScroll || previewMode.value !== 'split') {
    return
  }

  isSyncingScroll = true

  const editorScroller = editorView.value.scrollDOM
  const previewScroller = previewView.value.scrollDOM

  const previewScrollTop = previewScroller.scrollTop
  const previewScrollHeight = previewScroller.scrollHeight
  const previewClientHeight = previewScroller.clientHeight
  const previewMaxScroll = previewScrollHeight - previewClientHeight

  if (previewMaxScroll > 0) {
    const scrollRatio = previewScrollTop / previewMaxScroll
    const editorScrollHeight = editorScroller.scrollHeight
    const editorClientHeight = editorScroller.clientHeight
    const editorMaxScroll = editorScrollHeight - editorClientHeight

    if (editorMaxScroll > 0) {
      const targetScrollTop = scrollRatio * editorMaxScroll
      editorScroller.scrollTop = targetScrollTop
    }
  }

  nextTick(() => {
    isSyncingScroll = false
  })
}

function setupScrollSync() {
  // Cleanup old listeners
  if (editorScrollListener && editorView.value) {
    editorView.value.scrollDOM.removeEventListener('scroll', editorScrollListener)
    editorScrollListener = null
  }
  if (previewScrollListener && previewView.value) {
    previewView.value.scrollDOM.removeEventListener('scroll', previewScrollListener)
    previewScrollListener = null
  }

  // Setup new listeners if in split mode
  if (previewMode.value === 'split' && editorView.value && previewView.value) {
    editorScrollListener = () => syncScrollFromEditor()
    previewScrollListener = () => syncScrollFromPreview()

    editorView.value.scrollDOM.addEventListener('scroll', editorScrollListener, { passive: true })
    previewView.value.scrollDOM.addEventListener('scroll', previewScrollListener, { passive: true })
  }
}

function cleanupScrollSync() {
  if (editorScrollListener && editorView.value) {
    editorView.value.scrollDOM.removeEventListener('scroll', editorScrollListener)
    editorScrollListener = null
  }
  if (previewScrollListener && previewView.value) {
    previewView.value.scrollDOM.removeEventListener('scroll', previewScrollListener)
    previewScrollListener = null
  }
}

// Setup scroll sync when editors are ready and in split mode
watch([editorView, previewView, () => previewMode.value], ([editor, preview, mode]) => {
  if (mode === 'split' && editor && preview) {
    nextTick(() => {
      setupScrollSync()
    })
  } else {
    cleanupScrollSync()
  }
})

watch(
  editorView,
  (view) => {
    editorViewRef.value = view as import('@codemirror/view').EditorView | null
  },
  { immediate: true },
)

// This handles the edge case where the editor initializes after openRune has already completed
watch([editorView, currentRune], ([view, rune], [oldView]) => {
  if (view && !oldView && rune) {
    const currentContent = view.state.doc.toString()
    if (!currentContent.trim()) {
      nextTick(() => {
        if (view && rune && currentRune.value?.uuid === rune.uuid && editorView.value === view) {
          // Use the session store directly to avoid triggering openRune again
          const sessionStore = useSessionStore()
          sessionStore
            .getRune(rune.uuid)
            .then((content) => {
              if (
                view &&
                rune &&
                currentRune.value?.uuid === rune.uuid &&
                editorView.value === view
              ) {
                view.dispatch({
                  changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: content,
                  },
                })
                // Sync to preview editor if in split mode
                if (previewMode.value === 'split' && previewView.value) {
                  previewComposable.setContent(content)
                }
              }
            })
            .catch(() => {
              // Ignore errors - content might already be loading via openRune
            })
        }
      })
    }
  }
})

/**
 * Focus the editor, waiting for it to be ready if necessary
 */
function focusEditor() {
  // Try to focus immediately if editor is ready
  if (editorView.value && hasOpenRune.value && !isLoadingRune.value) {
    // Check if the editor DOM element is actually in the document
    if (editorView.value.dom && editorView.value.dom.isConnected) {
      editorView.value.focus()
      return
    }
  }

  // Otherwise, wait for editor to be ready
  const maxAttempts = 20
  let attempts = 0
  const tryFocus = () => {
    attempts++
    if (
      editorView.value &&
      hasOpenRune.value &&
      !isLoadingRune.value &&
      editorView.value.dom &&
      editorView.value.dom.isConnected
    ) {
      editorView.value.focus()
    } else if (attempts < maxAttempts) {
      setTimeout(tryFocus, 100)
    }
  }
  nextTick(() => {
    tryFocus()
  })
}

/**
 * Wrapper for openRune that also focuses the editor
 */
async function handleOpenRune(runeId: string) {
  await openRune(runeId)
  // Close graph view if open
  if (showGraphView.value) {
    showGraphView.value = false
  }
  // Reset scroll state when opening a new rune
  lastScrollTop.value = 0
  showMenuButton.value = true
  showAppBar.value = true
  lastScrollDirection = 'up'
  
  await nextTick()
  requestAnimationFrame(() => {
    setTimeout(() => {
      focusEditor()
    }, 250)
  })
}

// Focus the editor when a rune finishes loading
watch([isLoadingRune, currentRune], ([loading, rune], [oldLoading]) => {
  // Focus when loading completes and we have an open rune
  if (oldLoading && !loading && rune && hasOpenRune.value) {
        focusEditor()
  }
})

watch(
  () => route.params.runeId,
  (newRuneId) => {
    if (newRuneId && typeof newRuneId === 'string') {
      handleOpenRune(newRuneId)
    }
  },
)

// File explorer state
const expandedDirectories = ref<Set<string>>(new Set())
const selectedDirectory = ref<string>('')
const sortOrder = ref<'asc' | 'desc'>('asc')

export interface TreeNode {
  rune: RuneInfo
  children: TreeNode[]
  level: number
  parentPath: string
}

type EditingState =
  | { type: 'creating-rune'; parentPath: string }
  | { type: 'creating-directory'; parentPath: string }
  | { type: 'renaming'; runeId: string }
  | null

const editingState = ref<EditingState>(null)

function getParentPath(title: string): string {
  if (!title.includes('/')) return ''
  const parts = title.split('/').filter((p) => p)
  if (parts.length <= 1) {
    return ''
  }
  parts.pop()
  return parts.join('/') + '/'
}

function expandAllParentDirectories(fullPath: string) {
  if (!fullPath.includes('/')) return
  const parts = fullPath.split('/').filter((p) => p)
  let currentPath = ''
  for (const part of parts) {
    currentPath += part + '/'
    expandedDirectories.value.add(currentPath)
  }
  expandedDirectories.value = new Set(expandedDirectories.value)
}

function isVisible(parentPath: string): boolean {
  if (parentPath === '') return true
  const parentParts = parentPath.split('/').filter((p) => p)
  let currentPath = ''
  for (const part of parentParts) {
    currentPath += part + '/'
    if (!expandedDirectories.value.has(currentPath)) {
      return false
    }
  }
  return true
}

function buildTree(runes: RuneInfo[]): TreeNode[] {
  const tree: TreeNode[] = []
  const processed = new Set<string>()

  const sortedRunes = [...runes].sort((a, b) => {
    const aIsDir = isDirectory(a.title)
    const bIsDir = isDirectory(b.title)
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    const comparison = a.title.localeCompare(b.title)
    return sortOrder.value === 'asc' ? comparison : -comparison
  })

  function buildNode(rune: RuneInfo, level: number, parentPath: string): TreeNode | null {
    if (processed.has(rune.uuid)) return null

    if (parentPath !== '' && !isVisible(parentPath)) {
      return null
    }

    const node: TreeNode = {
      rune,
      children: [],
      level,
      parentPath,
    }

    processed.add(rune.uuid)

    if (isDirectory(rune.title)) {
      const children = sortedRunes
        .filter((child) => {
          if (child.uuid === rune.uuid) return false
          if (!child.title.startsWith(rune.title)) return false

          const remaining = child.title.slice(rune.title.length)
          const cleanRemaining = remaining.startsWith('/') ? remaining.slice(1) : remaining
          const remainingParts = cleanRemaining.split('/').filter((p) => p)
          return remainingParts.length === 1
        })
        .map((child) => buildNode(child, level + 1, rune.title))
        .filter((n): n is TreeNode => n !== null)

      node.children = children
    }

    return node
  }

  for (const rune of sortedRunes) {
    const parentPath = getParentPath(rune.title)

    const parts = rune.title.split('/').filter((p) => p)
    const isRootLevel = parts.length <= 1

    if (parentPath === '' && isRootLevel) {
      const node = buildNode(rune, 0, '')
      if (node) {
        tree.push(node)
      }
    }
  }

  return tree
}

const runeTree = computed(() => buildTree(runes.value))

// File explorer handlers
function handleRuneClick(rune: RuneInfo, event?: MouseEvent) {
  if (isDirectory(rune.title)) {
    if (expandedDirectories.value.has(rune.title)) {
      expandedDirectories.value.delete(rune.title)
    } else {
      expandedDirectories.value.add(rune.title)
    }
    expandedDirectories.value = new Set(expandedDirectories.value)
  } else {
    handleOpenRune(rune.uuid)
    selectedDirectory.value = ''
    sidebarOpen.value = false // Close sidebar when opening a rune
  }
}

function handleRuneDoubleClick(rune: RuneInfo) {
  if (isDirectory(rune.title)) {
    selectedDirectory.value = selectedDirectory.value === rune.title ? '' : rune.title
  }
}

function handleCreateRune() {
  const targetDir = selectedDirectory.value
  editingState.value = { type: 'creating-rune', parentPath: targetDir }
  if (targetDir) {
    expandAllParentDirectories(targetDir)
    expandedDirectories.value.add(targetDir)
    expandedDirectories.value = new Set(expandedDirectories.value)
  }
}

function handleCreateDirectory() {
  const targetDir = selectedDirectory.value
  editingState.value = { type: 'creating-directory', parentPath: targetDir }
  if (targetDir) {
    expandAllParentDirectories(targetDir)
    expandedDirectories.value.add(targetDir)
    expandedDirectories.value = new Set(expandedDirectories.value)
  }
}

function handleCollapseAll() {
  expandedDirectories.value.clear()
  expandedDirectories.value = new Set()
}

function handleSort() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

async function handleEditSubmit(value: string) {
  if (!editingState.value) return

  if (editingState.value.type === 'creating-rune') {
    handleCreateRuneSubmit(value)
  } else if (editingState.value.type === 'creating-directory') {
    handleCreateDirectorySubmit(value)
  } else if (editingState.value.type === 'renaming') {
    await handleRenameRuneSubmit(value)
  }
}

async function handleRenameRuneSubmit(newTitle: string) {
  if (!editingState.value || editingState.value.type !== 'renaming') return

  const runeId = editingState.value.runeId
  const rune = runes.value.find((r) => r.uuid === runeId)
  if (!rune) {
    editingState.value = null
    return
  }

  try {
    const parentPath = getParentPath(rune.title)
    const fullTitle = parentPath ? `${parentPath}${newTitle}` : newTitle
    const finalTitle = isDirectory(rune.title)
      ? fullTitle.endsWith('/')
        ? fullTitle
        : `${fullTitle}/`
      : fullTitle
    await renameRune(rune.uuid, finalTitle)
    editingState.value = null
  } catch (err) {
    console.error('Error renaming rune:', err)
    editingState.value = null
  }
}

function handleEditCancel() {
  editingState.value = null
}

async function handleCreateRuneSubmit(title: string) {
  try {
    if (!editingState.value || editingState.value.type !== 'creating-rune') return

    const targetDir = editingState.value.parentPath
    const fullTitle = targetDir ? `${targetDir}${title}` : title
    editingState.value = null

    const runeId = await createRune(fullTitle)
    expandAllParentDirectories(fullTitle)
    await handleOpenRune(runeId)
  } catch (err) {
    console.error('Error creating rune:', err)
    editingState.value = null
  }
}

async function handleCreateDirectorySubmit(title: string) {
  try {
    if (!editingState.value || editingState.value.type !== 'creating-directory') return

    const directoryTitle = title.endsWith('/') ? title : `${title}/`
    const targetDir = editingState.value.parentPath
    const fullTitle = targetDir ? `${targetDir}${directoryTitle}` : directoryTitle
    editingState.value = null

    await createRune(fullTitle, '')
    expandAllParentDirectories(fullTitle)
  } catch (err) {
    console.error('Error creating directory:', err)
    editingState.value = null
  }
}

// Codex title handlers
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let isLongPress = false
let hasMoved = false

function handleCodexTitleClick(event: MouseEvent | TouchEvent) {
  if (isRenamingCodex.value) return
  
  hasMoved = false
  isLongPress = false
  
  // Start long press timer
  longPressTimer = setTimeout(() => {
    if (!hasMoved) {
      isLongPress = true
      handleCodexTitleLongPress()
    }
  }, 500) // 500ms for long press
}

function handleCodexTitleMouseUp(event: MouseEvent | TouchEvent) {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  
  // If not a long press and didn't move, trigger rename
  if (!isLongPress && !hasMoved) {
    handleCodexTitleRename()
  }
  
  isLongPress = false
  hasMoved = false
}

function handleCodexTitleMove() {
  hasMoved = true
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleCodexTitleRename() {
  if (!currentCodex.value) return
  isRenamingCodex.value = true
  codexTitleInput.value = currentCodex.value.title
  nextTick(() => {
    codexTitleInputRef.value?.focus()
    codexTitleInputRef.value?.select()
  })
}

function handleCodexTitleLongPress() {
  if (!currentCodex.value) return
  
  confirmDialogTitle.value = 'Delete Codex'
  confirmDialogMessage.value = `Are you sure you want to delete "${currentCodex.value.title}"? This action cannot be undone.`
  confirmDialogAction.value = async () => {
    try {
      await deleteCodex()
      // Navigate back to codex selection after deletion
      router.push('/select-codex')
    } catch (err) {
      console.error('Error deleting codex:', err)
    }
  }
  showConfirmDialog.value = true
}

async function handleCodexTitleEditSubmit() {
  if (!currentCodex.value || codexTitleInput.value.trim() === currentCodex.value.title) {
    isRenamingCodex.value = false
    return
  }

  try {
    await renameCodex(codexTitleInput.value.trim())
    isRenamingCodex.value = false
  } catch (err) {
    console.error('Error renaming codex:', err)
    isRenamingCodex.value = false
  }
}

function handleCodexTitleEditCancel() {
  isRenamingCodex.value = false
}

function handleCodexTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    handleCodexTitleEditSubmit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    handleCodexTitleEditCancel()
  }
}

function handleCodexTitleBlur() {
  handleCodexTitleEditSubmit()
}

// Watch for rename mode to setup input
watch(isRenamingCodex, (isRenaming) => {
  if (isRenaming) {
    codexTitleInput.value = currentCodex.value?.title || ''
    nextTick(() => {
      codexTitleInputRef.value?.focus()
      codexTitleInputRef.value?.select()
    })
  }
})

function handleSettings() {
  showSettingsModal.value = true
  sidebarOpen.value = false
}

function handleExit() {
  sessionStore.teardown()
  router.push('/auth')
}

// Helper function to extract base name from full path
function getBaseName(fullTitle: string): string {
  const parts = fullTitle.split('/').filter((p) => p)
  return parts[parts.length - 1] || fullTitle
}

// Touch-based drag and drop handlers
let currentTouchRune: RuneInfo | null = null

function findRuneFromElement(element: HTMLElement): RuneInfo | null {
  const runeItem = element.closest('.rune-item')
  if (!runeItem) return null
  
  // Try to get rune UUID from data attribute first (most reliable)
  const runeUuid = (runeItem as HTMLElement).dataset?.runeUuid
  if (runeUuid) {
    const foundRune = runes.value.find(r => r.uuid === runeUuid)
    if (foundRune) return foundRune
  }
  
  // Try to find rune by matching the text content with rune titles
  const itemText = (runeItem.textContent || '').trim()
  if (!itemText) return null
  
  // Get all rune items in order
  const allRuneItems = Array.from(document.querySelectorAll('.sidebar-content .rune-item'))
  const itemIndex = allRuneItems.indexOf(runeItem)
  
  // Try to match by index in the tree
  const treeNodes = runeTree.value
  function findRuneInTree(nodes: typeof treeNodes, targetIndex: number, currentIndex: { value: number }): RuneInfo | null {
    for (const node of nodes) {
      if (currentIndex.value === targetIndex) {
        return node.rune
      }
      currentIndex.value++
      if (node.children.length > 0 && expandedDirectories.value.has(node.rune.title)) {
        const found = findRuneInTree(node.children, targetIndex, currentIndex)
        if (found) return found
      }
    }
    return null
  }
  
  const foundByIndex = findRuneInTree(treeNodes, itemIndex, { value: 0 })
  if (foundByIndex) return foundByIndex
  
  // Fallback: match by text content
  for (const rune of runes.value) {
    const displayName = getBaseName(rune.title)
    if (itemText.includes(displayName) || itemText.includes(rune.title)) {
      return rune
    }
  }
  
  return null
}

function handleSidebarTouchStart(event: TouchEvent) {
  if (editingState.value || isDraggingRune.value) return
  
  const target = event.target as HTMLElement
  const foundRune = findRuneFromElement(target)
  if (!foundRune) return
  
  // Prevent default to allow better touch handling
  event.preventDefault()
  event.stopPropagation()
  
  currentTouchRune = foundRune
  dragHasMoved = false
  dragStartPosition.value = {
    x: event.touches[0].clientX,
    y: event.touches[0].clientY,
  }
  
  // Start long press timer
  dragLongPressTimer = setTimeout(() => {
    if (!dragHasMoved && currentTouchRune) {
      startDrag(currentTouchRune, dragStartPosition.value)
      // Prevent scrolling when drag starts
      const runeItem = target.closest('.rune-item') as HTMLElement
      if (runeItem) {
        runeItem.style.touchAction = 'none'
      }
      // Also prevent scrolling on sidebar content
      if (sidebarContentRef.value) {
        sidebarContentRef.value.style.touchAction = 'none'
        sidebarContentRef.value.style.overflowY = 'hidden'
      }
    }
  }, 500) // 500ms for long press
}

function handleSidebarTouchMove(event: TouchEvent) {
  if (!isDraggingRune.value && currentTouchRune) {
    // Check if moved enough to cancel long press
    const deltaX = Math.abs(event.touches[0].clientX - dragStartPosition.value.x)
    const deltaY = Math.abs(event.touches[0].clientY - dragStartPosition.value.y)
    if (deltaX > 10 || deltaY > 10) {
      dragHasMoved = true
      if (dragLongPressTimer) {
        clearTimeout(dragLongPressTimer)
        dragLongPressTimer = null
      }
    }
    // Allow scrolling if not dragging
    return
  }

  if (!isDraggingRune.value) return
  
  // Prevent scrolling and other default behaviors during drag
  event.preventDefault()
  event.stopPropagation()
  
  const touch = event.touches[0]
  if (!touch) return
  
  dragCurrentPosition.value = {
    x: touch.clientX,
    y: touch.clientY,
  }
  
  // Check if over trash icon
  const trashElement = document.querySelector('.trash-drop-zone') as HTMLElement
  if (trashElement) {
    const trashRect = trashElement.getBoundingClientRect()
    const isOver = (
      touch.clientX >= trashRect.left &&
      touch.clientX <= trashRect.right &&
      touch.clientY >= trashRect.top &&
      touch.clientY <= trashRect.bottom
    )
    isOverTrash.value = isOver
  } else {
    isOverTrash.value = false
  }
  
  // Check if over edit icon
  const editElement = document.querySelector('.edit-drop-zone') as HTMLElement
  if (editElement) {
    const editRect = editElement.getBoundingClientRect()
    const isOver = (
      touch.clientX >= editRect.left &&
      touch.clientX <= editRect.right &&
      touch.clientY >= editRect.top &&
      touch.clientY <= editRect.bottom
    )
    isOverEdit.value = isOver
  } else {
    isOverEdit.value = false
  }
  
  // Check if over a directory
  const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY)
  if (elementUnderTouch) {
    const targetRune = findRuneFromElement(elementUnderTouch as HTMLElement)
    if (targetRune && isDirectory(targetRune.title) && targetRune.uuid !== draggedRune.value?.uuid) {
      // Check if it's not a child of the dragged directory
      if (draggedRune.value && isDirectory(draggedRune.value.title)) {
        if (targetRune.title.startsWith(draggedRune.value.title)) {
          dragOverRune.value = null
          return
        }
      }
      dragOverRune.value = targetRune
      return
    }
  }

  dragOverRune.value = null
}

function handleSidebarTouchEnd(event: TouchEvent) {
  if (dragLongPressTimer) {
    clearTimeout(dragLongPressTimer)
    dragLongPressTimer = null
  }
  
  if (!isDraggingRune.value) {
    dragHasMoved = false
    currentTouchRune = null
    // Restore touch action
    const target = event.target as HTMLElement
    const runeItem = target.closest('.rune-item') as HTMLElement
    if (runeItem) {
      runeItem.style.touchAction = ''
    }
    return
  }
  
  event.preventDefault()
  event.stopPropagation()

  // Handle drop
  if (isOverEdit.value && draggedRune.value) {
    // Edit/rename the rune
    handleEditDrop()
  } else if (isOverTrash.value && draggedRune.value) {
    // Delete the rune
    handleTrashDrop()
  } else if (dragOverRune.value && draggedRune.value) {
    // Drop on directory
    handleRuneDrop(dragOverRune.value)
  } else if (draggedRune.value) {
    // Drop at root level
    handleRuneDrop(null)
  }
  
  endDrag()
  currentTouchRune = null
}

function handleSidebarTouchCancel(event: TouchEvent) {
  // Treat touch cancel same as touch end
  handleSidebarTouchEnd(event)
}

function startDrag(rune: RuneInfo, position: { x: number; y: number }) {
  draggedRune.value = rune
  isDraggingRune.value = true
  dragCurrentPosition.value = position
  showTrashIcon.value = true
  showEditIcon.value = true
  dragHasMoved = false
  
  // Add dragging class to sidebar content
  if (sidebarContentRef.value) {
    sidebarContentRef.value.classList.add('dragging')
  }
}

function endDrag() {
  draggedRune.value = null
  dragOverRune.value = null
  isDraggingRune.value = false
  showTrashIcon.value = false
  isOverTrash.value = false
  showEditIcon.value = false
  isOverEdit.value = false
  dragHasMoved = false
  
  // Restore touch action on all rune items
  const allRuneItems = document.querySelectorAll('.sidebar-content .rune-item')
  allRuneItems.forEach((item) => {
    (item as HTMLElement).style.touchAction = ''
  })
  
  // Restore sidebar content scrolling and remove dragging class
  if (sidebarContentRef.value) {
    sidebarContentRef.value.classList.remove('dragging')
    sidebarContentRef.value.style.touchAction = ''
    sidebarContentRef.value.style.overflowY = ''
  }
}

async function handleRuneDrop(targetRune: RuneInfo | null) {
  if (!draggedRune.value) return

  const sourceRune = draggedRune.value
  const sourceTitle = sourceRune.title
  const isSourceDir = isDirectory(sourceTitle)

  // Determine target directory path
  let targetPath = ''
  if (targetRune && isDirectory(targetRune.title)) {
    targetPath = targetRune.title
  } else {
    // Dropping at root level
    targetPath = ''
  }

  // Can't drop on self
  if (targetRune && sourceTitle === targetRune.title) {
    return
  }

  // Can't drop a directory on its own child
  if (isSourceDir && targetRune && targetRune.title.startsWith(sourceTitle)) {
    return
  }

  try {
    // Extract the base name from the source title
    const baseName = getBaseName(sourceTitle)

    // Build the new title
    let newTitle: string
    if (targetPath === '') {
      // Moving to root
      newTitle = isSourceDir && !baseName.endsWith('/') ? `${baseName}/` : baseName
    } else {
      // Moving to a directory
      const targetDir = targetPath.endsWith('/') ? targetPath : `${targetPath}/`
      newTitle =
        isSourceDir && !baseName.endsWith('/')
          ? `${targetDir}${baseName}/`
          : `${targetDir}${baseName}`
    }

    // Check if the new title already exists
    const existingRune = runes.value.find((r) => r.title === newTitle && r.uuid !== sourceRune.uuid)
    if (existingRune) {
      console.error(`A ${isSourceDir ? 'directory' : 'file'} with that name already exists in the target location`)
      return
    }

    // Perform the move by renaming
    await renameRune(sourceRune.uuid, newTitle)

    // Expand the target directory if it's a directory
    if (targetRune && isDirectory(targetRune.title)) {
      expandedDirectories.value.add(targetRune.title)
      expandedDirectories.value = new Set(expandedDirectories.value)
    }
  } catch (err) {
    console.error('Error moving rune:', err)
  }
}

async function handleTrashDrop() {
  if (!draggedRune.value) return
  
  const runeToDelete = draggedRune.value
  try {
    await deleteRune(runeToDelete.uuid)
            } catch (err) {
    console.error('Error deleting rune:', err)
  }
}

function handleEditDrop() {
  if (!draggedRune.value) return
  
  const runeToEdit = draggedRune.value
  // Enter rename mode
  editingState.value = { type: 'renaming', runeId: runeToEdit.uuid }
  
  // Expand parent directories if needed
  const parentPath = getParentPath(runeToEdit.title)
  if (parentPath) {
    expandAllParentDirectories(parentPath)
  }
}

onMounted(() => {
  const runeId = route.params.runeId as string | undefined
  if (runeId) {
    handleOpenRune(runeId)
  }

  // Add global mouse event listeners for bottom sheet dragging
  document.addEventListener('mousemove', handleBottomSheetMouseMove)
  document.addEventListener('mouseup', handleBottomSheetMouseUp)
  
  // Add touch event listeners with passive: false for drag and drop
  nextTick(() => {
    if (sidebarContentRef.value) {
      // Remove Vue's event handlers and add our own with passive: false
      sidebarContentRef.value.addEventListener('touchstart', handleSidebarTouchStart, { passive: false })
      sidebarContentRef.value.addEventListener('touchmove', handleSidebarTouchMove, { passive: false })
      sidebarContentRef.value.addEventListener('touchend', handleSidebarTouchEnd, { passive: false })
      sidebarContentRef.value.addEventListener('touchcancel', handleSidebarTouchCancel, { passive: false })
    }
  })
})

onUnmounted(() => {
  // Cleanup scroll sync
  cleanupScrollSync()
  // Cleanup scroll listener
  cleanupScrollListener()
  // Cleanup preview editor
  if (previewView.value) {
    previewComposable.destroy()
  }
  // Cleanup touch event listeners
  if (sidebarContentRef.value) {
    sidebarContentRef.value.removeEventListener('touchstart', handleSidebarTouchStart)
    sidebarContentRef.value.removeEventListener('touchmove', handleSidebarTouchMove)
    sidebarContentRef.value.removeEventListener('touchend', handleSidebarTouchEnd)
    sidebarContentRef.value.removeEventListener('touchcancel', handleSidebarTouchCancel)
  }

  // Cleanup upload handlers
  if (dragDropCleanup) {
    dragDropCleanup()
  }
  if (pasteCleanup) {
    pasteCleanup()
  }

  // Remove global mouse event listeners for bottom sheet dragging
  document.removeEventListener('mousemove', handleBottomSheetMouseMove)
  document.removeEventListener('mouseup', handleBottomSheetMouseUp)

  editorComposable.destroy()
})
</script>

<template>
  <main class="editor-layout">
    <!-- Top-left Menu Button -->
    <button
      class="menu-button"
      :class="{ hidden: sidebarOpen || !showMenuButton }"
      @click="sidebarOpen = !sidebarOpen"
      aria-label="Toggle sidebar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
        <path d="m14 9 3 3-3 3" />
      </svg>
    </button>

    <!-- Top-right Preview Toggle Button -->
    <button
      class="preview-button"
      :class="{ hidden: sidebarOpen || !showMenuButton }"
      @click="handlePreviewToggle"
      aria-label="Toggle preview"
    >
      <svg
        v-if="previewMode === 'edit'"
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>

    <!-- Sidebar -->
    <div class="sidebar-overlay" :class="{ open: sidebarOpen }" @click="sidebarOpen = false">
      <aside class="sidebar" :class="{ open: sidebarOpen }" @click.stop>
        <div class="sidebar-header">
          <div
            class="sidebar-title"
            :class="{ editing: isRenamingCodex }"
            @mousedown="handleCodexTitleClick"
            @mouseup="handleCodexTitleMouseUp"
            @mouseleave="handleCodexTitleMouseUp"
            @mousemove="handleCodexTitleMove"
            @touchstart="handleCodexTitleClick"
            @touchend="handleCodexTitleMouseUp"
            @touchcancel="handleCodexTitleMouseUp"
            @touchmove="handleCodexTitleMove"
          >
            <h2 v-if="!isRenamingCodex">{{ currentCodex?.title || 'Codex' }}</h2>
            <div v-else class="codex-title-input-wrapper">
              <input
                ref="codexTitleInputRef"
                v-model="codexTitleInput"
                type="text"
                class="codex-title-input"
                @keydown="handleCodexTitleKeydown"
                @blur="handleCodexTitleBlur"
              />
            </div>
          </div>
        </div>
        <div class="sidebar-actions">
          <CodexRuneActions
            @new-rune="handleCreateRune"
            @new-directory="handleCreateDirectory"
            @sort="handleSort"
            @collapse="handleCollapseAll"
          />
        </div>
        <div ref="sidebarContentRef" class="sidebar-content">
          <CodexRuneList
            :rune-tree="runeTree"
            :current-rune-id="currentRune?.uuid ?? null"
            :expanded-directories="expandedDirectories"
            :selected-directory="selectedDirectory"
            :is-directory="isDirectory"
            :editing-state="editingState"
            :drag-over-rune-id="dragOverRune?.uuid ?? null"
            :dragged-rune-id="draggedRune?.uuid ?? null"
            @rune-click="handleRuneClick"
            @rune-double-click="handleRuneDoubleClick"
            @create-rune="handleCreateRune"
            @create-directory="handleCreateDirectory"
            @clear-selection="selectedDirectory = ''"
            @collapse-all="handleCollapseAll"
            @sort="handleSort"
            @edit-submit="handleEditSubmit"
            @edit-cancel="handleEditCancel"
          />
        </div>
        <div class="sidebar-footer">
          <div class="sidebar-header-buttons">
            <button class="sidebar-icon-button" @click="handleSettings" aria-label="Settings">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
                />
              </svg>
            </button>
            <button class="sidebar-icon-button" @click="handleExit" aria-label="Exit">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </div>

    <!-- Editor Area -->
    <!-- Graph View -->
    <div v-if="showGraphView" class="graph-view-container">
      <button class="graph-view-close-button" @click="handleCloseGraphView" aria-label="Close graph view">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <CodexGraphView :open-rune="handleOpenRune" />
    </div>

    <!-- Editor Container -->
    <div v-else class="editor-container" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="editor-fade-top"></div>
      <CodexEditorArea
        :has-open-rune="hasOpenRune"
        :is-loading-rune="isLoadingRune"
        :current-rune-id="currentRune?.uuid ?? null"
        :preview-mode="previewMode"
        :is-graph-tab="false"
        :is-dragging-over="isDraggingOver"
        :open-rune="handleOpenRune"
        @update:editor-element="editorElement = $event"
        @update:preview-element="previewElement = $event"
      />
      <div class="editor-fade-bottom"></div>
    </div>

    <!-- Bottom App Bar -->
    <div class="app-bar" :class="{ hidden: !showAppBar || sidebarOpen }">
      <button
        class="app-bar-button"
        :class="{ muted: !canUndo }"
        @click="handleUndo"
        aria-label="Undo"
        :disabled="!canUndo"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
      </button>
      <button
        class="app-bar-button"
        :class="{ muted: !canRedo }"
        @click="handleRedo"
        aria-label="Redo"
        :disabled="!canRedo"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
        </svg>
      </button>
      <button class="app-bar-button" @click="handleSearch" aria-label="Search">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      <button class="app-bar-button app-bar-button-add" @click="handleAddRune" aria-label="Add rune">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </button>
      <button class="app-bar-button" @click="handleOptions" aria-label="Options">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 17H5" />
          <path d="M19 7h-9" />
          <circle cx="17" cy="17" r="3" />
          <circle cx="7" cy="7" r="3" />
        </svg>
      </button>
    </div>

    <!-- Bottom Sheet -->
    <Transition name="bottom-sheet">
      <div
        v-if="bottomSheetOpen"
        class="bottom-sheet-overlay"
        @click="closeBottomSheet"
      >
        <div
          class="bottom-sheet"
          :class="{ dragging: isDragging }"
          :style="{ height: `${bottomSheetHeight}px` }"
          @click.stop
        >
          <div
            class="bottom-sheet-drag-area"
            @touchstart="handleBottomSheetTouchStart"
            @touchmove="handleBottomSheetTouchMove"
            @touchend="handleBottomSheetTouchEnd"
            @mousedown="handleBottomSheetMouseDown"
          >
            <div class="bottom-sheet-handle" />
          </div>
          <div class="bottom-sheet-content">
            <div class="bottom-sheet-options">
              <button
                class="bottom-sheet-option-button"
                :class="{ disabled: isSyncing }"
                :disabled="isSyncing"
                @click="handleSync"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                <span>Sync</span>
              </button>
            <div class="bottom-sheet-divider"></div>
            <div class="bottom-sheet-options">
              <button
                class="bottom-sheet-option-button"
                :class="{ disabled: !hasOpenRune }"
                :disabled="!hasOpenRune"
                @click="handleUploadSigil"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload Sigil</span>
              </button>
              <button
                class="bottom-sheet-option-button"
                :class="{ disabled: !hasOpenRune }"
                :disabled="!hasOpenRune"
                @click="handleExportRune"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export Rune</span>
              </button>
              <button
                class="bottom-sheet-option-button"
                :class="{ disabled: !hasOpenCodex }"
                :disabled="!hasOpenCodex"
                @click="handleExportCodex"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export Codex</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Hidden file input for sigil upload -->
    <input
      ref="sigilFileInputRef"
      type="file"
      accept="image/*,video/*,audio/*"
      style="display: none"
      @change="handleSigilFileSelected"
    />

    <!-- Confirmation Dialog -->
    <Modal
      v-model:show="showConfirmDialog"
      :title="confirmDialogTitle"
      :message="confirmDialogMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      :destructive="true"
      max-width="calc(100vw - 2rem)"
      @confirm="confirmDialogAction?.()"
    />

    <!-- Settings Modal -->
    <SettingsModal v-model:show="showSettingsModal" />

    <!-- Add Rune Modal -->
    <Modal
      v-model:show="showAddRuneModal"
      title="Create New Rune"
      confirm-text="Create"
      cancel-text="Cancel"
      max-width="calc(100vw - 2rem)"
      @confirm="handleAddRuneConfirm"
      @cancel="handleAddRuneCancel"
    >
      <div class="add-rune-modal-content">
        <input
          ref="newRuneNameInputRef"
          v-model="newRuneName"
          type="text"
          class="add-rune-input"
          placeholder="Enter rune name..."
          @keydown="handleAddRuneKeydown"
        />
      </div>
    </Modal>

    <!-- Command Palette -->
    <div class="command-palette-wrapper">
      <CommandPalette
        v-model:show="showCommandPalette"
        :codex-title="currentCodex?.title || null"
        :runes="runes"
        :is-directory="isDirectory"
        :search-runes="searchRunes"
        @select="handleCommandPaletteSelect"
        @command="handleCommandPaletteCommand"
      />
    </div>

    <!-- Trash Drop Zone -->
    <Transition name="trash-fade">
      <div
        v-if="showTrashIcon"
        class="trash-drop-zone"
        :class="{ 'drag-over': isOverTrash }"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </div>
    </Transition>

    <!-- Edit Drop Zone -->
    <Transition name="edit-fade">
      <div
        v-if="showEditIcon"
        class="edit-drop-zone"
        :class="{ 'drag-over': isOverEdit }"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.editor-layout {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
  font-family: var(--font-primary);
  position: relative;
}

/* Top-left Menu Button */
.menu-button {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 1001;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  cursor: pointer;
  transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.menu-button:hover {
  opacity: 0.7;
}

.menu-button:active {
  opacity: 0.5;
}

.menu-button.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-100%);
}

.menu-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Top-right Preview Toggle Button */
.preview-button {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1001; /* Same as menu button, behind sidebar when open */
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  cursor: pointer;
  transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.preview-button:hover {
  opacity: 0.7;
}

.preview-button:active {
  opacity: 0.5;
}

.preview-button.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-100%);
}

.preview-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Sidebar */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-modal-backdrop);
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  pointer-events: none;
}

.sidebar-overlay.open {
  opacity: 1;
  visibility: visible;
  pointer-events: all;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 75vw;
  max-width: 85vw;
  background: var(--color-background);
  border-right: 1px solid var(--color-overlay-border);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 3.5rem;
  min-height: 3.5rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
  gap: 0.5rem;
  flex-shrink: 0;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-top: 1px solid var(--color-overlay-subtle);
  background: var(--color-background);
}

.sidebar-header-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
}

.sidebar-actions {
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-overlay-subtle);
}

.sidebar-icon-button {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
}

.sidebar-icon-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.sidebar-icon-button:active {
  background: var(--color-overlay-active);
  color: var(--color-foreground);
  opacity: 1;
}

.sidebar-icon-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

.sidebar-title {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  position: relative;
  padding-left: 0.5rem;
  margin-left: -0.5rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 0.125rem;
  height: 0;
  background: var(--color-accent);
  border-radius: 1px;
  transition: height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
}

.sidebar-title:hover:not(.editing)::before {
  height: 60%;
  opacity: 1;
}

.sidebar-title:hover:not(.editing) h2 {
  opacity: 1;
  color: var(--color-foreground);
  transform: translateX(0.125rem);
}

.sidebar-title h2 {
  font-size: 1rem;
  font-weight: 400;
  color: var(--color-foreground);
  margin: 0;
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
  padding: 0.25rem 0;
  transition:
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.codex-title-input-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 1.5em;
}

.codex-title-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  color: var(--color-foreground);
  font-size: 1rem;
  font-family: inherit;
  font-weight: 400;
  outline: none;
  line-height: 1.5;
  box-sizing: border-box;
  height: 1.5em;
  letter-spacing: -0.015em;
  transition: all 0.15s ease;
}

.sidebar-title.editing .codex-title-input {
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.sidebar-title.editing .codex-title-input:focus {
  background: var(--color-overlay-light);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  margin: 0;
  box-shadow: 0 0 0 2px var(--color-selection);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 0 0 0;
  width: 100%;
  min-height: 0;
}

/* Hide the rune actions inside CodexRuneList since we show them separately */
.sidebar-content :deep(.rune-actions) {
  display: none;
}

/* Hide the section header inside CodexRuneList for mobile */
.sidebar-content :deep(.section-header) {
  display: none;
}

.sidebar-content::-webkit-scrollbar {
  width: 0.25rem;
}

.sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-content::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 2px;
}

.sidebar-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}

/* Editor Container */
.editor-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0; /* Full height, content scrolls behind app bar */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: margin-left 0.3s ease;
  z-index: 1;
}

.editor-container :deep(.editor-area) {
  height: 100%;
  width: 100%;
}

/* Add extra padding to editor content for scrollability */
.editor-container :deep(.cm-content) {
  padding-top: 4rem !important; /* Extra top margin */
  padding-bottom: calc(2rem + 4rem + 50vh) !important; /* 2rem base + 4rem app bar + 50vh extra space */
}

.editor-container :deep(.cm-scroller) {
  min-height: 100%;
}

.editor-fade-top,
.editor-fade-bottom {
  position: absolute;
  left: 0;
  right: 0;
  height: 5rem;
  pointer-events: none;
  z-index: 10;
}

.editor-fade-top {
  top: 0;
  background: linear-gradient(
    to bottom,
    var(--color-background) 0%,
    var(--color-background) 15%,
    color-mix(in srgb, var(--color-background) 85%, transparent) 30%,
    color-mix(in srgb, var(--color-background) 60%, transparent) 50%,
    color-mix(in srgb, var(--color-background) 40%, transparent) 70%,
    color-mix(in srgb, var(--color-background) 25%, transparent) 85%,
    color-mix(in srgb, var(--color-background) 20%, transparent) 100%
  );
}

.editor-fade-bottom {
  bottom: 0;
  background: linear-gradient(
    to top,
    var(--color-background) 0%,
    var(--color-background) 15%,
    color-mix(in srgb, var(--color-background) 85%, transparent) 30%,
    color-mix(in srgb, var(--color-background) 60%, transparent) 50%,
    color-mix(in srgb, var(--color-background) 40%, transparent) 70%,
    color-mix(in srgb, var(--color-background) 25%, transparent) 85%,
    color-mix(in srgb, var(--color-background) 20%, transparent) 100%
  );
}

/* Bottom App Bar */
.app-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4rem;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 1rem;
  z-index: 100; /* Above editor (z-index: 1) but below sidebar (z-index: 1001) */
  transition: transform 0.3s ease, opacity 0.3s ease, visibility 0.3s ease;
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
}

.app-bar.hidden {
  transform: translateY(100%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.app-bar-button {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}


.app-bar-button:disabled {
  cursor: not-allowed;
}

.app-bar-button.muted {
  color: var(--color-muted);
}

.app-bar-button-add {
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  color: var(--color-foreground);
  border-radius: 0.5rem;
}


.app-bar-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Bottom Sheet */
.bottom-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-modal-backdrop);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bottom-sheet {
  width: 100%;
  max-width: 100%;
  background: var(--color-background);
  border-top: 1px solid var(--color-overlay-border);
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
  display: flex;
  flex-direction: column;
  transition: height 0.3s ease;
  touch-action: none;
  user-select: none;
  overflow: hidden;
  min-height: 0;
  box-shadow: 0 -4px 12px var(--color-modal-shadow);
}

.bottom-sheet.dragging {
  transition: none;
}

.bottom-sheet-drag-area {
  flex-shrink: 0;
  padding: 0.5rem;
  cursor: grab;
  touch-action: none;
}

.bottom-sheet-drag-area:active {
  cursor: grabbing;
}

.bottom-sheet-handle {
  width: 2.5rem;
  height: 0.25rem;
  background: var(--color-overlay-border);
  border-radius: 0.125rem;
  margin: 0 auto;
}

.bottom-sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  padding-bottom: calc(4rem + 1rem); /* Account for app bar */
  min-height: 0;
}

.bottom-sheet-options {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}

.bottom-sheet-divider {
  height: 1px;
  background: var(--color-overlay-border);
  margin: 0.75rem 0;
  flex-shrink: 0;
}

.bottom-sheet-option-button {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  margin: 0.0625rem 0;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
  text-align: left;
  will-change: transform;
}

.bottom-sheet-option-button:hover:not(:disabled) {
  background: var(--color-overlay-subtle);
}

.bottom-sheet-option-button:active:not(:disabled) {
  background: var(--color-overlay-light);
  transform: scale(0.98);
}

.bottom-sheet-option-button:disabled,
.bottom-sheet-option-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: var(--color-muted);
}

.bottom-sheet-option-button svg {
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-foreground);
  opacity: 0.8;
}

.bottom-sheet-option-button:hover:not(:disabled) svg {
  opacity: 1;
}

.bottom-sheet-option-button:disabled svg,
.bottom-sheet-option-button.disabled svg {
  opacity: 0.4;
  color: var(--color-muted);
}

/* Bottom sheet transition animations */
.bottom-sheet-enter-active {
  transition: opacity 0.3s ease;
}

.bottom-sheet-leave-active {
  transition: opacity 0.3s ease;
}

.bottom-sheet-enter-from {
  opacity: 0;
}

.bottom-sheet-leave-to {
  opacity: 0;
}

/* Drag and drop styles for image upload */
:deep(.cm-editor.drag-over) {
  outline: 2px dashed var(--color-accent);
  outline-offset: -2px;
  background: var(--color-overlay-light);
}

/* Mobile-specific modal styles */
:deep(.modal-dialog) {
  max-width: calc(100vw - 2rem) !important;
  margin: auto !important;
  padding: 1rem;
  box-sizing: border-box;
}

:deep(.modal-container) {
  max-width: 100% !important;
  width: 100% !important;
  margin: 0;
}

:deep(.modal-header) {
  padding: 1rem !important;
}

:deep(.modal-header h3) {
  font-size: 1rem !important;
}

:deep(.modal-body) {
  padding: 1rem !important;
}

:deep(.modal-body p) {
  font-size: 0.875rem !important;
  line-height: 1.5;
}

:deep(.modal-footer) {
  padding: 1rem !important;
  flex-direction: column-reverse;
  gap: 0.5rem;
}

:deep(.modal-footer .button) {
  width: 100%;
  padding: 0.75rem 1rem !important;
  font-size: 0.9375rem !important;
}

/* Trash Drop Zone */
.trash-drop-zone {
  position: fixed;
  bottom: 2rem;
  left: calc(50% + 4rem);
  transform: translateX(-50%);
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--color-overlay-light);
  border: 2px solid var(--color-overlay-border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px var(--color-modal-shadow);
}

.trash-drop-zone.drag-over {
  background: var(--color-error);
  border-color: var(--color-error);
  transform: translateX(-50%) scale(1.1);
}

.trash-drop-zone svg {
  color: var(--color-foreground);
  width: 1.5rem;
  height: 1.5rem;
}

.trash-drop-zone.drag-over svg {
  color: var(--color-background);
}

/* Trash fade transition */
.trash-fade-enter-active,
.trash-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.trash-fade-enter-from,
.trash-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}

/* Drag over state for rune items */
:deep(.rune-item.drag-over) {
  background: var(--color-overlay-light);
  border-left: 2px solid var(--color-accent);
}

/* Edit Drop Zone */
.edit-drop-zone {
  position: fixed;
  bottom: 2rem;
  left: calc(50% - 4rem);
  transform: translateX(-50%);
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: var(--color-overlay-light);
  border: 2px solid var(--color-overlay-border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px var(--color-modal-shadow);
}

.edit-drop-zone.drag-over {
  background: var(--color-accent);
  border-color: var(--color-accent);
  transform: translateX(-50%) scale(1.1);
}

.edit-drop-zone svg {
  color: var(--color-foreground);
  width: 1.5rem;
  height: 1.5rem;
}

.edit-drop-zone.drag-over svg {
  color: var(--color-background);
}

/* Edit fade transition */
.edit-fade-enter-active,
.edit-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.edit-fade-enter-from,
.edit-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(1rem);
}

/* Add data attributes to rune items for touch drag and drop */
.sidebar-content {
  touch-action: pan-y;
}

:deep(.sidebar-content .rune-item) {
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

/* When dragging, prevent all touch actions */
:deep(.sidebar-content .rune-item.is-dragged) {
  touch-action: none;
}

/* When dragging, prevent scrolling on sidebar */
.sidebar-content.dragging {
  touch-action: none;
  overflow-y: hidden !important;
}

/* Command Palette mobile styles */
/* Override CommandPalette's modal styles for mobile with higher specificity */
/* The CommandPalette passes max-width="36rem" to Modal, which sets inline styles */
/* We need to override both the scoped styles and inline styles */
/* Using media query to ensure these only apply on mobile devices */

@media (max-width: 768px) {
  .command-palette-wrapper :deep(.modal-dialog) {
    max-width: calc(100vw - 1rem) !important;
    width: calc(100vw - 1rem) !important;
    margin: 0.5rem auto !important;
    padding: 0 !important;
  }

  /* Override inline styles from Modal component's max-width prop */
  /* Modal sets :style="{ width: maxWidth, maxWidth: maxWidth }" */
  /* Using attribute selector to increase specificity */
  .command-palette-wrapper :deep(.modal-container),
  .command-palette-wrapper :deep(.modal-container[style]) {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
  }

  .command-palette-wrapper :deep(.modal-header) {
    padding: 0.75rem 1rem !important;
  }

  .command-palette-wrapper :deep(.modal-body) {
    padding: 0 !important;
    max-height: calc(100vh - 8rem) !important;
  }

  .command-palette-wrapper :deep(.command-palette-container) {
    max-height: calc(100vh - 8rem) !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0.75rem !important;
    box-sizing: border-box !important;
  }

  .command-palette-wrapper :deep(.command-palette-results) {
    max-height: calc(100vh - 12rem) !important;
    overflow-y: auto !important;
  }

  .command-palette-wrapper :deep(.command-palette-input) {
    font-size: 1rem !important;
    padding: 0.75rem !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .command-palette-wrapper :deep(.command-palette-item) {
    padding: 0.75rem 1rem !important;
    font-size: 0.9375rem !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .command-palette-wrapper :deep(.command-palette-item-content) {
    gap: 0.25rem !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  .command-palette-wrapper :deep(.command-palette-item-path) {
    font-size: 0.75rem !important;
  }

  .command-palette-wrapper :deep(.command-palette-item-description) {
    font-size: 0.75rem !important;
  }

  .command-palette-wrapper :deep(.command-palette-item-snippet) {
    font-size: 0.75rem !important;
  }
}

/* Graph View Styles */
.graph-view-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  background: var(--color-background);
}

.graph-view-close-button {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 1002;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-light);
  border: 1px solid var(--color-overlay-border);
  border-radius: 0.5rem;
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.9;
}

.graph-view-close-button:hover {
  opacity: 1;
  background: var(--color-overlay);
}

.graph-view-close-button:active {
  transform: scale(0.95);
}

/* Hide graph filters on mobile */
.graph-view-container :deep(.graph-filters) {
  display: none;
}

/* Ensure graph view takes full space */
.graph-view-container :deep(.graph-view) {
  width: 100%;
  height: 100%;
}

.graph-view-container :deep(.graph-svg) {
  width: 100%;
  height: 100%;
}

/* Add Rune Modal Styles */
.add-rune-modal-content {
  padding: 0.5rem 0;
}

.add-rune-input {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  background: var(--color-background);
  border: 1px solid var(--color-overlay-border);
  border-radius: 0.5rem;
  color: var(--color-foreground);
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.add-rune-input:focus {
  border-color: var(--color-accent);
}

.add-rune-input::placeholder {
  color: var(--color-muted);
  opacity: 0.6;
}

/* Mobile-specific modal styles for add rune */
@media (max-width: 768px) {
  .add-rune-modal-content {
    padding: 0.25rem 0;
  }

  .add-rune-input {
    font-size: 1rem;
    padding: 0.75rem;
  }
}
</style>
