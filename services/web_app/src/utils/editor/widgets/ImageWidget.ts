/**
 * ImageWidget - Renders images inline in the editor
 * Displays actual images in place of markdown syntax
 * Supports sigil:// URLs for encrypted images
 */

import { WidgetType } from '@codemirror/view'

/**
 * Function type to resolve sigil IDs to blob URLs
 */
export type SigilUrlResolver = (sigilId: string) => Promise<string>

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly sigilResolver?: SigilUrlResolver,
  ) {
    super()
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'cm-image-widget'

    const img = document.createElement('img')
    img.alt = this.alt
    img.className = 'cm-image'

    // Set max dimensions for images
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
    img.style.display = 'block'
    img.style.margin = '0.5rem 0'
    img.style.borderRadius = '4px'

    // Handle loading states
    img.onload = () => {
      img.style.opacity = '1'
    }

    // Handle errors - show fallback
    img.onerror = () => {
      img.style.display = 'none'
      const error = document.createElement('span')
      error.className = 'cm-image-error'
      error.textContent = `🖼️ Image not found: ${this.alt || this.src}`
      container.appendChild(error)
    }

    // Start with slightly transparent while loading
    img.style.opacity = '0.5'
    img.style.transition = 'opacity 0.2s'

    // Handle sigil:// URLs
    if (this.src.startsWith('sigil://') || this.src.startsWith('sigil:')) {
      // Extract sigil UUID from URL
      const sigilId = this.src.replace(/^sigil:\/\//, '').replace(/^sigil:/, '')

      if (this.sigilResolver) {
        // Resolve sigil ID to blob URL asynchronously
        this.sigilResolver(sigilId)
          .then((blobUrl) => {
            img.src = blobUrl
          })
          .catch((error) => {
            console.error('Failed to resolve sigil:', error)
            img.onerror?.(new Event('error'))
          })
      } else {
        // No resolver provided - show error
        img.onerror?.(new Event('error'))
      }
    } else {
      // Regular URL - set directly
      img.src = this.src
    }

    container.appendChild(img)

    // Add a wrapper for better layout
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-wrapper'
    wrapper.appendChild(container)

    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}
