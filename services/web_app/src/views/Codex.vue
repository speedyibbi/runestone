<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { useEditor } from '@/composables/useEditor'
import { useCodex, type RuneInfo } from '@/composables/useCodex'
import KeyboardShortcuts from '@/components/editor/KeyboardShortcuts.vue'
import BubbleMenu from '@/components/editor/BubbleMenu.vue'
import FadeTransition from '@/components/base/FadeTransition.vue'

const route = useRoute()

// Editor setup
const editorElement = ref<HTMLElement>()
const editorViewRef = ref<EditorView | null>(null) as import('vue').Ref<EditorView | null>

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
} = useCodex(editorViewRef, { autoSave: true })

// Get auto-save callback and create editor with it
const autoSaveCallback = createAutoSaveCallback()
const { editorView, isPreviewMode, togglePreview } = useEditor(editorElement, autoSaveCallback)

// Force reactivity for status bar updates
const statusBarUpdateTrigger = ref(0)

// Update editorViewRef when editorView becomes available
watch(
  editorView,
  (view) => {
    editorViewRef.value = view as EditorView | null

    // Set up update listener for status bar reactivity
    if (view) {
      const updateListener = () => {
        statusBarUpdateTrigger.value++
      }

      // Listen to DOM events for changes
      view.dom.addEventListener('input', updateListener)
      view.dom.addEventListener('selectionchange', updateListener)

      // Use MutationObserver to watch for editor changes
      const observer = new MutationObserver(updateListener)
      observer.observe(view.dom, {
        childList: true,
        subtree: true,
        characterData: true,
      })

      onUnmounted(() => {
        view.dom.removeEventListener('input', updateListener)
        view.dom.removeEventListener('selectionchange', updateListener)
        observer.disconnect()
      })
    }
  },
  { immediate: true },
)

// Computed
const currentRuneId = computed(() => currentRune.value?.uuid ?? null)

// Sidebar state
const leftSidebarCollapsed = ref(false)
const activeLeftPanel = ref<'files' | 'search' | 'graph'>('files')
const rightSidebarCollapsed = ref(true)

// Tab management
interface Tab {
  id: string
  runeId?: string
  title: string
  hasUnsavedChanges: boolean
}
const tabs = ref<Tab[]>([])
const activeTabId = ref<string | null>(null)
const draggedTabId = ref<string | null>(null)
const draggedOverTabId = ref<string | null>(null)
const isDragging = ref(false)

