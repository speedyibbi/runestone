import type { Kernel } from '@/kernel/kernel'
import type { Module } from '@/kernel/modules'

/**
 * Module registration seams. `main.ts` calls these after the kernel is built; the
 * lists are empty in Phase 2 and fill in later phases:
 *   - core modules (notifications, dialogs, command-palette) — Phases 4+
 *   - feature modules (explorer, search, graph, editor, …)   — Phases 6+
 * Registration is cheap and synchronous; heavy work happens lazily in `setup`.
 */

const coreModules: Module[] = []

const featureModules: Module[] = []

export function registerCoreModules(kernel: Kernel): void {
  for (const mod of coreModules) kernel.modules.register(mod)
}

export function registerFeatureModules(kernel: Kernel): void {
  for (const mod of featureModules) kernel.modules.register(mod)
}
