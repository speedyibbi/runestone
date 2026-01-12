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

    editorDom.addEventListener('dragover', handleDragOver)
    editorDom.addEventListener('drop', handleDrop)

    // Return cleanup function
    return () => {
      editorDom.removeEventListener('dragover', handleDragOver)
      editorDom.removeEventListener('drop', handleDrop)
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
    handleFileUpload,
    handleFilesUpload,
    insertMediaMarkdown,
    setupDragAndDrop,
    setupPasteHandler,
  }
}