// Update tabs when rune changes
watch(
  () => currentRune.value,
  (rune) => {
    if (rune) {
      const existingTab = tabs.value.find((t) => t.runeId === rune.uuid)
      if (existingTab) {
        activeTabId.value = existingTab.id
        existingTab.title = rune.title
        existingTab.hasUnsavedChanges = hasUnsavedChanges.value
      } else {
        const newTab: Tab = {
          id: `tab-${Date.now()}-${Math.random()}`,
          runeId: rune.uuid,
          title: rune.title,
          hasUnsavedChanges: hasUnsavedChanges.value,
        }
        tabs.value.push(newTab)
        activeTabId.value = newTab.id
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

// Tab drag handlers
function handleTabDragStart(event: DragEvent, tabId: string) {
  isDragging.value = true
  draggedTabId.value = tabId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
  }
}

function handleTabDragOver(event: DragEvent, tabId: string) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  if (draggedTabId.value && draggedTabId.value !== tabId) {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    // Determine if we should insert before or after based on mouse position
    if (event.clientX < midpoint) {
      draggedOverTabId.value = tabId
    } else {
      // Find next tab
      const currentIndex = tabs.value.findIndex((t) => t.id === tabId)
      const nextTab = tabs.value[currentIndex + 1]
      draggedOverTabId.value = nextTab?.id || tabId
    }
  }
}

function handleTabDragLeave(event: DragEvent) {
  // Don't clear immediately - let dragover handle it
  // This prevents flickering when moving between tabs
}

function handleTabDrop(event: DragEvent, targetTabId: string) {
  event.preventDefault()
  if (!draggedTabId.value || draggedTabId.value === targetTabId) {
    draggedTabId.value = null
    draggedOverTabId.value = null
    isDragging.value = false
    return
  }

  const draggedIndex = tabs.value.findIndex((t) => t.id === draggedTabId.value)
  const targetIndex = tabs.value.findIndex((t) => t.id === targetTabId)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    // Use the drag-over tab or determine position based on mouse
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const midpoint = rect.left + rect.width / 2
    const insertIndex = event.clientX < midpoint ? targetIndex : targetIndex + 1

    const [draggedTab] = tabs.value.splice(draggedIndex, 1)
    const finalIndex = draggedIndex < insertIndex ? insertIndex - 1 : insertIndex
    tabs.value.splice(finalIndex, 0, draggedTab)
  }

  draggedTabId.value = null
  draggedOverTabId.value = null
  // Reset dragging flag after a short delay to prevent click from firing
  setTimeout(() => {
    isDragging.value = false
  }, 100)
}

function handleTabDragEnd() {
  draggedTabId.value = null
  draggedOverTabId.value = null
  setTimeout(() => {
    isDragging.value = false
  }, 100)
}

function handleTabClick(tab: Tab) {
  if (isDragging.value) return
  activeTabId.value = tab.id
  if (tab.runeId) {
    openRune(tab.runeId)
  }
}

function handleTabClose(event: MouseEvent, tab: Tab) {
  event.stopPropagation()
  const index = tabs.value.findIndex((t) => t.id === tab.id)
  if (index !== -1) {
    tabs.value.splice(index, 1)
    if (tab.id === activeTabId.value) {
      if (tabs.value.length > 0) {
        const nextTab = tabs.value[Math.min(index, tabs.value.length - 1)]
        activeTabId.value = nextTab.id
        if (nextTab.runeId) {
          openRune(nextTab.runeId)
        }
      } else {
        activeTabId.value = null
        closeRune()
      }
    }
  }
}

// Handle rune item click
function handleRuneClick(rune: RuneInfo) {
  if (!isDirectory(rune.title)) {
    openRune(rune.uuid)
  }
}

// Heading extraction for right sidebar
interface Heading {
  level: number
  text: string
  position: number
  line: number
}

const headings = computed<Heading[]>(() => {
  // Trigger reactivity on editor updates
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

// Handle heading click to scroll to position
function handleHeadingClick(heading: Heading) {
  if (!editorView.value) return

  const view = editorView.value
  const pos = heading.position

  // Scroll to the heading
  view.dispatch({
    selection: { anchor: pos },
    effects: [EditorView.scrollIntoView(pos, { y: 'start', yMargin: 100 })],
  })

  // Focus the editor
  view.focus()
}

// Status bar helpers
const statusBarInfo = computed(() => {
  // Trigger reactivity
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

// Watch route changes for runeId
watch(
  () => route.params.runeId,
  (newRuneId) => {
    if (newRuneId && typeof newRuneId === 'string') {
      openRune(newRuneId)
    }
  },
)

// Save functionality
const lastSaveTime = ref<Date | null>(null)
const showSaveStatus = ref(false)

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

  // Get content directly from editor to verify it's available
  const content = editorView.value.state.doc.toString()
  // Force mark as dirty to ensure save happens (manual save should always save)
  // This ensures the save will proceed even if auto-save thinks it's clean
  currentRune.value.isDirty = true

  try {
    await saveCurrentRune(false) // false = show notification
    lastSaveTime.value = new Date()
    showSaveStatus.value = true
    // Hide status after 3 seconds
    setTimeout(() => {
      showSaveStatus.value = false
    }, 3000)
  } catch (err) {
    console.error('Error saving rune:', err)
    showSaveStatus.value = true
    // Keep error visible longer
    setTimeout(() => {
      if (!hasUnsavedChanges.value && !isSavingRune.value) {
        showSaveStatus.value = false
      }
    }, 5000)
  }
}

// Keyboard shortcut handler for Cmd/Ctrl+S (fallback for non-editor areas)
function handleKeydown(event: KeyboardEvent) {
  // Cmd/Ctrl+S for manual save
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    // Don't intercept if user is typing in an input/textarea
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
    // This must happen before any other logic
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    // Only save if we have a rune open
    if (hasOpenRune.value) {
      handleManualSave()
    }
  }
}

// Handle save event from CodeMirror editor
function handleEditorSave(event: Event) {
  event.preventDefault()
  event.stopPropagation()

  if (hasOpenRune.value) {
    handleManualSave()
  }
}

// Watch for auto-save completion to show status briefly
watch(isSavingRune, (isSaving) => {
  if (!isSaving && hasOpenRune.value && !hasUnsavedChanges.value && !error.value) {
    // Auto-save just completed successfully
    lastSaveTime.value = new Date()
    showSaveStatus.value = true
    setTimeout(() => {
      showSaveStatus.value = false
    }, 2000) // Shorter for auto-save
  }
})

// Computed property for save status text
const saveStatusText = computed(() => {
  // Always show when saving
  if (isSavingRune.value) {
    return 'Saving...'
  }

  // Always show errors
  if (error.value) {
    return 'Error saving'
  }

  // Always show unsaved changes
  if (hasUnsavedChanges.value) {
    return 'Unsaved changes'
  }

  // Only show "saved" status briefly after manual save or if explicitly shown
  if (showSaveStatus.value && lastSaveTime.value) {
    const now = new Date()
    const diffMs = now.getTime() - lastSaveTime.value.getTime()
    const diffSecs = Math.floor(diffMs / 1000)

    if (diffSecs < 1) {
      return 'Saved just now'
    } else if (diffSecs < 60) {
      return 'Saved just now'
    } else {
      return 'Saved'
    }
  }

  // Don't show status when everything is saved and no recent activity
  return ''
})

// Watch for editor element to set up save listener
watch(
  editorElement,
  (element) => {
    if (element) {
      // Listen for save events from CodeMirror editor
      // This handles Cmd/Ctrl+S when the editor is focused
      element.addEventListener('editor-save', handleEditorSave)
    }
  },
  { immediate: true },
)

onMounted(() => {
  refreshRuneList()

  const runeId = route.params.runeId as string | undefined
  if (runeId) {
    openRune(runeId)
  }

  // Add keyboard event listener with capture phase to catch it early
  // This ensures we prevent default before the browser handles it
  window.addEventListener('keydown', handleKeydown, { capture: true })
})

onUnmounted(() => {
  // Remove keyboard event listener
  window.removeEventListener('keydown', handleKeydown, { capture: true })

  // Remove editor save event listener
  if (editorElement.value) {
    editorElement.value.removeEventListener('editor-save', handleEditorSave)
  }
})
</script>

<template>
  <main class="codex-layout">
    <!-- Left Ribbon (Icon Bar) -->
    <aside class="left-ribbon">
      <div class="ribbon-content">
        <div class="ribbon-icon-wrapper" :class="{ 'has-button': leftSidebarCollapsed }">
          <FadeTransition>
            <button
              v-if="leftSidebarCollapsed"
              key="expand-sidebar"
              class="ribbon-icon"
              @click="leftSidebarCollapsed = false"
              title="Open Sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </FadeTransition>
        </div>
        <button
          class="ribbon-icon"
          :class="{ active: !leftSidebarCollapsed && activeLeftPanel === 'files' }"
          @click="activeLeftPanel = 'files'; leftSidebarCollapsed = false"
          title="Explorer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          class="ribbon-icon"
          :class="{ active: !leftSidebarCollapsed && activeLeftPanel === 'search' }"
          @click="activeLeftPanel = 'search'; leftSidebarCollapsed = false"
          title="Search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        <button
          class="ribbon-icon"
          :class="{ active: !leftSidebarCollapsed && activeLeftPanel === 'graph' }"
          @click="activeLeftPanel = 'graph'; leftSidebarCollapsed = false"
          title="Graph View"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 32 32"
            fill="currentColor"
          >
            <path
              d="M27 21.75c-0.795 0.004-1.538 0.229-2.169 0.616l0.018-0.010-2.694-2.449c0.724-1.105 1.154-2.459 1.154-3.913 0-1.572-0.503-3.027-1.358-4.212l0.015 0.021 3.062-3.062c0.57 0.316 1.249 0.503 1.971 0.508h0.002c2.347 0 4.25-1.903 4.25-4.25s-1.903-4.25-4.25-4.25c-2.347 0-4.25 1.903-4.25 4.25v0c0.005 0.724 0.193 1.403 0.519 1.995l-0.011-0.022-3.062 3.062c-1.147-0.84-2.587-1.344-4.144-1.344-0.868 0-1.699 0.157-2.467 0.443l0.049-0.016-0.644-1.17c0.726-0.757 1.173-1.787 1.173-2.921 0-2.332-1.891-4.223-4.223-4.223s-4.223 1.891-4.223 4.223c0 2.332 1.891 4.223 4.223 4.223 0.306 0 0.605-0.033 0.893-0.095l-0.028 0.005 0.642 1.166c-1.685 1.315-2.758 3.345-2.758 5.627 0 0.605 0.076 1.193 0.218 1.754l-0.011-0.049-0.667 0.283c-0.78-0.904-1.927-1.474-3.207-1.474-2.334 0-4.226 1.892-4.226 4.226s1.892 4.226 4.226 4.226c2.334 0 4.226-1.892 4.226-4.226 0-0.008-0-0.017-0-0.025v0.001c-0.008-0.159-0.023-0.307-0.046-0.451l0.003 0.024 0.667-0.283c1.303 2.026 3.547 3.349 6.1 3.349 1.703 0 3.268-0.589 4.503-1.574l-0.015 0.011 2.702 2.455c-0.258 0.526-0.41 1.144-0.414 1.797v0.001c0 2.347 1.903 4.25 4.25 4.25s4.25-1.903 4.25-4.25c0-2.347-1.903-4.25-4.25-4.25v0zM8.19 5c0-0.966 0.784-1.75 1.75-1.75s1.75 0.784 1.75 1.75c0 0.966-0.784 1.75-1.75 1.75v0c-0.966-0.001-1.749-0.784-1.75-1.75v-0zM5 22.42c-0.966-0.001-1.748-0.783-1.748-1.749s0.783-1.749 1.749-1.749c0.966 0 1.748 0.782 1.749 1.748v0c-0.001 0.966-0.784 1.749-1.75 1.75h-0zM27 3.25c0.966 0 1.75 0.784 1.75 1.75s-0.784 1.75-1.75 1.75c-0.966 0-1.75-0.784-1.75-1.75v0c0.001-0.966 0.784-1.749 1.75-1.75h0zM11.19 16c0-0.001 0-0.002 0-0.003 0-2.655 2.152-4.807 4.807-4.807 1.328 0 2.53 0.539 3.4 1.409l0.001 0.001 0.001 0.001c0.87 0.87 1.407 2.072 1.407 3.399 0 2.656-2.153 4.808-4.808 4.808s-4.808-2.153-4.808-4.808c0-0 0-0 0-0v0zM27 27.75c-0.966 0-1.75-0.784-1.75-1.75s0.784-1.75 1.75-1.75c0.966 0 1.75 0.784 1.75 1.75v0c-0.001 0.966-0.784 1.749-1.75 1.75h-0z"
            />
          </svg>
        </button>
        <div class="ribbon-spacer"></div>
        <div class="ribbon-divider"></div>
        <button class="ribbon-icon" title="Settings">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        <button class="ribbon-icon" title="Exit">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
    </aside>

    <!-- Left Sidebar -->
    <aside class="left-sidebar" :class="{ collapsed: leftSidebarCollapsed }">
      <div class="sidebar-header">
        <div class="sidebar-title">
          <h2>{{ currentCodex?.title || 'Codex' }}</h2>
        </div>
        <button class="sidebar-toggle" @click="leftSidebarCollapsed = !leftSidebarCollapsed">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
      <FadeTransition>
        <div v-if="!leftSidebarCollapsed" class="sidebar-content">
          <!-- Runes Panel -->
          <div v-if="activeLeftPanel === 'files'" class="sidebar-section">
            <!-- Rune Actions (above Runes title) -->
            <div class="rune-actions">
              <button class="icon-button" title="New Rune">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M12 18v-6M9 15h6" />
                </svg>
              </button>
              <button class="icon-button" title="New Directory">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                  />
                  <path d="M12 11v6M9 14h6" />
                </svg>
              </button>
              <button class="icon-button" title="Sort">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 6h18M7 12h10M9 18h6" />
                </svg>
              </button>
              <button class="icon-button" title="Collapse">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m18 9-6-6-6 6" />
                  <path d="m6 15 6 6 6-6" />
                </svg>
              </button>
            </div>
            <div class="section-header">
              <span class="section-title">Runes</span>
            </div>
            <div class="rune-list">
              <div
                v-for="rune in runes"
                :key="rune.uuid"
                class="rune-item"
                :class="{
                  active: currentRune?.uuid === rune.uuid,
                  directory: isDirectory(rune.title),
                }"
                @click="handleRuneClick(rune)"
              >
                <span class="rune-icon">
                  <svg
                    v-if="isDirectory(rune.title)"
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
                    <path
                      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                    />
                  </svg>
                  <svg
                    v-else
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                </span>
                <span class="rune-title">{{ rune.title }}</span>
              </div>
              <div v-if="runes.length === 0" class="empty-rune-list">
                <p>No runes yet</p>
              </div>
            </div>
          </div>

          <!-- Search Panel -->
          <div v-else-if="activeLeftPanel === 'search'" class="sidebar-section">
            <div class="section-header">
              <span class="section-title">Search</span>
            </div>
            <div class="search-placeholder">
              <p>Search functionality coming soon</p>
            </div>
          </div>

          <!-- Graph Panel -->
          <div v-else-if="activeLeftPanel === 'graph'" class="sidebar-section">
            <div class="section-header">
              <span class="section-title">Graph View</span>
            </div>
            <div class="graph-placeholder">
              <p>Graph view coming soon</p>
            </div>
          </div>
        </div>
      </FadeTransition>
    </aside>

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="top-bar-left">
          <div class="document-tabs">
            <div
              v-for="tab in tabs"
              :key="tab.id"
              class="tab"
              :class="{
                active: tab.id === activeTabId,
                dragging: tab.id === draggedTabId,
                'drag-over': tab.id === draggedOverTabId,
              }"
              draggable="true"
              @dragstart="handleTabDragStart($event, tab.id)"
              @dragover="handleTabDragOver($event, tab.id)"
              @dragleave="handleTabDragLeave($event)"
              @drop="handleTabDrop($event, tab.id)"
              @dragend="handleTabDragEnd"
              @click="handleTabClick(tab)"
            >
              <span class="tab-title">{{ tab.title || 'Untitled' }}</span>
              <span v-if="tab.hasUnsavedChanges" class="tab-dot"></span>
              <button class="tab-close" title="Close" @click.stop="handleTabClose($event, tab)">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="top-bar-right">
          <div
            class="save-status"
            :class="{ 'has-error': error, 'has-unsaved': hasUnsavedChanges }"
          >
            <span v-if="saveStatusText">{{ saveStatusText }}</span>
          </div>
          <button
            class="icon-button"
            @click="rightSidebarCollapsed = !rightSidebarCollapsed"
            :class="{ active: !rightSidebarCollapsed }"
            :title="rightSidebarCollapsed ? 'Show Outline' : 'Hide Outline'"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
          <button
            class="icon-button"
            @click="togglePreview"
            :class="{ active: isPreviewMode }"
            :title="isPreviewMode ? 'Exit Preview (Ctrl+E)' : 'Enter Preview (Ctrl+E)'"
          >
            <svg
              v-if="isPreviewMode"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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
          </button>
        </div>
      </header>

      <!-- Editor Area -->
      <div class="editor-area">
        <!-- Empty State -->
        <div v-if="!hasOpenRune && !isLoadingRune" class="empty-state">
          <div class="empty-state-content">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <p class="empty-message">Select or create a rune</p>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else-if="isLoadingRune" class="loading-state">
          <p class="loading-message">Loading document...</p>
        </div>

        <!-- Editor -->
        <div v-else class="editor-container" :class="{ visible: hasOpenRune && !isLoadingRune }">
          <div ref="editorElement" class="editor"></div>
        </div>
      </div>

      <!-- Status Bar -->
      <footer class="status-bar">
        <div class="status-bar-left">
          <span v-if="currentRune" class="status-item">
            {{ currentRune.title }}
          </span>
          <span v-else class="status-item">No document open</span>
        </div>
        <div class="status-bar-right">
          <span v-if="hasOpenRune" class="status-item">
            {{ statusBarInfo.lines }} {{ statusBarInfo.lines === 1 ? 'line' : 'lines' }}
          </span>
          <span v-if="hasOpenRune" class="status-item">
            {{ statusBarInfo.words }} {{ statusBarInfo.words === 1 ? 'word' : 'words' }}
          </span>
          <span v-if="hasOpenRune" class="status-item">
            {{ statusBarInfo.cursorLine }}:{{ statusBarInfo.cursorColumn }}
          </span>
        </div>
      </footer>
    </div>

    <!-- Right Sidebar (Outline) -->
    <aside class="right-sidebar" :class="{ collapsed: rightSidebarCollapsed }">
      <div class="sidebar-header">
        <div class="sidebar-title">
          <h3>Outline</h3>
        </div>
        <button class="sidebar-toggle" @click="rightSidebarCollapsed = true" title="Close Outline">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <FadeTransition>
        <div v-if="!rightSidebarCollapsed" class="sidebar-content">
          <div class="sidebar-section">
            <div v-if="headings.length === 0" class="empty-headings">
              <p>No headings found</p>
            </div>
            <div v-else class="headings-list">
              <button
                v-for="(heading, index) in headings"
                :key="index"
                class="heading-item"
                :class="`heading-level-${heading.level}`"
                @click="handleHeadingClick(heading)"
              >
                <span class="heading-text">{{ heading.text }}</span>
              </button>
            </div>
          </div>
        </div>
      </FadeTransition>
    </aside>

    <KeyboardShortcuts />
    <BubbleMenu :editor-view="editorView" />
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

/* Left Ribbon (Icon Bar) */
.left-ribbon {
  width: 3rem;
  min-width: 3rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-right: 1px solid var(--color-overlay-subtle);
  overflow: hidden;
}

.ribbon-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0;
  gap: 0.5rem;
  height: 100%;
  justify-content: space-between;
}

