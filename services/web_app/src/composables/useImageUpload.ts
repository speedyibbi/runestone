/**
 * useImageUpload - Composable for handling image uploads in the editor
 * Handles file uploads, drag & drop, and paste events
 * Creates sigils (encrypted images) and inserts markdown references
 */

import { ref, type Ref } from 'vue'
import { EditorView } from '@codemirror/view'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

export interface UseImageUploadOptions {
  editorView?: Ref<EditorView | null>
  showNotifications?: boolean
  onImageInserted?: (sigilId: string, filename: string) => void
}

export interface UseImageUploadReturn {
  isUploading: Ref<boolean>
  uploadProgress: Ref<number>
  handleFileUpload: (file: File) => Promise<string | null>
  handleFilesUpload: (files: FileList | File[]) => Promise<void>
  insertImageMarkdown: (sigilId: string, filename: string, position?: number) => void
  setupDragAndDrop: () => () => void
  setupPasteHandler: () => () => void
}

/**
 * Composable for handling image uploads in the editor
 */
export function useImageUpload(options: UseImageUploadOptions = {}): UseImageUploadReturn {
  const { editorView, showNotifications = false, onImageInserted } = options

  const sessionStore = useSessionStore()
  const toast = useToast()

  // State
  const isUploading = ref(false)
  const uploadProgress = ref(0)

  /**
   * Validate that a file is an image
   */
  function validateImageFile(file: File): boolean {
    // Check MIME type
    if (!file.type.startsWith('image/')) {
      if (showNotifications) {
        toast.error(`File must be an image: ${file.name}`)
      }
      return false
    }

    return true
  }

  /**
   * Upload a single file and return the sigil ID
   */
  async function handleFileUpload(file: File): Promise<string | null> {
    if (!validateImageFile(file)) {
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

      // Create sigil (encrypted image)
      const sigilId = await sessionStore.createSigil(file.name, arrayBuffer)
      uploadProgress.value = 100

      if (showNotifications) {
        toast.success(`Uploaded: ${file.name}`)
      }

      return sigilId
    } catch (error) {
      console.error('Failed to upload image:', error)
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
        insertImageMarkdown(sigilId, file.name)
        onImageInserted?.(sigilId, file.name)
      }
    }
  }

  /**
   * Insert image markdown at the current cursor position or specified position
   */
  function insertImageMarkdown(sigilId: string, filename: string, position?: number): void {
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

      // Upload and insert images
      const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (fileArray.length === 0) {
        return
      }

      // Upload all images and insert at drop position
      let currentPos = dropPos
      fileArray.forEach((file) => {
        handleFileUpload(file).then((sigilId) => {
          if (sigilId) {
            insertImageMarkdown(sigilId, file.name, currentPos)
            onImageInserted?.(sigilId, file.name)
            // Update position for next image (add length of inserted markdown + newline)
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

      // Check if there are any image files in clipboard
      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length === 0) return

      // Prevent default paste behavior for images
      e.preventDefault()
      e.stopPropagation()

      // Upload and insert images at cursor position
      handleFilesUpload(imageFiles)
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
    insertImageMarkdown,
    setupDragAndDrop,
    setupPasteHandler,
  }
}
