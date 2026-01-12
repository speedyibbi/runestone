/**
 * VideoWidget - Renders videos inline in the editor
 * Displays actual videos in place of markdown syntax
 * Supports sigil:// URLs for encrypted videos
 */

import { WidgetType } from '@codemirror/view'
import type { SigilUrlResolver } from './ImageWidget'

export class VideoWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly sigilResolver?: SigilUrlResolver,
  ) {
    super()
  }

  eq(other: VideoWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'cm-video-widget'

    const video = document.createElement('video')
    video.controls = true
    video.className = 'cm-video'

    // Set max dimensions for videos
    video.style.maxWidth = '100%'
    video.style.height = 'auto'
    video.style.display = 'block'
    video.style.margin = '0.5rem 0'
    video.style.borderRadius = '4px'

    // Handle loading states
    video.onloadeddata = () => {
      video.style.opacity = '1'
    }

    // Handle errors - show fallback
    video.onerror = () => {
      video.style.display = 'none'
      const error = document.createElement('span')
      error.className = 'cm-video-error'
      error.textContent = `🎥 Video not found: ${this.alt || this.src}`
      container.appendChild(error)
    }

    // Start with slightly transparent while loading
    video.style.opacity = '0.5'
    video.style.transition = 'opacity 0.2s'

    // Handle sigil:// URLs
    if (this.src.startsWith('sigil://') || this.src.startsWith('sigil:')) {
      // Extract sigil UUID from URL
      const sigilId = this.src.replace(/^sigil:\/\//, '').replace(/^sigil:/, '')

      if (this.sigilResolver) {
        // Resolve sigil ID to blob URL asynchronously
        this.sigilResolver(sigilId)
          .then((blobUrl) => {
            video.src = blobUrl
          })
          .catch((error) => {
            console.error('Failed to resolve sigil:', error)
            video.onerror?.(new Event('error'))
          })
      } else {
        // No resolver provided - show error
        video.onerror?.(new Event('error'))
      }
    } else {
      // Regular URL - set directly
      video.src = this.src
    }

    container.appendChild(video)

    // Add a wrapper for better layout
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-video-wrapper'
    wrapper.appendChild(container)

    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}