.ribbon-icon-wrapper {
  height: 0;
  margin-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    margin-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.ribbon-icon-wrapper.has-button {
  height: 2.25rem;
  margin-bottom: 0.5rem;
}

.ribbon-icon {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.7;
  width: 2.25rem;
  height: 2.25rem;
}

.ribbon-icon:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.ribbon-icon.active {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  opacity: 1;
}

.ribbon-icon svg {
  width: 1.125rem;
  height: 1.125rem;
}

.ribbon-spacer {
  flex: 1;
}

.ribbon-divider {
  width: 1.5rem;
  height: 1px;
  background: var(--color-overlay-subtle);
  margin: 0.25rem 0;
}

/* Left Sidebar - Minimalist Narrow Design */
.left-sidebar {
  width: 15rem;
  min-width: 11.25rem;
  max-width: 20rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-right: 1px solid var(--color-overlay-subtle);
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.left-sidebar.collapsed {
  width: 0;
  min-width: 0;
  max-width: 0;
  border-right: none;
  overflow: hidden;
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
}

.sidebar-title {
  flex: 1;
  min-width: 0;
}

.sidebar-title h2,
.sidebar-title h3 {
  font-size: 1rem;
  font-weight: 400;
  color: var(--color-foreground);
  margin: 0;
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}

.sidebar-toggle {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.6;
}

.sidebar-toggle:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 0 0.75rem 0;
  width: 100%;
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

.sidebar-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem 0.75rem 1rem;
  margin-bottom: 0.25rem;
}

.section-title {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
}

.rune-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
}

