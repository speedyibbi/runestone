<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { useEditor, type PreviewMode } from '@/composables/useEditor'
import { useCodex, type RuneInfo } from '@/composables/useCodex'
import { useSessionStore } from '@/stores/session'
import { useImageUpload } from '@/composables/useImageUpload'
import KeyboardShortcuts from '@/components/editor/KeyboardShortcuts.vue'
import BubbleMenu from '@/components/editor/BubbleMenu.vue'
import CodexRibbon from '@/components/codex/CodexRibbon.vue'
import CodexLeftSidebar from '@/components/codex/CodexLeftSidebar.vue'
import CodexTopBar from '@/components/codex/CodexTopBar.vue'
import CodexEditorArea from '@/components/codex/CodexEditorArea.vue'
import CodexStatusBar from '@/components/codex/CodexStatusBar.vue'
import CodexRightSidebar, { type Heading } from '@/components/codex/CodexRightSidebar.vue'
import CodexContextMenu, { type MenuItem } from '@/components/codex/CodexContextMenu.vue'
import Modal from '@/components/base/Modal.vue'
import type { Tab } from '@/components/codex/CodexTabs.vue'

const route = useRoute()
const router = useRouter()

const editorElement = ref<HTMLElement>()
const previewElement = ref<HTMLElement>()
const editorViewRef = ref<EditorView | null>(null) as import('vue').Ref<EditorView | null>
const previewViewRef = ref<EditorView | null>(null) as import('vue').Ref<EditorView | null>

const {
  runes,
  currentRune,
  currentCodex,
  isLoadingRune,
  hasOpenRune,
  openRune,
  createRune,
  refreshRuneList,
  isDirectory,
  saveCurrentRune,
  isSavingRune,
  hasUnsavedChanges,
  error,
  createAutoSaveCallback,
  renameRune,
  deleteRune,
  duplicateRune,
  closeRune,
  getSigilUrl,
  renameCodex,
  deleteCodex,
  searchRunes,
} = useCodex(editorViewRef, { autoSave: true })

const autoSaveCallback = createAutoSaveCallback()

// Create sigil resolver function
const sigilResolver = async (sigilId: string): Promise<string> => {
  return await getSigilUrl(sigilId)
}

// Shared preview mode state across all tabs
const previewMode = ref<PreviewMode>('edit')

// Initialize preview editor for split mode (needed for the callback)
const previewComposable = useEditor(previewElement, undefined, sigilResolver, ref('preview'))
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

// Initialize editor with sigil resolver
const editorComposable = useEditor(
  editorElement,
  combinedUpdateCallback,
  sigilResolver,
  previewMode,
)
const { editorView, togglePreview, applyPreviewMode } = editorComposable

