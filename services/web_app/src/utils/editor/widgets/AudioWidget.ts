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
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-audio-wrapper'

    const container = document.createElement('div')
    container.className = 'cm-audio-widget'

    const audio = document.createElement('audio')
    audio.className = 'cm-audio'
    audio.preload = 'metadata'

    // Create custom controls
    const controls = document.createElement('div')
    controls.className = 'cm-audio-controls'

    // Play/pause button
    const playPauseBtn = document.createElement('button')
    playPauseBtn.className = 'cm-audio-play-pause'
    playPauseBtn.setAttribute('aria-label', 'Play/Pause')
    playPauseBtn.innerHTML = `
      <svg class="cm-audio-icon-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <svg class="cm-audio-icon-pause" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    `

    // Progress container
    const progressContainer = document.createElement('div')
    progressContainer.className = 'cm-audio-progress-container'

    const progressBar = document.createElement('div')
    progressBar.className = 'cm-audio-progress-bar'

    const progressTrack = document.createElement('div')
    progressTrack.className = 'cm-audio-progress-track'

    const progressThumb = document.createElement('div')
    progressThumb.className = 'cm-audio-progress-thumb'

    progressTrack.appendChild(progressThumb)
    progressBar.appendChild(progressTrack)
    progressContainer.appendChild(progressBar)

    // Time display
    const timeDisplay = document.createElement('div')
    timeDisplay.className = 'cm-audio-time'
    timeDisplay.textContent = '0:00 / 0:00'

    // Volume container
    const volumeContainer = document.createElement('div')
    volumeContainer.className = 'cm-audio-volume-container'

    const volumeBtn = document.createElement('button')
    volumeBtn.className = 'cm-audio-volume-btn'
    volumeBtn.setAttribute('aria-label', 'Volume')
    volumeBtn.innerHTML = `
      <svg class="cm-audio-icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path class="cm-audio-volume-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
      <svg class="cm-audio-icon-volume-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <line x1="23" y1="9" x2="17" y2="15"/>
        <line x1="17" y1="9" x2="23" y2="15"/>
      </svg>
    `

    const volumeSlider = document.createElement('div')
    volumeSlider.className = 'cm-audio-volume-slider'

    const volumeTrack = document.createElement('div')
    volumeTrack.className = 'cm-audio-volume-track'

    const volumeThumb = document.createElement('div')
    volumeThumb.className = 'cm-audio-volume-thumb'

    volumeTrack.appendChild(volumeThumb)
    volumeSlider.appendChild(volumeTrack)
    volumeContainer.appendChild(volumeBtn)
    volumeContainer.appendChild(volumeSlider)

    // Assemble controls
    controls.appendChild(playPauseBtn)
    controls.appendChild(progressContainer)
    controls.appendChild(timeDisplay)
    controls.appendChild(volumeContainer)

    container.appendChild(audio)
    container.appendChild(controls)

    // Format time helper
    const formatTime = (seconds: number): string => {
      if (isNaN(seconds)) return '0:00'
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Update progress bar
    const updateProgress = () => {
      if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100
        progressTrack.style.width = `${percent}%`
        timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`
      }
    }

    // Update volume slider
    const updateVolume = () => {
      const percent = audio.volume * 100
      volumeTrack.style.width = `${percent}%`
      const volumeIcon = volumeBtn.querySelector('.cm-audio-icon-volume') as HTMLElement
      const volumeMuteIcon = volumeBtn.querySelector('.cm-audio-icon-volume-mute') as HTMLElement
      if (audio.volume === 0 || audio.muted) {
        volumeIcon.style.display = 'none'
        volumeMuteIcon.style.display = 'block'
      } else {
        volumeIcon.style.display = 'block'
        volumeMuteIcon.style.display = 'none'
      }
    }

    // Play/pause toggle
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play()
      } else {
        audio.pause()
      }
    })

    // Update play/pause icon
    audio.addEventListener('play', () => {
      const playIcon = playPauseBtn.querySelector('.cm-audio-icon-play') as HTMLElement
      const pauseIcon = playPauseBtn.querySelector('.cm-audio-icon-pause') as HTMLElement
      playIcon.style.display = 'none'
      pauseIcon.style.display = 'block'
    })

    audio.addEventListener('pause', () => {
      const playIcon = playPauseBtn.querySelector('.cm-audio-icon-play') as HTMLElement
      const pauseIcon = playPauseBtn.querySelector('.cm-audio-icon-pause') as HTMLElement
      playIcon.style.display = 'block'
      pauseIcon.style.display = 'none'
    })

    // Progress bar interaction
    let isDragging = false

    const setProgress = (e: MouseEvent | TouchEvent, isDrag = false) => {
      if (!audio.duration) return
      
      const rect = progressBar.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      
      if (isDrag) {
        // During drag, update visual immediately without transition
        progressTrack.style.transition = 'none'
        progressTrack.style.width = `${percent * 100}%`
        const newTime = percent * audio.duration
        timeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(audio.duration)}`
        // Update audio position
        audio.currentTime = newTime
      } else {
        // On click, update normally
        audio.currentTime = percent * audio.duration
        updateProgress()
      }
    }

    progressBar.addEventListener('mousedown', (e) => {
      isDragging = true
      progressBar.classList.add('dragging')
      setProgress(e, true)
      e.preventDefault()
    })

    progressBar.addEventListener('touchstart', (e) => {
      isDragging = true
      progressBar.classList.add('dragging')
      setProgress(e, true)
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        setProgress(e, true)
        e.preventDefault()
      }
    })

    document.addEventListener('touchmove', (e) => {
      if (isDragging) {
        setProgress(e, true)
        e.preventDefault()
      }
    })

    const endDrag = () => {
      if (isDragging) {
        isDragging = false
        progressBar.classList.remove('dragging')
        // Re-enable transition after drag ends
        progressTrack.style.transition = ''
        updateProgress()
      }
    }

    document.addEventListener('mouseup', endDrag)
    document.addEventListener('touchend', endDrag)

    // Volume button toggle mute
    volumeBtn.addEventListener('click', () => {
      audio.muted = !audio.muted
      updateVolume()
    })

    // Volume slider interaction
    let isVolumeDragging = false

    const setVolume = (e: MouseEvent | TouchEvent, isDrag = false) => {
      const rect = volumeSlider.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      
      if (isDrag) {
        // During drag, update visual immediately without transition
        volumeTrack.style.transition = 'none'
        volumeTrack.style.width = `${percent * 100}%`
      }
      
      audio.volume = percent
      audio.muted = false
      
      if (!isDrag) {
        updateVolume()
      } else {
        // Update icon immediately during drag
        const volumeIcon = volumeBtn.querySelector('.cm-audio-icon-volume') as HTMLElement
        const volumeMuteIcon = volumeBtn.querySelector('.cm-audio-icon-volume-mute') as HTMLElement
        if (percent === 0) {
          volumeIcon.style.display = 'none'
          volumeMuteIcon.style.display = 'block'
        } else {
          volumeIcon.style.display = 'block'
          volumeMuteIcon.style.display = 'none'
        }
      }
    }

    volumeSlider.addEventListener('mousedown', (e) => {
      isVolumeDragging = true
      volumeSlider.classList.add('dragging')
      setVolume(e, true)
      e.preventDefault()
    })

    volumeSlider.addEventListener('touchstart', (e) => {
      isVolumeDragging = true
      volumeSlider.classList.add('dragging')
      setVolume(e, true)
      e.preventDefault()
    })

    document.addEventListener('mousemove', (e) => {
      if (isVolumeDragging) {
        setVolume(e, true)
        e.preventDefault()
      }
    })

    document.addEventListener('touchmove', (e) => {
      if (isVolumeDragging) {
        setVolume(e, true)
        e.preventDefault()
      }
    })

    const endVolumeDrag = () => {
      if (isVolumeDragging) {
        isVolumeDragging = false
        volumeSlider.classList.remove('dragging')
        // Re-enable transition after drag ends
        volumeTrack.style.transition = ''
        updateVolume()
      }
    }

    document.addEventListener('mouseup', endVolumeDrag)
    document.addEventListener('touchend', endVolumeDrag)

    // Update on time update
    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('loadedmetadata', () => {
      updateProgress()
      updateVolume()
      container.style.opacity = '1'
    })

    // Handle errors - show fallback
    audio.onerror = () => {
      container.style.display = 'none'
      const error = document.createElement('span')
      error.className = 'cm-audio-error'
      error.textContent = `🎵 Audio not found: ${this.alt || this.src}`
      wrapper.appendChild(error)
    }

    // Start with slightly transparent while loading
    container.style.opacity = '0.5'
    container.style.transition = 'opacity 0.2s'

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

    wrapper.appendChild(container)

    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}
