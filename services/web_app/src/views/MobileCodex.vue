<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ViewUpdate } from '@codemirror/view'
import { useEditor, type PreviewMode } from '@/composables/useEditor'
import { useCodex } from '@/composables/useCodex'
import { useSessionStore } from '@/stores/session'
import { useMediaUpload } from '@/composables/useMediaUpload'
import { MediaEntryType } from '@/interfaces/manifest'
import CodexEditorArea from '@/components/codex/CodexEditorArea.vue'

const route = useRoute()

// Sidebar state
const sidebarOpen = ref(false)

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

// Undo/redo availability (stubbed for now)
const canUndo = ref(false)
const canRedo = ref(false)

// App bar button handlers (no functionality yet)
function handleUndo() {
  // TODO: Implement undo
}

function handleRedo() {
  // TODO: Implement redo
}

function handleSearch() {
  // TODO: Implement search
}

function handleAddRune() {
  // TODO: Implement add rune
}

function handleOptions() {
  if (bottomSheetOpen.value) {
    closeBottomSheet()
  } else {
    openBottomSheet()
  }
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
  hasOpenRune,
  openRune,
  isLoadingRune,
  getSigilUrl,
  createAutoSaveCallback,
} = useCodex(editorViewRef, { autoSave: true })

const autoSaveCallback = createAutoSaveCallback()

// Get session store for manifest entry type resolver
const sessionStore = useSessionStore()

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
const { isDraggingOver } = mediaUploadHandler

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
      // Focus the editor if we just got a view and have an open rune that's not loading
      if (!oldView && hasOpenRune.value && !isLoadingRune.value) {
        focusEditor()
      }
    })
  } else {
    // Cleanup when view is destroyed
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

// Apply preview mode when currentRune changes
watch(currentRune, () => {
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

onMounted(() => {
  const runeId = route.params.runeId as string | undefined
  if (runeId) {
    handleOpenRune(runeId)
  }

  // Add global mouse event listeners for bottom sheet dragging
  document.addEventListener('mousemove', handleBottomSheetMouseMove)
  document.addEventListener('mouseup', handleBottomSheetMouseUp)
})

onUnmounted(() => {
  // Cleanup scroll sync
  cleanupScrollSync()
  // Cleanup preview editor
  if (previewView.value) {
    previewComposable.destroy()
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
      :class="{ hidden: sidebarOpen }"
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

    <!-- Sidebar -->
    <div class="sidebar-overlay" :class="{ open: sidebarOpen }" @click="sidebarOpen = false">
      <aside class="sidebar" :class="{ open: sidebarOpen }" @click.stop>
        <div class="sidebar-content">
          <!-- Sidebar content will go here -->
        </div>
      </aside>
    </div>

    <!-- Editor Area -->
    <div class="editor-container" :class="{ 'sidebar-open': sidebarOpen }">
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
    </div>

    <!-- Bottom App Bar -->
    <div class="app-bar">
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
            <!-- Bottom sheet content will go here -->
          </div>
        </div>
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
  transition: opacity 0.2s ease, visibility 0.2s ease;
  opacity: 1;
  visibility: visible;
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
}

.menu-button svg {
  width: 20px;
  height: 20px;
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
  width: 280px;
  max-width: 85vw;
  background: var(--color-background);
  border-right: 1px solid var(--color-overlay-border);
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 1001;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-content {
  padding: 1rem;
  padding-top: 4.5rem; /* Account for menu button */
}

/* Editor Container */
.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: margin-left 0.3s ease;
  margin-bottom: 4rem; /* Account for app bar */
}

/* Bottom App Bar */
.app-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4rem;
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 1rem;
  z-index: 999;
  backdrop-filter: blur(8px);
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
  width: 20px;
  height: 20px;
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
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
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
</style>
