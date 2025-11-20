import { ref } from 'vue'
import { defineStore } from 'pinia'
import OrchestrationService from '@/services/orchestration/orchestrator'
import type { Map } from '@/interfaces/map'
import type { Manifest } from '@/interfaces/manifest'
import type { SyncProgress } from '@/interfaces/sync'

/**
 * Session store for managing user session state
 * NOTE: All state is in-memory only, nothing is persisted
 */
export const useSessionStore = defineStore('session', () => {
  // State
  const email = ref<string | null>(null)
  const lookupHash = ref<string | null>(null)

  const root = ref<{
    mek: CryptoKey | null
    map: Map | null
  }>({
    mek: null,
    map: null,
  })

  const notebook = ref<{
    fek: CryptoKey | null
    manifest: Manifest | null
  }>({
    fek: null,
    manifest: null,
  })

  /**
   * Setup session - bootstrap if possible, otherwise initialize
   */
  async function setup(userEmail: string, lookupKey: string, signal?: AbortSignal): Promise<void> {
    // If email and lookupHash are already set, return early
    if (email.value && lookupHash.value) {
      throw new Error('Session already setup')
    }

    // Check if bootstrap is possible
    const canBootstrap = await OrchestrationService.canBootstrap(signal)

    if (canBootstrap) {
      // Bootstrap existing user account
      const result = await OrchestrationService.bootstrap(userEmail, lookupKey, signal)

      // Update state
      email.value = userEmail
      lookupHash.value = result.lookupHash
      root.value.mek = result.mek
      root.value.map = result.map
    } else {
      // Initialize new user account
      const result = await OrchestrationService.initialize(userEmail, lookupKey, signal)

      // Update state
      email.value = userEmail
      lookupHash.value = result.lookupHash
      root.value.mek = result.mek
      root.value.map = result.map
    }
  }

  return {
    // State
    email,
    lookupHash,
    root,
    notebook,

    // Functions
    setup,
  }
})
