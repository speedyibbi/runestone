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
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-video-wrapper'

    const container = document.createElement('div')
    container.className = 'cm-video-widget'

    const video = document.createElement('video')
    video.className = 'cm-video'
    video.preload = 'metadata'

    // Create custom controls overlay
    const controlsOverlay = document.createElement('div')
    controlsOverlay.className = 'cm-video-controls-overlay'

    const controls = document.createElement('div')
    controls.className = 'cm-video-controls'

    // Play/pause button
    const playPauseBtn = document.createElement('button')
    playPauseBtn.className = 'cm-video-play-pause'
    playPauseBtn.setAttribute('aria-label', 'Play/Pause')
    playPauseBtn.innerHTML = `
      <svg class="cm-video-icon-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <svg class="cm-video-icon-pause" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    `

    // Progress container
    const progressContainer = document.createElement('div')
    progressContainer.className = 'cm-video-progress-container'

    const progressBar = document.createElement('div')
    progressBar.className = 'cm-video-progress-bar'

    const progressTrack = document.createElement('div')
    progressTrack.className = 'cm-video-progress-track'

    const progressThumb = document.createElement('div')
    progressThumb.className = 'cm-video-progress-thumb'

    progressTrack.appendChild(progressThumb)
    progressBar.appendChild(progressTrack)
    progressContainer.appendChild(progressBar)

    // Time display
    const timeDisplay = document.createElement('div')
    timeDisplay.className = 'cm-video-time'
    timeDisplay.textContent = '0:00 / 0:00'

    // Volume container
    const volumeContainer = document.createElement('div')
    volumeContainer.className = 'cm-video-volume-container'

    const volumeBtn = document.createElement('button')
    volumeBtn.className = 'cm-video-volume-btn'
    volumeBtn.setAttribute('aria-label', 'Volume')
    volumeBtn.innerHTML = `
      <svg class="cm-video-icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path class="cm-video-volume-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
      <svg class="cm-video-icon-volume-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <line x1="23" y1="9" x2="17" y2="15"/>
        <line x1="17" y1="9" x2="23" y2="15"/>
      </svg>
    `

    const volumeSlider = document.createElement('div')
    volumeSlider.className = 'cm-video-volume-slider'

    const volumeTrack = document.createElement('div')
    volumeTrack.className = 'cm-video-volume-track'

    const volumeThumb = document.createElement('div')
    volumeThumb.className = 'cm-video-volume-thumb'

    volumeTrack.appendChild(volumeThumb)
    volumeSlider.appendChild(volumeTrack)
    volumeContainer.appendChild(volumeBtn)
    volumeContainer.appendChild(volumeSlider)

    // Fullscreen button
    const fullscreenBtn = document.createElement('button')
    fullscreenBtn.className = 'cm-video-fullscreen'
    fullscreenBtn.setAttribute('aria-label', 'Fullscreen')
    fullscreenBtn.innerHTML = `
      <svg class="cm-video-icon-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
      </svg>
      <svg class="cm-video-icon-fullscreen-exit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
      </svg>
    `

    // Assemble controls
    controls.appendChild(playPauseBtn)
    controls.appendChild(progressContainer)
    controls.appendChild(timeDisplay)
    controls.appendChild(volumeContainer)
    controls.appendChild(fullscreenBtn)

    controlsOverlay.appendChild(controls)
    container.appendChild(video)
    container.appendChild(controlsOverlay)

    // Format time helper
    const formatTime = (seconds: number): string => {
      if (isNaN(seconds)) return '0:00'
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // Update progress bar
    const updateProgress = () => {
      // Don't update if we're dragging - we control the position manually
      if (isDragging) return
      
      if (video.duration) {
        const percent = (video.currentTime / video.duration) * 100
        progressTrack.style.width = `${percent}%`
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`
      }
    }

    // Update volume slider
    const updateVolume = () => {
      const percent = video.volume * 100
      volumeTrack.style.width = `${percent}%`
      const volumeIcon = volumeBtn.querySelector('.cm-video-icon-volume') as HTMLElement
      const volumeMuteIcon = volumeBtn.querySelector('.cm-video-icon-volume-mute') as HTMLElement
      if (video.volume === 0 || video.muted) {
        volumeIcon.style.display = 'none'
        volumeMuteIcon.style.display = 'block'
      } else {
        volumeIcon.style.display = 'block'
        volumeMuteIcon.style.display = 'none'
      }
    }

    // Toggle controls visibility
    let controlsTimeout: ReturnType<typeof setTimeout> | null = null
    const showControls = () => {
      controlsOverlay.classList.add('visible')
      if (controlsTimeout) {
        clearTimeout(controlsTimeout)
      }
      if (!video.paused) {
        controlsTimeout = setTimeout(() => {
          if (!video.paused) {
            controlsOverlay.classList.remove('visible')
          }
        }, 3000)
      }
    }

    const hideControls = () => {
      if (!video.paused) {
        controlsOverlay.classList.remove('visible')
      }
    }

    // Show controls on mouse move
    container.addEventListener('mousemove', showControls)
    container.addEventListener('mouseleave', hideControls)

    // Play/pause toggle
    playPauseBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (video.paused) {
        video.play()
      } else {
        video.pause()
      }
    })

    // Click video to play/pause
    video.addEventListener('click', () => {
      if (video.paused) {
        video.play()
      } else {
        video.pause()
      }
    })

    // Update play/pause icon
    video.addEventListener('play', () => {
      const playIcon = playPauseBtn.querySelector('.cm-video-icon-play') as HTMLElement
      const pauseIcon = playPauseBtn.querySelector('.cm-video-icon-pause') as HTMLElement
      playIcon.style.display = 'none'
      pauseIcon.style.display = 'block'
      hideControls()
    })

    video.addEventListener('pause', () => {
      const playIcon = playPauseBtn.querySelector('.cm-video-icon-play') as HTMLElement
      const pauseIcon = playPauseBtn.querySelector('.cm-video-icon-pause') as HTMLElement
      playIcon.style.display = 'block'
      pauseIcon.style.display = 'none'
      showControls()
    })

    // Progress bar interaction
    let isDragging = false
    let hasError = false
    let wasPlaying = false
    let seekTarget: number | null = null

    const setProgress = (e: MouseEvent | TouchEvent, isDrag = false) => {
      if (!video.duration || hasError) return
      
      const rect = progressBar.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const newTime = percent * video.duration
      
      if (isDrag) {
        // During drag, ONLY update visual - don't seek at all
        // This prevents buffering issues and video getting stuck
        progressTrack.style.transition = 'none'
        progressTrack.style.width = `${percent * 100}%`
        timeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(video.duration)}`
        seekTarget = newTime
        // Don't set video.currentTime during drag - wait until drag ends
      } else {
        // On click (not drag), seek immediately
        try {
          if (video.readyState >= 2) {
            video.currentTime = newTime
            seekTarget = newTime
          }
        } catch (err) {
          console.debug('Seek error:', err)
        }
      }
    }

    progressBar.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      wasPlaying = !video.paused
      if (wasPlaying) {
        video.pause()
      }
      isDragging = true
      progressBar.classList.add('dragging')
      setProgress(e, true)
    })

    progressBar.addEventListener('touchstart', (e) => {
      e.stopPropagation()
      wasPlaying = !video.paused
      if (wasPlaying) {
        video.pause()
      }
      isDragging = true
      progressBar.classList.add('dragging')
      setProgress(e, true)
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
        progressTrack.style.transition = ''
        
        // Seek to final position - only seek once at the end
        if (seekTarget !== null && video.readyState >= 2) {
          const targetTime = seekTarget
          seekTarget = null // Clear immediately to prevent conflicts
          
          try {
            // Set up seek completion handler before seeking
            const seekHandler = () => {
              // Resume playing if it was playing before
              if (wasPlaying) {
                video.play().catch(() => {
                  // Ignore play errors
                })
              }
              // Update progress after seek completes
              setTimeout(() => {
                if (!isDragging) {
                  updateProgress()
                }
              }, 50)
            }
            
            video.addEventListener('seeked', seekHandler, { once: true })
            
            // Now perform the seek
            video.currentTime = targetTime
            
            // Fallback timeout in case seeked event doesn't fire
            setTimeout(() => {
              video.removeEventListener('seeked', seekHandler)
              if (wasPlaying && video.paused) {
                video.play().catch(() => {})
              }
              if (!isDragging) {
                updateProgress()
              }
            }, 500)
          } catch (err) {
            console.debug('Seek error on drag end:', err)
            // Still try to resume
            if (wasPlaying) {
              video.play().catch(() => {})
            }
            updateProgress()
          }
        } else {
          // No seek needed, just resume if was playing
          if (wasPlaying) {
            video.play().catch(() => {})
          }
          updateProgress()
        }
        
        wasPlaying = false
      }
    }

    document.addEventListener('mouseup', endDrag)
    document.addEventListener('touchend', endDrag)

    // Volume button toggle mute
    volumeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      video.muted = !video.muted
      updateVolume()
    })

    // Volume slider interaction
    let isVolumeDragging = false

    const setVolume = (e: MouseEvent | TouchEvent, isDrag = false) => {
      const rect = volumeSlider.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      
      if (isDrag) {
        volumeTrack.style.transition = 'none'
        volumeTrack.style.width = `${percent * 100}%`
      }
      
      video.volume = percent
      video.muted = false
      
      if (!isDrag) {
        updateVolume()
      } else {
        const volumeIcon = volumeBtn.querySelector('.cm-video-icon-volume') as HTMLElement
        const volumeMuteIcon = volumeBtn.querySelector('.cm-video-icon-volume-mute') as HTMLElement
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
      e.stopPropagation()
      isVolumeDragging = true
      volumeSlider.classList.add('dragging')
      setVolume(e, true)
    })

    volumeSlider.addEventListener('touchstart', (e) => {
      e.stopPropagation()
      isVolumeDragging = true
      volumeSlider.classList.add('dragging')
      setVolume(e, true)
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
        volumeTrack.style.transition = ''
        updateVolume()
      }
    }

    document.addEventListener('mouseup', endVolumeDrag)
    document.addEventListener('touchend', endVolumeDrag)

    // Fullscreen toggle
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {
          // Fallback for browsers that don't support fullscreen
        })
      } else {
        document.exitFullscreen()
      }
    })

    // Update fullscreen icon
    const updateFullscreenIcon = () => {
      const fullscreenIcon = fullscreenBtn.querySelector('.cm-video-icon-fullscreen') as HTMLElement
      const fullscreenExitIcon = fullscreenBtn.querySelector('.cm-video-icon-fullscreen-exit') as HTMLElement
      if (document.fullscreenElement) {
        fullscreenIcon.style.display = 'none'
        fullscreenExitIcon.style.display = 'block'
      } else {
        fullscreenIcon.style.display = 'block'
        fullscreenExitIcon.style.display = 'none'
      }
    }

    document.addEventListener('fullscreenchange', updateFullscreenIcon)

    // Update on time update
    video.addEventListener('timeupdate', () => {
      // Completely ignore timeupdate while dragging
      if (isDragging) {
        return
      }
      
      // If we have a seek target, check if we're close enough
      if (seekTarget !== null) {
        const diff = Math.abs(video.currentTime - seekTarget)
        if (diff < 0.5) {
          // Seek completed, clear target
          seekTarget = null
        } else {
          // Still seeking, don't update progress yet
          return
        }
      }
      
      updateProgress()
    })
    
    video.addEventListener('seeked', () => {
      // Seek completed, clear target and update
      seekTarget = null
      if (!isDragging) {
        updateProgress()
      }
    })
    
    video.addEventListener('loadedmetadata', () => {
      updateProgress()
      updateVolume()
      container.style.opacity = '1'
    })

    // Handle errors - show fallback
    // Only show error if it's a real loading/playback error, not a seek error
    let videoLoaded = false
    video.addEventListener('loadeddata', () => {
      videoLoaded = true
    })

    video.addEventListener('error', (e) => {
      // Only show error if video hasn't loaded successfully (real loading error)
      // Ignore errors that occur after video has loaded (likely seek errors)
      if (!videoLoaded && video.readyState === 0) {
        hasError = true
        container.style.display = 'none'
        const error = document.createElement('span')
        error.className = 'cm-video-error'
        error.textContent = `🎥 Video not found: ${this.alt || this.src}`
        wrapper.appendChild(error)
      }
    })

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

    wrapper.appendChild(container)

    return wrapper
  }

  ignoreEvent(): boolean {
    return false
  }
}
