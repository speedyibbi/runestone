import type { CommandRegistry } from '@/kernel/commands'
import type { EventBus, EventKey, AppEvents } from '@/kernel/events'
import type { useContextStore } from '@/kernel/context'
import {
  createDataStub,
  createDialogStub,
  createKeymapStub,
  createNotifyStub,
  type ContributionRegistry,
} from '@/kernel/stubs'

export interface Module {
  id: string
  dependsOn?: string[]
  setup(ctx: ModuleContext): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface ModuleContext {
  events: EventBus
  commands: CommandRegistry
  keymap: ReturnType<typeof createKeymapStub>
  contributions: ContributionRegistry
  notify: ReturnType<typeof createNotifyStub>
  dialog: ReturnType<typeof createDialogStub>
  data: ReturnType<typeof createDataStub>
  context: ReturnType<typeof useContextStore>
  subscribe: <K extends EventKey>(event: K, cb: (payload: AppEvents[K]) => void) => void
  onDispose: (fn: () => void) => void
}

export interface ModuleRegistry {
  register(module: Module): void
  setupAll(): Promise<void>
  disposeAll(): Promise<void>
  get(id: string): Module | undefined
}

interface ModuleRegistryDeps {
  events: EventBus
  commands: CommandRegistry
  keymap: ReturnType<typeof createKeymapStub>
  contributions: ContributionRegistry
  notify: ReturnType<typeof createNotifyStub>
  dialog: ReturnType<typeof createDialogStub>
  data: ReturnType<typeof createDataStub>
  context: ReturnType<typeof useContextStore>
}

function topoSort(modules: Module[]): Module[] {
  const byId = new Map(modules.map((m) => [m.id, m]))
  const sorted: Module[] = []
  const done = new Set<string>()

  function visit(id: string, stack: Set<string>) {
    if (done.has(id)) return
    if (stack.has(id)) throw new Error(`Circular module dependency: ${id}`)
    const mod = byId.get(id)
    if (!mod) throw new Error(`Unknown module dependency: ${id}`)
    stack.add(id)
    for (const dep of mod.dependsOn ?? []) visit(dep, stack)
    stack.delete(id)
    done.add(id)
    sorted.push(mod)
  }

  for (const mod of modules) visit(mod.id, new Set())
  return sorted
}

function track(cleanup: (() => void)[], fn: () => void) {
  cleanup.push(fn)
}

function createContext(deps: ModuleRegistryDeps, cleanup: (() => void)[]): ModuleContext {
  return {
    events: deps.events,
    commands: {
      register(cmd) {
        const off = deps.commands.register(cmd)
        track(cleanup, off)
        return off
      },
      execute: deps.commands.execute.bind(deps.commands),
      get: deps.commands.get.bind(deps.commands),
      list: deps.commands.list.bind(deps.commands),
    },
    keymap: {
      add(binding) {
        const off = deps.keymap.add(binding)
        track(cleanup, off)
        return off
      },
      remove: deps.keymap.remove.bind(deps.keymap),
      list: deps.keymap.list.bind(deps.keymap),
      setUserBinding: deps.keymap.setUserBinding.bind(deps.keymap),
    },
    contributions: {
      register(item) {
        const off = deps.contributions.register(item)
        track(cleanup, off)
        return off
      },
      list: deps.contributions.list.bind(deps.contributions),
    },
    data: deps.data,
    notify: deps.notify,
    dialog: deps.dialog,
    context: deps.context,
    subscribe(event, cb) {
      track(cleanup, deps.events.on(event, cb))
    },
    onDispose(fn) {
      track(cleanup, fn)
    },
  }
}

export function createModuleRegistry(deps: ModuleRegistryDeps): ModuleRegistry {
  const pending: Module[] = []
  const loaded = new Map<string, Module>()
  const cleanups = new Map<string, (() => void)[]>()

  return {
    register(module) {
      pending.push(module)
    },
    async setupAll() {
      for (const mod of topoSort(pending)) {
        const cleanup: (() => void)[] = []
        await mod.setup(createContext(deps, cleanup))
        cleanups.set(mod.id, cleanup)
        loaded.set(mod.id, mod)
      }
    },
    async disposeAll() {
      for (const mod of [...loaded.values()].reverse()) {
        cleanups.get(mod.id)?.forEach((fn) => fn())
        cleanups.delete(mod.id)
        await mod.dispose?.()
        loaded.delete(mod.id)
      }
    },
    get(id) {
      return loaded.get(id)
    },
  }
}
