/**
 * The generic contribution registry (a real kernel service) plus the data-facade stub
 * that throws until the session facade lands in Phase 5.
 */

import { shallowReactive } from 'vue'

/**
 * A contribution is an opaque declaration a module pushes into the kernel for a
 * host (a design) to render, route, or ignore. The kernel never inspects `kind`
 * or `payload` — it only stores and lists. Designs and feature-aggregators filter
 * by `kind` (e.g. 'view', 'action', 'indicator', 'menu-entry', 'settings-section',
 * 'editor.extension'). Those names are conventions, not kernel types — the kernel
 * commits to no UI surface, layout, or input affordance.
 */
export interface Contribution {
  id: string
  kind: string
  payload?: unknown
}

export interface ContributionRegistry {
  register(item: Contribution): () => void
  list(kind?: string): Contribution[]
}

export function createContributionRegistry(): ContributionRegistry {
  // shallowReactive: the SET of contributions is reactive (a host's `list()` in a
  // computed re-runs on register/unregister) without deeply proxying payloads.
  const items = shallowReactive(new Map<string, Contribution>())
  return {
    register(item) {
      items.set(item.id, item)
      return () => {
        items.delete(item.id)
      }
    },
    list(kind) {
      const all = [...items.values()]
      return kind ? all.filter((c) => c.kind === kind) : all
    },
  }
}

export function createDataStub() {
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        throw new Error(`SessionFacade.${String(prop)} is not available until Phase 5`)
      },
    },
  )
}
