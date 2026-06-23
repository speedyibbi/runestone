import { inject, type App, type InjectionKey } from 'vue'

import { useContextStore } from '@/kernel/context'
import { createEventBus, type EventBus } from '@/kernel/events'
import { createCommandRegistry, type CommandRegistry } from '@/kernel/commands'
import { createModuleRegistry, type ModuleRegistry } from '@/kernel/modules'
import { createKeymapManager, type KeymapManager } from '@/kernel/keymap/manager'
import {
  createContributionRegistry,
  createDataStub,
  createDialogStub,
  createNotifyStub,
  type ContributionRegistry,
} from '@/kernel/stubs'

/**
 * The kernel: a plain object created once, provided app-wide via provide/inject
 * and also importable for non-component code (e.g. router guards). It assumes only
 * commands + events + data — nothing presentational.
 */
export interface Kernel {
  modules: ModuleRegistry
  events: EventBus
  commands: CommandRegistry
  keymap: KeymapManager // optional capability; host attaches the listener (later phase)
  contributions: ContributionRegistry
  notify: ReturnType<typeof createNotifyStub> // optional host capability (Phase 4)
  dialog: ReturnType<typeof createDialogStub> // optional host capability (Phase 4)
  context: ReturnType<typeof useContextStore>
  data: ReturnType<typeof createDataStub> // real session facade in Phase 5
  /** Vue plugin hook so `app.use(kernel)` provides it app-wide. */
  install(app: App): void
}

export const KERNEL_KEY: InjectionKey<Kernel> = Symbol('runestone-kernel')

let current: Kernel | null = null

export function createKernel(): Kernel {
  // Pinia must already be active (main.ts calls app.use(createPinia()) first).
  const context = useContextStore()
  const events = createEventBus()
  const commands = createCommandRegistry(() => context.snapshot())
  const contributions = createContributionRegistry()
  const keymap = createKeymapManager({ commands, getContext: () => context.snapshot() })
  const notify = createNotifyStub()
  const dialog = createDialogStub()
  const data = createDataStub()

  const modules = createModuleRegistry({
    events,
    commands,
    keymap,
    contributions,
    notify,
    dialog,
    data,
    context,
  })

  const kernel: Kernel = {
    modules,
    events,
    commands,
    keymap,
    contributions,
    notify,
    dialog,
    context,
    data,
    install(app) {
      app.provide(KERNEL_KEY, kernel)
    },
  }

  current = kernel
  return kernel
}

/** Importable handle for non-component code (e.g. router guards). */
export function getKernel(): Kernel {
  if (!current) {
    throw new Error('Kernel not created yet — call createKernel() in main.ts first')
  }
  return current
}

/** Inject the kernel inside a component `setup`. */
export function useKernel(): Kernel {
  const kernel = inject(KERNEL_KEY)
  if (!kernel) {
    throw new Error('Kernel not provided — did you call app.use(kernel)?')
  }
  return kernel
}
