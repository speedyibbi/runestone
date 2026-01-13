/**
 * useMediaUpload - Composable for handling image, video, and audio uploads in the editor
 * Handles file uploads, drag & drop, and paste events
 * Creates sigils (encrypted media) and inserts markdown references
 */

import { ref, type Ref } from 'vue'
import { EditorView } from '@codemirror/view'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import { MediaEntryType } from '@/interfaces/manifest'

export interface UseMediaUploadOptions {
  editorView?: Ref<EditorView | null>
  showNotifications?: boolean
  onMediaInserted?: (sigilId: string, filename: string) => void
}

export interface UseMediaUploadReturn {
  isUploading: Ref<boolean>
  uploadProgress: Ref<number>
  isDraggingOver: Ref<boolean>
  handleFileUpload: (file: File) => Promise<string | null>
  handleFilesUpload: (files: FileList | File[]) => Promise<void>
  insertMediaMarkdown: (sigilId: string, filename: string, position?: number) => void
  setupDragAndDrop: () => () => void
  setupPasteHandler: () => () => void
}

/**
 * Composable for handling media uploads in the editor
 */
export function useMediaUpload(options: UseMediaUploadOptions = {}): UseMediaUploadReturn {
  const { editorView, showNotifications = false, onMediaInserted } = options

  const sessionStore = useSessionStore()
  const toast = useToast()

  // State
  const isUploading = ref(false)
  const uploadProgress = ref(0)
  const isDraggingOver = ref(false)

  /**
   * Validate that a file is a supported media type (image, video, or audio)
   * Returns the MediaEntryType if valid, null otherwise
   */
  function validateMediaFile(file: File): MediaEntryType | null {
    // Check MIME type
    if (file.type.startsWith('video/')) {
      return MediaEntryType.VIDEO
    }
    if (file.type.startsWith('audio/')) {
      return MediaEntryType.AUDIO
    }
    if (file.type.startsWith('image/')) {
      return MediaEntryType.IMAGE
    }

    if (showNotifications) {
      toast.error(`File must be an image, video, or audio: ${file.name}`)
    }
    return null
  }

  /**
   * Upload a single file and return the sigil ID
   */
  async function handleFileUpload(file: File): Promise<string | null> {
    const mediaType = validateMediaFile(file)
    if (!mediaType) {
      return null
    }

    if (!sessionStore.hasOpenCodex) {
      if (showNotifications) {
        toast.error('No codex is currently open')
      }
      return null
    }

    try {
      isUploading.value = true
      uploadProgress.value = 0

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      uploadProgress.value = 50

      // Create sigil (encrypted media) with the detected type
      const sigilId = await sessionStore.createSigil(file.name, arrayBuffer, mediaType)
      uploadProgress.value = 100

      if (showNotifications) {
        toast.success(`Uploaded: ${file.name}`)
      }

      return sigilId
    } catch (error) {
      console.error('Failed to upload media:', error)
      if (showNotifications) {
        toast.error(`Failed to upload: ${file.name}`)
      }
      return null
    } finally {
      isUploading.value = false
      uploadProgress.value = 0
    }
  }

  /**
   * Upload multiple files
   */
  async function handleFilesUpload(files: FileList | File[]): Promise<void> {
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      const sigilId = await handleFileUpload(file)
      if (sigilId) {
        insertMediaMarkdown(sigilId, file.name)
        onMediaInserted?.(sigilId, file.name)
      }
    }
  }

  /**
   * Insert media markdown at the current cursor position or specified position
   */
  function insertMediaMarkdown(sigilId: string, filename: string, position?: number): void {
    if (!editorView?.value) return

    const view = editorView.value

    // Extract alt text from filename (remove extension)
    const alt = filename.replace(/\.[^.]+$/, '')

    // Create markdown with sigil:// URL
    const markdown = `![${alt}](sigil://${sigilId})`

    // Determine insertion position
    const insertPos = position ?? view.state.selection.main.head

    // Insert the markdown
    view.dispatch({
      changes: {
        from: insertPos,
        to: insertPos,
        insert: markdown,
      },
      selection: {
        anchor: insertPos + markdown.length,
      },
    })

    // Focus the editor
    view.focus()
  }

  /**
   * Setup drag and drop handler for the editor
   * Returns cleanup function
   */
  function setupDragAndDrop(): () => void {
    if (!editorView?.value) {
      return () => {}
    }

    const view = editorView.value
    // Use contentDOM for drag & drop - this is the actual editable content area
    const editorDom = view.contentDOM

    function handleDragEnter(e: DragEvent) {
      // Only track if dragging files (not text or other content)
      if (e.dataTransfer?.types.includes('Files')) {
        // Set to true if we're entering the editor DOM or any of its children
        const target = e.target as Node | null
        if (target && (target === editorDom || editorDom.contains(target))) {
          isDraggingOver.value = true
        }
      }
    }

    function handleDragLeave(e: DragEvent) {
      // Only clear if we're actually leaving the editor area
      if (e.dataTransfer?.types.includes('Files')) {
        const relatedTarget = e.relatedTarget as Node | null
        // If relatedTarget is null or not within editor, we're leaving
        if (!relatedTarget || !editorDom.contains(relatedTarget)) {
          isDraggingOver.value = false
        }
      }
    }

    function handleDragOver(e: DragEvent) {
      // Allow drop
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    function handleDrop(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()

      // Reset drag state
      isDraggingOver.value = false

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) {
        return
      }

      // Get drop position from the current editor view
      const currentView = editorView?.value
      if (!currentView) {
        return
      }

      const pos = currentView.posAtCoords({ x: e.clientX, y: e.clientY })
      const dropPos = pos ?? currentView.state.selection.main.head

      // Upload and insert media files (images, videos, audio)
      const fileArray = Array.from(files).filter(
        (file) =>
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.type.startsWith('audio/'),
      )
      if (fileArray.length === 0) {
        return
      }

      // Upload all media files and insert at drop position
      let currentPos = dropPos
      fileArray.forEach((file) => {
        handleFileUpload(file).then((sigilId) => {
          if (sigilId) {
            insertMediaMarkdown(sigilId, file.name, currentPos)
            onMediaInserted?.(sigilId, file.name)
            // Update position for next media (add length of inserted markdown + newline)
            currentPos += `![${file.name}](sigil://${sigilId})\n`.length
          }
        })
      })
    }

    function handleDragEnd() {
      // Reset drag state when drag ends (e.g., user cancels by dragging outside)
      isDraggingOver.value = false
    }

    function handleDocumentDragLeave(e: DragEvent) {
      // If we drag outside the document/window, clear the state
      // relatedTarget will be null when leaving the document
      if (!e.relatedTarget) {
        isDraggingOver.value = false
      }
    }

    function handleMouseUp() {
      // Fallback: if mouse is released, drag is definitely over
      // This catches cases where dragend doesn't fire (e.g., dragging outside window)
      if (isDraggingOver.value) {
        isDraggingOver.value = false
      }
    }

    editorDom.addEventListener('dragenter', handleDragEnter)
    editorDom.addEventListener('dragleave', handleDragLeave)
    editorDom.addEventListener('dragover', handleDragOver)
    editorDom.addEventListener('drop', handleDrop)
    // Listen on document for dragleave to catch when leaving the page
    document.addEventListener('dragleave', handleDocumentDragLeave)
    // Listen on window for dragend to catch cancelled drags
    window.addEventListener('dragend', handleDragEnd)
    // Fallback: listen for mouseup to catch cases where dragend doesn't fire
    document.addEventListener('mouseup', handleMouseUp)

    // Return cleanup function
    return () => {
      editorDom.removeEventListener('dragenter', handleDragEnter)
      editorDom.removeEventListener('dragleave', handleDragLeave)
      editorDom.removeEventListener('dragover', handleDragOver)
      editorDom.removeEventListener('drop', handleDrop)
      document.removeEventListener('dragleave', handleDocumentDragLeave)
      window.removeEventListener('dragend', handleDragEnd)
      document.removeEventListener('mouseup', handleMouseUp)
      // Reset state on cleanup
      isDraggingOver.value = false
    }
  }

  /**
   * Setup paste handler for the editor
   * Returns cleanup function
   */
  function setupPasteHandler(): () => void {
    if (!editorView?.value) {
      return () => {}
    }

    const view = editorView.value
    // Use contentDOM for paste - this is the actual editable content area
    const editorDom = view.contentDOM

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return

      // Check if there are any media files in clipboard (images, videos, audio)
      const mediaFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (
          item.type.startsWith('image/') ||
          item.type.startsWith('video/') ||
          item.type.startsWith('audio/')
        ) {
          const file = item.getAsFile()
          if (file) {
            mediaFiles.push(file)
          }
        }
      }

      if (mediaFiles.length === 0) return

      // Prevent default paste behavior for media
      e.preventDefault()
      e.stopPropagation()

      // Upload and insert media at cursor position
      handleFilesUpload(mediaFiles)
    }

    editorDom.addEventListener('paste', handlePaste)

    // Return cleanup function
    return () => {
      editorDom.removeEventListener('paste', handlePaste)
    }
  }

  return {
    isUploading,
    uploadProgress,
    isDraggingOver,
    handleFileUpload,
    handleFilesUpload,
    insertMediaMarkdown,
    setupDragAndDrop,
    setupPasteHandler,
  }
}