.rune-actions .icon-button {
  padding: 0.5rem;
}

.rune-actions .icon-button svg {
  width: 1rem;
  height: 1rem;
}

.icon-button {
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

.icon-button:hover {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.icon-button.active {
  background: var(--color-overlay-subtle);
  color: var(--color-foreground);
  opacity: 1;
}

.rune-list {
  padding: 0 0.5rem;
}

.rune-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  margin: 0.0625rem 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--color-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.rune-item:hover {
  background: var(--color-overlay-subtle);
}

.rune-item.active {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  font-weight: 500;
}

.rune-item.directory {
  color: var(--color-accent);
  font-weight: 500;
}

.rune-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 0.875rem;
  height: 0.875rem;
  color: var(--color-muted);
  opacity: 0.7;
}

.rune-item.active .rune-icon {
  color: var(--color-foreground);
  opacity: 1;
}

.rune-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.5;
}

.empty-rune-list {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.6;
}

.search-placeholder,
.graph-placeholder {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.6;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: transparent;
}

/* Top Bar - Minimalist */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  height: 3.5rem;
  min-height: 3.5rem;
  border-bottom: 1px solid var(--color-overlay-subtle);
  background: transparent;
}

.top-bar-left {
  display: flex;
  align-items: flex-end;
  gap: 0;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-right: 1.5rem;
}

