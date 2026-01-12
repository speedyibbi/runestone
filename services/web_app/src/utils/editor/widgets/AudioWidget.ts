/**
 * AudioWidget - Renders audio inline in the editor
 * Displays actual audio player in place of markdown syntax
 * Supports sigil:// URLs for encrypted audio
 */

import { WidgetType } from '@codemirror/view'
import type { SigilUrlResolver } from './ImageWidget'

export class AudioWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly sigilResolver?: SigilUrlResolver,
  ) {
    super()
  }

  eq(other: AudioWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'cm-audio-widget'

    const audio = document.createElement('audio')
    audio.controls = true
    audio.className = 'cm-audio'

    // Set styling for audio player
    audio.style.width = '100%'
    audio.style.display = 'block'
    audio.style.margin = '0.5rem 0'

    // Handle loading states
    audio.onloadeddata = () => {
      audio.style.opacity = '1'
    }

    // Handle errors - show fallback
    audio.onerror = () => {
      audio.style.display = 'none'
      const error = document.createElement('span')
      error.className = 'cm-audio-error'
      error.textContent = `🎵 Audio not found: ${this.alt || this.src}`
      container.appendChild(error)
    }

    // Start with slightly transparent while loading
    audio.style.opacity = '0.5'
    audio.style.transition = 'opacity 0.2s'

    // Handle sigil:// URLs
    if (this.src.startsWith('sigil://') || this.src.startsWith('sigil:')) {
      // Extract sigil UUID from URL
      const sigilId = this.src.replace(/^sigil:\/\//, '').replace(/^sigil:/, '')

      if (this.sigilResolver) {
        // Resolve sigil ID to blob URL asynchronously
        this.sigilResolver(sigilId)
          .then((blobUrl) => {
            audio.src = blobUrl
          })
          .catch((error) => {
            console.error('Failed to resolve sigil:', error)
            audio.onerror?.(new Event('error'))
          })
      } else {
        // No resolver provided - show error
        audio.onerror?.(new Event('error'))
      }
    } else {
      // Regular URL - set directly
      audio.src = this.src
    }

    container.appendChild(audio)

    // Add a wrapper for better layout
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-audio-wrapper'
    wrapper.appendChild(container)

    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}
