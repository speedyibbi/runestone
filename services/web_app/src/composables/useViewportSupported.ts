import { ref, onMounted, onUnmounted } from 'vue'

/** Minimum viewport width for the desktop application (see CHANGES.MD viewport policy). */
export const MIN_VIEWPORT_WIDTH = 1024

const DESKTOP_MEDIA_QUERY = `(min-width: ${MIN_VIEWPORT_WIDTH}px)`

function getIsSupported(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

/**
 * Whether the viewport meets the minimum width for the application.
 */
export function useViewportSupported() {
  const isSupported = ref(getIsSupported())

  function onChange(event: MediaQueryListEvent) {
    isSupported.value = event.matches
  }

  onMounted(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY)
    isSupported.value = mediaQuery.matches
    mediaQuery.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    window.matchMedia(DESKTOP_MEDIA_QUERY).removeEventListener('change', onChange)
  })

  return { isSupported, minWidth: MIN_VIEWPORT_WIDTH }
}