.document-tabs {
  display: flex;
  align-items: flex-end;
  gap: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  flex: 1;
  min-width: 0;
  position: relative;
}

.document-tabs > * {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.document-tabs::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-overlay-subtle);
  cursor: grab;
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-muted);
  position: relative;
  font-weight: 400;
  letter-spacing: -0.01em;
  min-width: 6.25rem;
  max-width: 11.25rem;
  user-select: none;
  height: 2rem;
}

.tab::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-foreground);
  transform: scaleX(0);
  transition: transform 0.15s ease;
}

.tab:hover {
  color: var(--color-foreground);
  background: var(--color-overlay-subtle);
}

.tab:hover::after {
  transform: scaleX(1);
}

.tab.active {
  color: var(--color-foreground);
  background: transparent;
  border-bottom-color: transparent;
}

.tab.active::after {
  transform: scaleX(1);
}

.tab.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.tab.drag-over {
  transform: translateX(0.25rem);
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab.drag-over::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-foreground);
  opacity: 0.8;
  border-radius: 1px;
}

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

.tab-dot {
  width: 0.3125rem;
  height: 0.3125rem;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
  opacity: 0.8;
}

.tab-close {
  background: transparent;
  border: none;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s ease;
  opacity: 0;
  margin-left: 0.25rem;
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}

