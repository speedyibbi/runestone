/**
 * Typed pub/sub. The kernel ships ONLY the domain + navigation event vocabulary
 * (emitted by the data / session facade). Feature events (editor / search / graph)
 * are NOT defined here — a feature module adds its own by augmenting `AppEvents`
 * from its own folder via declaration merging, so the kernel stays
 * feature-agnostic and each module remains deletable:
 *
 *   // src/modules/editor/events.ts
 *   export type EditorMode = 'source' | 'live' | 'reading'
 *   declare module '@/kernel/events' {
 *     interface AppEvents { 'editor:mode-changed': { uuid: string; mode: EditorMode } }
 *   }
 *
 * Deleting that module also deletes its events — nothing dangles in the kernel.
 */
import type { SyncProgress } from '@/services/interfaces/sync'

export interface AppEvents {
  'session:ready': { lookupHash: string }
  'session:teardown': void

  'codex:opened': { codexId: string; title: string }
  'codex:closed': { codexId: string }
  'codex:switched': { fromId: string | null; toId: string }

  'rune:created': { uuid: string; title: string }
  'rune:updated': { uuid: string } // content and/or title
  'rune:renamed': { uuid: string; title: string }
  'rune:deleted': { uuid: string }
  'rune:opened': { uuid: string } // opened in the editor
  'rune:saved': { uuid: string }

  'sigil:created': { uuid: string; title: string }
  'sigil:deleted': { uuid: string }

  'sync:started': { scope: 'current' | 'all' }
  'sync:progress': SyncProgress
  'sync:completed': { scope: 'current' | 'all' }
  'sync:failed': { error: string }

  // Request to open + focus a rune — lets any module (search, graph, outline,
  // wiki-link) drive navigation without depending on the editor module.
  'navigate:rune': { uuid: string; line?: number }
}

export type EventKey = keyof AppEvents
export type EventHandler<K extends EventKey> = (payload: AppEvents[K]) => void

export interface EventBus {
  emit<K extends EventKey>(key: K, payload: AppEvents[K]): void
  on<K extends EventKey>(key: K, cb: EventHandler<K>): () => void // returns unsubscribe
  once<K extends EventKey>(key: K, cb: EventHandler<K>): () => void
}

export function createEventBus(): EventBus {
  const handlers = new Map<EventKey, Set<(payload: unknown) => void>>()

  const on = <K extends EventKey>(key: K, cb: EventHandler<K>): (() => void) => {
    let set = handlers.get(key)
    if (!set) {
      set = new Set<(payload: unknown) => void>()
      handlers.set(key, set)
    }
    const handler = cb as (payload: unknown) => void
    set.add(handler)
    return () => {
      const s = handlers.get(key)
      if (!s) return
      s.delete(handler)
      if (s.size === 0) handlers.delete(key)
    }
  }

  return {
    emit(key, payload) {
      const set = handlers.get(key)
      if (!set) return
      // Copy so a handler may unsubscribe itself during dispatch.
      for (const fn of [...set]) fn(payload)
    },
    on,
    once(key, cb) {
      const off = on(key, (payload) => {
        off()
        cb(payload)
      })
      return off
    },
  }
}
