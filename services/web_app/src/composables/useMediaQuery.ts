import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Composable to detect if the viewport matches a media query
 */
export function useMediaQuery(query: string) {
  const matches = ref(false)

  const updateMatches = () => {
    if (typeof window !== 'undefined') {
      matches.value = window.matchMedia(query).matches
    }
  }

  onMounted(() => {
    updateMatches()
    const mediaQuery = window.matchMedia(query)
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMatches)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(updateMatches)
    }
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query)
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateMatches)
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(updateMatches)
      }
    }
  })

  return matches
}

/**
 * Composable to detect if the viewport is mobile (max-width: 1023px)
 */
export function useIsMobile() {
  return useMediaQuery('(max-width: 1023px)')
}