.tab:hover .tab-close {
  opacity: 0.6;
}

.tab-close:hover {
  background: var(--color-overlay-light);
  color: var(--color-foreground);
  opacity: 1;
}

.top-bar-right .save-status {
  padding: 0.375rem 0.875rem;
  font-size: 0.75rem;
  color: var(--color-muted);
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.7;
  font-weight: 400;
  letter-spacing: 0.02em;
}

.save-status.has-unsaved {
  color: var(--color-warning);
  opacity: 1;
}

.save-status.has-error {
  color: var(--color-error);
  opacity: 1;
}

/* Editor Area */
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.empty-state,
.loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  color: var(--color-muted);
}

.empty-state-content svg {
  color: var(--color-accent);
  opacity: 0.3;
}

.empty-message,
.loading-message {
  font-size: 0.875rem;
  color: var(--color-accent);
  margin: 0;
  opacity: 0.6;
  font-weight: 400;
  letter-spacing: -0.01em;
  user-select: none;
}

.editor-container {
  flex: 1;
  width: 100%;
  display: flex;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  overflow: hidden;
}

.editor-container.visible {
  opacity: 1;
  pointer-events: auto;
}

.editor {
  flex: 1;
  width: 100%;
  max-width: 80rem;
  padding: 3rem 4rem;
  overflow-y: auto;
  overflow-x: hidden;
}