// Image upload handler
const imageUploadHandler = useImageUpload({
  editorView: editorViewRef,
  showNotifications: false, // Status shown in status bar instead
})

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
    dragDropCleanup = imageUploadHandler.setupDragAndDrop()
    pasteCleanup = imageUploadHandler.setupPasteHandler()
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
watch(editorView, (view) => {
  if (view) {
    // Wait a tick to ensure DOM is ready
    nextTick(() => {
      setupUploadHandlers()
      // Apply preview mode state when editor view becomes available
      applyPreviewMode()
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

// Apply preview mode when switching tabs (when currentRune changes)
watch(currentRune, () => {
  if (editorView.value) {
    nextTick(() => {
      applyPreviewMode()
      // Sync content to preview editor if in split mode
      // Wait a bit longer to ensure preview editor is ready after tab switch
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

// Content syncing is now handled in combinedUpdateCallback above
// This watcher is kept as a fallback for edge cases
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

const statusBarUpdateTrigger = ref(0)

let currentUpdateListener: (() => void) | null = null
let currentObserver: MutationObserver | null = null

watch(
  editorView,
  (view, oldView) => {
    if (oldView && currentUpdateListener) {
      oldView.dom.removeEventListener('input', currentUpdateListener)
      oldView.dom.removeEventListener('selectionchange', currentUpdateListener)
    }
    if (currentObserver) {
      currentObserver.disconnect()
      currentObserver = null
    }

    editorViewRef.value = view as EditorView | null

    if (view) {
      const updateListener = () => {
        statusBarUpdateTrigger.value++
      }
      currentUpdateListener = updateListener

      view.dom.addEventListener('input', updateListener)
      view.dom.addEventListener('selectionchange', updateListener)

      const observer = new MutationObserver(updateListener)
      currentObserver = observer
      observer.observe(view.dom, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }
  },
  { immediate: true },
)

// This handles the edge case where the editor initializes after openRune has already completed
watch([editorView, currentRune], ([view, rune], [oldView, oldRune]) => {
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

onUnmounted(() => {
  if (editorView.value && currentUpdateListener) {
    editorView.value.dom.removeEventListener('input', currentUpdateListener)
    editorView.value.dom.removeEventListener('selectionchange', currentUpdateListener)
  }
  if (currentObserver) {
    currentObserver.disconnect()
  }
  // Cleanup scroll sync
  cleanupScrollSync()
  // Cleanup preview editor
  if (previewView.value) {
    previewComposable.destroy()
  }
})

const currentRuneId = computed(() => currentRune.value?.uuid ?? null)

const leftSidebarCollapsed = ref(false)
const activeLeftPanel = ref<'files' | 'search' | 'graph'>('files')
const rightSidebarCollapsed = ref(true)
const showCommandPalette = ref(false)

const expandedDirectories = ref<Set<string>>(new Set())

const selectedDirectory = ref<string>('')

// Sort order: 'asc' (A-Z) or 'desc' (Z-A)
const sortOrder = ref<'asc' | 'desc'>('asc')

const tabs = ref<Tab[]>([])
const activeTabId = ref<string | null>(null)

// Tab history tracking for back/forward navigation
const tabHistory = ref<string[]>([]) // Array of tab IDs in order visited
const historyIndex = ref<number>(-1) // Current position in history (-1 means no history)
const isNavigatingHistory = ref(false) // Flag to prevent adding to history during navigation
const closedTabs = ref<Map<string, string>>(new Map()) // Map of closed tab IDs to their runeIds

const statusMessage = ref<string | null>(null)
const statusType = ref<'info' | 'success' | 'warning' | 'error' | null>(null)
let statusTimeout: ReturnType<typeof setTimeout> | null = null

function setStatusMessage(
  message: string | null,
  type: 'info' | 'success' | 'warning' | 'error' | null = null,
  duration: number = 3000,
) {
  if (statusTimeout) {
    clearTimeout(statusTimeout)
    statusTimeout = null
  }
  statusMessage.value = message
  statusType.value = type
  if (message && duration > 0) {
    statusTimeout = setTimeout(() => {
      statusMessage.value = null
      statusType.value = null
      statusTimeout = null
    }, duration)
  }
}

function getBaseName(fullTitle: string): string {
  if (!fullTitle.includes('/')) return fullTitle
  const parts = fullTitle.split('/').filter((p) => p)
  return parts[parts.length - 1] || fullTitle
}

watch(
  () => currentRune.value,
  (rune, oldRune) => {
    if (rune) {
      const existingTab = tabs.value.find((t) => t.runeId === rune.uuid)
      if (existingTab) {
        // Only add to history if we're not navigating via history buttons
        if (!isNavigatingHistory.value && activeTabId.value !== existingTab.id) {
          addToHistory(existingTab.id)
        }
        activeTabId.value = existingTab.id
        existingTab.title = getBaseName(rune.title)
        existingTab.hasUnsavedChanges = hasUnsavedChanges.value
      } else {
        const newTab: Tab = {
          id: `tab-${Date.now()}-${Math.random()}`,
          runeId: rune.uuid,
          title: getBaseName(rune.title),
          hasUnsavedChanges: hasUnsavedChanges.value,
        }
        tabs.value.push(newTab)
        if (!isNavigatingHistory.value) {
          addToHistory(newTab.id)
        }
        activeTabId.value = newTab.id
      }
      if (!oldRune || oldRune.uuid !== rune.uuid) {
        setStatusMessage(`Opened: ${getBaseName(rune.title)}`, 'info', 2000)
      }
    }
  },
  { immediate: true },
)

watch(hasUnsavedChanges, (unsaved) => {
  const activeTab = tabs.value.find((t) => t.id === activeTabId.value)
  if (activeTab) {
    activeTab.hasUnsavedChanges = unsaved
  }
})

watch(
  runes,
  () => {
    tabs.value.forEach((tab) => {
      if (tab.runeId) {
        const rune = runes.value.find((r) => r.uuid === tab.runeId)
        if (rune) {
          tab.title = getBaseName(rune.title)
        }
      }
    })
  },
  { deep: true },
)

function handleTabClick(tab: Tab) {
  if (!isNavigatingHistory.value) {
    addToHistory(tab.id)
  }
  activeTabId.value = tab.id
  if (tab.runeId) {
    openRune(tab.runeId)
  }
  // Graph tabs don't have runeId, so they don't need to open a rune
}

function addToHistory(tabId: string) {
  // Don't add if we're navigating via history buttons
  if (isNavigatingHistory.value) {
    return
  }

  // Remove any future history if we're not at the end
  if (historyIndex.value < tabHistory.value.length - 1) {
    tabHistory.value = tabHistory.value.slice(0, historyIndex.value + 1)
  }

  // Don't add if it's the same as the current tab
  if (tabHistory.value.length > 0 && tabHistory.value[tabHistory.value.length - 1] === tabId) {
    return
  }

  // Add to history
  tabHistory.value.push(tabId)
  historyIndex.value = tabHistory.value.length - 1
}

function navigateHistoryBack() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const tabId = tabHistory.value[historyIndex.value]
    const tab = tabs.value.find((t) => t.id === tabId)

    if (tab) {
      // Tab is still open, navigate to it
      isNavigatingHistory.value = true
      activeTabId.value = tab.id
      if (tab.runeId) {
        openRune(tab.runeId)
      }
      // Reset flag after navigation completes
      nextTick(() => {
        isNavigatingHistory.value = false
      })
    } else {
      // Tab is closed, check if we have its runeId and reopen it
      const runeId = closedTabs.value.get(tabId)
      if (runeId) {
        isNavigatingHistory.value = true
        // openRune will create a new tab, which will be added to tabs.value
        // The watch on currentRune will handle setting activeTabId
        openRune(runeId)
          .then(() => {
            // After the rune is opened, find the new tab and update history
            nextTick(() => {
              const newTab = tabs.value.find((t) => t.runeId === runeId)
              if (newTab) {
                // Update history to use the new tab ID
                tabHistory.value[historyIndex.value] = newTab.id
                // Remove from closed tabs since it's now open
                closedTabs.value.delete(tabId)
              }
              isNavigatingHistory.value = false
            })
          })
          .catch(() => {
            // If opening the rune fails, restore history index and reset flag
            historyIndex.value++
            isNavigatingHistory.value = false
          })
      } else {
        // Tab is closed but we don't have its runeId, can't reopen
        // Restore history index
        historyIndex.value++
      }
    }
  }
}

function navigateHistoryForward() {
  if (historyIndex.value < tabHistory.value.length - 1) {
    historyIndex.value++
    const tabId = tabHistory.value[historyIndex.value]
    const tab = tabs.value.find((t) => t.id === tabId)

    if (tab) {
      // Tab is still open, navigate to it
      isNavigatingHistory.value = true
      activeTabId.value = tab.id
      if (tab.runeId) {
        openRune(tab.runeId)
      }
      // Reset flag after navigation completes
      nextTick(() => {
        isNavigatingHistory.value = false
      })
    } else {
      // Tab is closed, check if we have its runeId and reopen it
      const runeId = closedTabs.value.get(tabId)
      if (runeId) {
        isNavigatingHistory.value = true
        // openRune will create a new tab, which will be added to tabs.value
        // The watch on currentRune will handle setting activeTabId
        openRune(runeId)
          .then(() => {
            // After the rune is opened, find the new tab and update history
            nextTick(() => {
              const newTab = tabs.value.find((t) => t.runeId === runeId)
              if (newTab) {
                // Update history to use the new tab ID
                tabHistory.value[historyIndex.value] = newTab.id
                // Remove from closed tabs since it's now open
                closedTabs.value.delete(tabId)
              }
              isNavigatingHistory.value = false
            })
          })
          .catch(() => {
            // If opening the rune fails, restore history index and reset flag
            historyIndex.value--
            isNavigatingHistory.value = false
          })
      } else {
        // Tab is closed but we don't have its runeId, can't reopen
        // Restore history index
        historyIndex.value--
      }
    }
  }
}

const canNavigateBack = computed(() => historyIndex.value > 0)
const canNavigateForward = computed(() => historyIndex.value < tabHistory.value.length - 1)

function handleTabClose(tab: Tab) {
  const index = tabs.value.findIndex((t) => t.id === tab.id)
  if (index !== -1) {
    // Store the runeId for this closed tab so we can reopen it via history
    if (tab.runeId) {
      closedTabs.value.set(tab.id, tab.runeId)
    }

    tabs.value.splice(index, 1)

    // Don't remove from history - keep it so we can navigate back to closed tabs
    // Just adjust history index if needed
    const historyTabIndex = tabHistory.value.findIndex((id) => id === tab.id)
    if (historyTabIndex !== -1) {
      // Adjust history index if we're closing a tab that's ahead of current position
      if (historyIndex.value > historyTabIndex) {
        // We're closing a tab in the past, no adjustment needed
      } else if (historyIndex.value === historyTabIndex) {
        // We're closing the current tab, move to previous if available
        if (historyIndex.value > 0) {
          historyIndex.value--
        } else if (historyIndex.value < tabHistory.value.length - 1) {
          // If we're at the start, move forward if possible
          historyIndex.value++
        }
      }
      // If historyIndex is after the closed tab, no adjustment needed
    }

    if (tab.id === activeTabId.value) {
      if (tabs.value.length > 0) {
        const nextTab = tabs.value[Math.min(index, tabs.value.length - 1)]
        activeTabId.value = nextTab.id
        if (nextTab.runeId) {
          openRune(nextTab.runeId)
        }
      } else {
        activeTabId.value = null
        // Don't clear history - keep it for navigation
        closeRune()
      }
    }
  }
}

function handleOpenGraph() {
  // Check if graph tab already exists
  const existingGraphTab = tabs.value.find((t) => !t.runeId && t.title === 'Graph View')
  if (existingGraphTab) {
    activeTabId.value = existingGraphTab.id
    if (!isNavigatingHistory.value) {
      addToHistory(existingGraphTab.id)
    }
    return
  }

  // Create new graph tab
  const newTab: Tab = {
    id: `graph-tab-${Date.now()}-${Math.random()}`,
    title: 'Graph View',
    hasUnsavedChanges: false,
  }
  tabs.value.push(newTab)
  if (!isNavigatingHistory.value) {
    addToHistory(newTab.id)
  }
  activeTabId.value = newTab.id
  setStatusMessage('Opened: Graph View', 'info', 2000)
}

function handleRuneClick(rune: RuneInfo, event?: MouseEvent) {
  if (isDirectory(rune.title)) {
    if (expandedDirectories.value.has(rune.title)) {
      expandedDirectories.value.delete(rune.title)
    } else {
      expandedDirectories.value.add(rune.title)
    }
    expandedDirectories.value = new Set(expandedDirectories.value)
  } else {
    openRune(rune.uuid)
    selectedDirectory.value = ''
  }
}

// Alternative way to select directory
function handleRuneDoubleClick(rune: RuneInfo) {
  if (isDirectory(rune.title)) {
    selectedDirectory.value = selectedDirectory.value === rune.title ? '' : rune.title
  }
}

export interface TreeNode {
  rune: RuneInfo
  children: TreeNode[]
  level: number
  parentPath: string
}

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

type EditingState =
  | { type: 'creating-rune'; parentPath: string }
  | { type: 'creating-directory'; parentPath: string }
  | { type: 'renaming'; runeId: string }
  | null

const editingState = ref<EditingState>(null)
const selectedRuneForAction = ref<RuneInfo | null>(null)
const isRenamingCodex = ref(false)

const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuItems = ref<MenuItem[]>([])

const showConfirmDialog = ref(false)
const confirmDialogTitle = ref('')
const confirmDialogMessage = ref('')
const confirmDialogAction = ref<(() => void) | null>(null)

function handleCreateRune() {
  const targetDir = createInDirectory.value || selectedDirectory.value
  editingState.value = { type: 'creating-rune', parentPath: targetDir }
  if (targetDir) {
    expandAllParentDirectories(targetDir)
    expandedDirectories.value.add(targetDir)
    expandedDirectories.value = new Set(expandedDirectories.value)
  }
}

function handleCreateDirectory() {
  const targetDir = createInDirectory.value || selectedDirectory.value
  editingState.value = { type: 'creating-directory', parentPath: targetDir }
  if (targetDir) {
    expandAllParentDirectories(targetDir)
    expandedDirectories.value.add(targetDir)
    expandedDirectories.value = new Set(expandedDirectories.value)
  }
}

const createInDirectory = ref<string>('')

async function handleCreateRuneSubmit(title: string) {
  try {
    if (!editingState.value || editingState.value.type !== 'creating-rune') return

    const targetDir = editingState.value.parentPath
    const fullTitle = targetDir ? `${targetDir}${title}` : title
    editingState.value = null
    createInDirectory.value = ''

    const runeId = await createRune(fullTitle)
    expandAllParentDirectories(fullTitle)
    await openRune(runeId)
    setStatusMessage(`Created note: ${title}`, 'success')
  } catch (err) {
    console.error('Error creating rune:', err)
    setStatusMessage(err instanceof Error ? err.message : 'Error creating note', 'error', 5000)
    editingState.value = null
    createInDirectory.value = ''
  }
}

function handleCreateRuneCancel() {
  editingState.value = null
  createInDirectory.value = ''
}

async function handleCreateDirectorySubmit(title: string) {
  try {
    if (!editingState.value || editingState.value.type !== 'creating-directory') return

    const directoryTitle = title.endsWith('/') ? title : `${title}/`
    const targetDir = editingState.value.parentPath
    const fullTitle = targetDir ? `${targetDir}${directoryTitle}` : directoryTitle
    editingState.value = null
    createInDirectory.value = ''

    await createRune(fullTitle, '')
    expandAllParentDirectories(fullTitle)
    setStatusMessage(`Created directory: ${title}`, 'success')
  } catch (err) {
    console.error('Error creating directory:', err)
    setStatusMessage(err instanceof Error ? err.message : 'Error creating directory', 'error', 5000)
    editingState.value = null
    createInDirectory.value = ''
  }
}

function handleCreateDirectoryCancel() {
  editingState.value = null
  createInDirectory.value = ''
}

function handleRuneContextMenu(event: MouseEvent, rune: RuneInfo) {
  selectedRuneForAction.value = rune
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY

  const isDir = isDirectory(rune.title)

  const items: MenuItem[] = []

  if (isDir) {
    items.push(
      {
        label: selectedDirectory.value === rune.title ? 'Deselect Directory' : 'Select Directory',
        action: () => {
          selectedDirectory.value = selectedDirectory.value === rune.title ? '' : rune.title
        },
      },
      {
        label: 'New Rune',
        action: () => {
          createInDirectory.value = rune.title
          handleCreateRune()
        },
      },
      {
        label: 'New Directory',
        action: () => {
          createInDirectory.value = rune.title
          handleCreateDirectory()
        },
      },
    )
  }

  items.push(
    {
      label: 'Rename',
      action: () => {
        if (selectedRuneForAction.value) {
          editingState.value = { type: 'renaming', runeId: selectedRuneForAction.value.uuid }
        }
      },
    },
    {
      label: 'Duplicate',
      action: async () => {
        if (selectedRuneForAction.value && !isDirectory(selectedRuneForAction.value.title)) {
          try {
            const duplicatedRuneId = await duplicateRune(selectedRuneForAction.value.uuid)
            const rune = runes.value.find((r) => r.uuid === duplicatedRuneId)
            if (rune) {
              setStatusMessage(`Duplicated: ${rune.title}`, 'success')
            }
          } catch (err) {
            console.error('Error duplicating rune:', err)
            setStatusMessage(
              err instanceof Error ? err.message : 'Error duplicating',
              'error',
              5000,
            )
          }
        }
      },
      disabled: isDir,
    },
    {
      label: 'Delete',
      action: async () => {
        if (selectedRuneForAction.value) {
          try {
            const runeToDelete = selectedRuneForAction.value

            const runesToDelete: RuneInfo[] = []
            if (isDirectory(runeToDelete.title)) {
              runesToDelete.push(
                ...runes.value.filter(
                  (r) => r.title.startsWith(runeToDelete.title) && r.uuid !== runeToDelete.uuid,
                ),
              )
            }
            runesToDelete.push(runeToDelete)

            const tabsToClose = tabs.value.filter(
              (tab) => tab.runeId && runesToDelete.some((r) => r.uuid === tab.runeId),
            )

            tabsToClose.forEach((tab) => {
              const index = tabs.value.findIndex((t) => t.id === tab.id)
              if (index !== -1) {
                tabs.value.splice(index, 1)
              }
            })

            if (tabsToClose.some((t) => t.id === activeTabId.value)) {
              if (tabs.value.length > 0) {
                const nextTab = tabs.value[0]
                activeTabId.value = nextTab.id
                if (nextTab.runeId) {
                  openRune(nextTab.runeId)
                }
              } else {
                activeTabId.value = null
                closeRune()
              }
            }

            if (selectedDirectory.value && runeToDelete.title.startsWith(selectedDirectory.value)) {
              selectedDirectory.value = ''
            }

            await deleteRune(runeToDelete.uuid)
            const itemType = isDirectory(runeToDelete.title) ? 'directory' : 'note'
            setStatusMessage(`Deleted ${itemType}`, 'success')
          } catch (err) {
            console.error('Error deleting rune:', err)
            setStatusMessage(err instanceof Error ? err.message : 'Error deleting', 'error', 5000)
          }
        }
      },
      destructive: true,
    },
  )

  contextMenuItems.value = items
  showContextMenu.value = true
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
    const itemType = isDirectory(rune.title) ? 'directory' : 'note'
    setStatusMessage(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} renamed`, 'success')
    editingState.value = null
    selectedRuneForAction.value = null
  } catch (err) {
    console.error('Error renaming rune:', err)
    setStatusMessage(err instanceof Error ? err.message : 'Error renaming', 'error', 5000)
    editingState.value = null
  }
}

function handleRenameRuneCancel() {
  editingState.value = null
}

function handleEditSubmit(value: string) {
  if (!editingState.value) return

  if (editingState.value.type === 'creating-rune') {
    handleCreateRuneSubmit(value)
  } else if (editingState.value.type === 'creating-directory') {
    handleCreateDirectorySubmit(value)
  } else if (editingState.value.type === 'renaming') {
    handleRenameRuneSubmit(value)
  }
}

function handleEditCancel() {
  if (!editingState.value) return

  if (editingState.value.type === 'creating-rune') {
    handleCreateRuneCancel()
  } else if (editingState.value.type === 'creating-directory') {
    handleCreateDirectoryCancel()
  } else if (editingState.value.type === 'renaming') {
    handleRenameRuneCancel()
  }
}

function handleSort() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function handleCollapseAll() {
  expandedDirectories.value.clear()
  expandedDirectories.value = new Set()
}

function handleCodexTitleContextMenu(event: MouseEvent) {
  if (!currentCodex.value) return

  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY

  const items: MenuItem[] = [
    {
      label: 'Rename',
      action: () => {
        isRenamingCodex.value = true
      },
    },
    {
      label: 'Delete',
      action: () => {
        if (currentCodex.value) {
          confirmDialogTitle.value = 'Delete Codex'
          confirmDialogMessage.value = `Are you sure you want to delete "${currentCodex.value.title}"? This action cannot be undone.`
          confirmDialogAction.value = async () => {
            try {
              await deleteCodex()
              // Navigate back to codex selection after deletion
              router.push('/select-codex')
              setStatusMessage('Codex deleted', 'success')
            } catch (err) {
              console.error('Error deleting codex:', err)
              setStatusMessage(
                err instanceof Error ? err.message : 'Error deleting codex',
                'error',
                5000,
              )
            }
          }
          showConfirmDialog.value = true
        }
      },
      destructive: true,
    },
  ]

  contextMenuItems.value = items
  showContextMenu.value = true
}

async function handleCodexTitleEditSubmit(newTitle: string) {
  if (!currentCodex.value || newTitle.trim() === currentCodex.value.title) {
    isRenamingCodex.value = false
    return
  }

  try {
    await renameCodex(newTitle.trim())
    setStatusMessage('Codex renamed', 'success')
    isRenamingCodex.value = false
  } catch (err) {
    console.error('Error renaming codex:', err)
    setStatusMessage(err instanceof Error ? err.message : 'Error renaming codex', 'error', 5000)
    isRenamingCodex.value = false
  }
}

function handleCodexTitleEditCancel() {
  isRenamingCodex.value = false
}

const headings = computed<Heading[]>(() => {
  statusBarUpdateTrigger.value

  if (!editorView.value || !hasOpenRune.value) {
    return []
  }

  const headingsList: Heading[] = []
  const tree = syntaxTree(editorView.value.state)
  const doc = editorView.value.state.doc

  tree.iterate({
    enter: (node) => {
      if (node.type.name.startsWith('ATXHeading')) {
        const level = parseInt(node.type.name.replace('ATXHeading', ''))
        const headingText = doc
          .sliceString(node.from, node.to)
          .replace(/^#+\s+/, '')
          .trim()
        const line = doc.lineAt(node.from).number

        if (headingText) {
          headingsList.push({
            level,
            text: headingText,
            position: node.from,
            line,
          })
        }
      }
    },
  })

  return headingsList
})

function handleHeadingClick(heading: Heading) {
  if (!editorView.value) return

  const view = editorView.value
  const pos = heading.position

  view.dispatch({
    selection: { anchor: pos },
    effects: [EditorView.scrollIntoView(pos, { y: 'start', yMargin: 100 })],
  })

  view.focus()
}

const statusBarInfo = computed(() => {
  statusBarUpdateTrigger.value

  if (!editorView.value || !hasOpenRune.value) {
    return {
      lines: 0,
      characters: 0,
      words: 0,
      cursorLine: 0,
      cursorColumn: 0,
    }
  }

  const doc = editorView.value.state.doc
  const content = doc.toString()
  const lines = doc.lines
  const characters = content.length
  const words = content.trim() ? content.trim().split(/\s+/).length : 0

  const selection = editorView.value.state.selection.main
  const cursorPos = selection.head
  const cursorLine = doc.lineAt(cursorPos).number
  const lineStart = doc.lineAt(cursorPos).from
  const cursorColumn = cursorPos - lineStart + 1

  return {
    lines,
    characters,
    words,
    cursorLine,
    cursorColumn,
  }
})

watch(
  () => route.params.runeId,
  (newRuneId) => {
    if (newRuneId && typeof newRuneId === 'string') {
      openRune(newRuneId)
    }
  },
)

const lastSaveTime = ref<Date | null>(null)

async function handleManualSave() {
  if (!hasOpenRune.value) {
    console.warn('Cannot save: No rune is open')
    return
  }

  if (!editorView.value) {
    console.warn('Cannot save: Editor view is not available')
    return
  }

  if (!currentRune.value) {
    console.warn('Cannot save: Current rune is null')
    return
  }

  // Force mark as dirty to ensure save happens (manual save should always save)
  currentRune.value.isDirty = true

  try {
    await saveCurrentRune(false)
    lastSaveTime.value = new Date()
    setStatusMessage('Note saved', 'success')
  } catch (err) {
    console.error('Error saving rune:', err)
    setStatusMessage(err instanceof Error ? err.message : 'Error saving', 'error', 5000)
  }
}

function handleKeydown(event: KeyboardEvent) {
  // Command palette shortcut (Ctrl+P / Cmd+P)
  if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
    // ALWAYS prevent default FIRST to stop browser default
    event.preventDefault()
    event.stopPropagation()

    const target = event.target as HTMLElement
    // Only skip opening command palette if user is typing in a regular input/textarea
    // (Allow it for contentEditable editor elements)
    const isRegularInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('input') ||
      target.closest('textarea')

    // Don't open command palette if user is typing in a regular input/textarea
    if (isRegularInputField) {
      return
    }

    showCommandPalette.value = !showCommandPalette.value
    return
  }

  // Save shortcut (Ctrl+S / Cmd+S)
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    const target = event.target as HTMLElement
    const isInputField =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('input') ||
      target.closest('textarea')

    if (isInputField) {
      return
    }

    // ALWAYS prevent default FIRST to stop browser save dialog
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    if (hasOpenRune.value) {
      handleManualSave()
    }
  }
}

function handleEditorSave(event: Event) {
  event.preventDefault()
  event.stopPropagation()

  if (hasOpenRune.value) {
    handleManualSave()
  }
}

watch(isSavingRune, (isSaving) => {
  if (!isSaving && hasOpenRune.value && !hasUnsavedChanges.value && !error.value) {
    lastSaveTime.value = new Date()
    setStatusMessage('Saved', 'success', 2000)
  }
})

watch(error, (err) => {
  if (err) {
    setStatusMessage(err.message, 'error', 5000)
  }
})

watch(
  editorElement,
  (element, oldElement) => {
    if (oldElement) {
      oldElement.removeEventListener('editor-save', handleEditorSave)
    }
    if (element) {
      element.addEventListener('editor-save', handleEditorSave)
    }
  },
  { immediate: true },
)

function handleExit() {
  const sessionStore = useSessionStore()
  sessionStore.teardown()
  router.push('/auth')
}

onMounted(() => {
  refreshRuneList()

  const runeId = route.params.runeId as string | undefined
  if (runeId) {
    openRune(runeId)
  }

  window.addEventListener('keydown', handleKeydown, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, { capture: true })

  if (editorElement.value) {
    editorElement.value.removeEventListener('editor-save', handleEditorSave)
  }

  if (editorView.value && currentUpdateListener) {
    editorView.value.dom.removeEventListener('input', currentUpdateListener)
    editorView.value.dom.removeEventListener('selectionchange', currentUpdateListener)
  }
  if (currentObserver) {
    currentObserver.disconnect()
  }

  // Cleanup upload handlers
  if (dragDropCleanup) {
    dragDropCleanup()
  }
  if (pasteCleanup) {
    pasteCleanup()
  }

  editorComposable.destroy()
})
</script>

<template>
  <main class="codex-layout">
    <!-- Left Ribbon (Icon Bar) -->
    <CodexRibbon
      :collapsed="leftSidebarCollapsed"
      :active-panel="activeLeftPanel"
      @update:collapsed="leftSidebarCollapsed = $event"
      @update:active-panel="activeLeftPanel = $event"
      @settings="console.log('Settings clicked')"
      @exit="handleExit"
    />

    <!-- Left Sidebar -->
    <CodexLeftSidebar
      :collapsed="leftSidebarCollapsed"
      :active-panel="activeLeftPanel"
      :codex-title="currentCodex?.title || null"
      :rune-tree="runeTree"
      :current-rune-id="currentRuneId"
      :expanded-directories="expandedDirectories"
      :selected-directory="selectedDirectory"
      :is-directory="isDirectory"
      :editing-state="editingState"
      :search-runes="searchRunes"
      @update:collapsed="leftSidebarCollapsed = $event"
      @rune-click="handleRuneClick"
      @rune-double-click="handleRuneDoubleClick"
      @rune-context-menu="handleRuneContextMenu"
      @create-rune="handleCreateRune"
      @create-directory="handleCreateDirectory"
      @clear-selection="selectedDirectory = ''"
      @collapse-all="handleCollapseAll"
      @sort="handleSort"
      @edit-submit="handleEditSubmit"
      @edit-cancel="handleEditCancel"
      @codex-title-context-menu="handleCodexTitleContextMenu"
      :is-renaming-codex="isRenamingCodex"
      @codex-title-edit-submit="handleCodexTitleEditSubmit"
      @codex-title-edit-cancel="handleCodexTitleEditCancel"
      @open-graph="handleOpenGraph"
    />

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Top Bar -->
      <CodexTopBar
        v-model="showCommandPalette"
        :tabs="tabs"
        :active-tab-id="activeTabId"
        :preview-mode="previewMode"
        :right-sidebar-collapsed="rightSidebarCollapsed"
        :codex-title="currentCodex?.title || null"
        :can-navigate-back="canNavigateBack"
        :can-navigate-forward="canNavigateForward"
        :runes="runes"
        :is-directory="isDirectory"
        :search-runes="searchRunes"
        @tab-click="handleTabClick"
        @tab-close="handleTabClose"
        @update:tabs="tabs = $event"
        @toggle-preview="togglePreview"
        @toggle-right-sidebar="rightSidebarCollapsed = !rightSidebarCollapsed"
        @open-rune="openRune"
        @navigate-back="navigateHistoryBack"
        @navigate-forward="navigateHistoryForward"
      />

      <!-- Editor Area -->
      <CodexEditorArea
        :has-open-rune="hasOpenRune"
        :is-loading-rune="isLoadingRune"
        :current-rune-id="currentRune?.uuid ?? null"
        :preview-mode="previewMode"
        :is-graph-tab="activeTabId !== null && tabs.find((t) => t.id === activeTabId)?.runeId === undefined"
        @update:editor-element="editorElement = $event"
        @update:preview-element="previewElement = $event"
      />

      <!-- Status Bar -->
      <CodexStatusBar
        :current-rune-title="currentRune?.title || null"
        :has-open-rune="hasOpenRune"
        :lines="statusBarInfo.lines"
        :words="statusBarInfo.words"
        :cursor-line="statusBarInfo.cursorLine"
        :cursor-column="statusBarInfo.cursorColumn"
        :status-message="statusMessage"
        :status-type="statusType"
        :is-saving="isSavingRune"
        :has-error="!!error"
        :has-unsaved-changes="hasUnsavedChanges"
        :is-graph-tab="activeTabId !== null && tabs.find((t) => t.id === activeTabId)?.runeId === undefined"
      />
    </div>

    <!-- Right Sidebar (Outline) -->
    <CodexRightSidebar
      :collapsed="rightSidebarCollapsed"
      :headings="headings"
      @update:collapsed="rightSidebarCollapsed = $event"
      @heading-click="handleHeadingClick"
    />

    <KeyboardShortcuts />
    <BubbleMenu :editor-view="editorView" />

    <!-- Context Menu -->
    <CodexContextMenu
      v-model:show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :items="contextMenuItems"
    />

    <!-- Confirmation Dialog -->
    <Modal
      v-model:show="showConfirmDialog"
      :title="confirmDialogTitle"
      :message="confirmDialogMessage"
      confirm-text="Delete"
      cancel-text="Cancel"
      :destructive="true"
      @confirm="confirmDialogAction?.()"
    />
  </main>
</template>

<style scoped>
.codex-layout {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: transparent;
  font-family: var(--font-primary);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: transparent;
}

/* Drag and drop styles for image upload */
:deep(.cm-editor.drag-over) {
  outline: 2px dashed var(--color-accent);
  outline-offset: -2px;
  background: var(--color-overlay-light);
}
</style>