.editor::-webkit-scrollbar {
  width: 0.375rem;
}

.editor::-webkit-scrollbar-track {
  background: transparent;
}

.editor::-webkit-scrollbar-thumb {
  background: var(--color-overlay-subtle);
  border-radius: 3px;
}

.editor::-webkit-scrollbar-thumb:hover {
  background: var(--color-overlay-light);
}

/* Status Bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.875rem;
  height: 1.5rem;
  min-height: 1.5rem;
  border-top: 1px solid var(--color-overlay-subtle);
  background: transparent;
  font-size: 0.6875rem;
  user-select: none;
}

.status-bar-left,
.status-bar-right {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.status-item {
  color: var(--color-muted);
  opacity: 0.65;
  font-size: 0.6875rem;
  white-space: nowrap;
  font-weight: 400;
  letter-spacing: 0.01em;
}

/* Right Sidebar (Outline) */
.right-sidebar {
  width: 15rem;
  min-width: 11.25rem;
  max-width: 20rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-left: 1px solid var(--color-overlay-subtle);
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.right-sidebar.collapsed {
  width: 0;
  min-width: 0;
  max-width: 0;
  border-left: none;
  overflow: hidden;
}

.headings-list {
  padding: 0 0.5rem;
}

.heading-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--color-foreground);
  cursor: pointer;
  padding: 0.5rem 0.875rem;
  margin: 0.0625rem 0;
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.8125rem;
  line-height: 1.5;
  font-weight: 400;
  letter-spacing: -0.01em;
}

.heading-item:hover {
  background: var(--color-overlay-subtle);
}

.heading-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.5;
}

.heading-level-1 {
  padding-left: 0.875rem;
  font-weight: 600;
}

.heading-level-2 {
  padding-left: 1.5rem;
  font-weight: 500;
}

.heading-level-3 {
  padding-left: 2.125rem;
  font-weight: 400;
}

.heading-level-4 {
  padding-left: 2.75rem;
  font-weight: 400;
  font-size: 0.75rem;
}

.heading-level-5 {
  padding-left: 3.375rem;
  font-weight: 400;
  font-size: 0.75rem;
}

.heading-level-6 {
  padding-left: 4rem;
  font-weight: 400;
  font-size: 0.75rem;
}

.empty-headings {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-muted);
  font-size: 0.8125rem;
  opacity: 0.6;
}
</style>
