import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createModuleRegistry, type Module } from '@/kernel/modules'
import { createEventBus } from '@/kernel/events'
import { createCommandRegistry } from '@/kernel/commands'
import { useContextStore } from '@/kernel/context'
import { createKeymapManager } from '@/kernel/keymap/manager'
import {
  createContributionRegistry,
  createDataStub,
  createDialogStub,
  createNotifyStub,
} from '@/kernel/stubs'

function makeDeps() {
  const context = useContextStore()
  const commands = createCommandRegistry(() => context.snapshot())
  return {
    events: createEventBus(),
    commands,
    keymap: createKeymapManager({ commands, getContext: () => context.snapshot() }),
    contributions: createContributionRegistry(),
    notify: createNotifyStub(),
    dialog: createDialogStub(),
    data: createDataStub(),
    context,
  }
}

describe('module registry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sets up modules in dependency order', async () => {
    const order: string[] = []
    const mk = (id: string, dependsOn?: string[]): Module => ({
      id,
      dependsOn,
      setup: () => {
        order.push(id)
      },
    })
    const reg = createModuleRegistry(makeDeps())
    reg.register(mk('b', ['a']))
    reg.register(mk('a'))
    reg.register(mk('c', ['b']))
    await reg.setupAll()
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('throws on a circular dependency', async () => {
    const reg = createModuleRegistry(makeDeps())
    reg.register({ id: 'x', dependsOn: ['y'], setup: () => {} })
    reg.register({ id: 'y', dependsOn: ['x'], setup: () => {} })
    await expect(reg.setupAll()).rejects.toThrow(/circular/i)
  })

  it('throws on an unknown dependency', async () => {
    const reg = createModuleRegistry(makeDeps())
    reg.register({ id: 'x', dependsOn: ['ghost'], setup: () => {} })
    await expect(reg.setupAll()).rejects.toThrow(/unknown/i)
  })

  it('auto-unwinds context registrations on dispose', async () => {
    const deps = makeDeps()
    const reg = createModuleRegistry(deps)
    reg.register({
      id: 'm',
      setup: (ctx) => {
        ctx.commands.register({ id: 'm.cmd', title: 'M', run: () => {} })
        ctx.contributions.register({ id: 'm.view', kind: 'view' })
      },
    })
    await reg.setupAll()
    expect(deps.commands.get('m.cmd')).toBeDefined()
    expect(deps.contributions.list('view')).toHaveLength(1)

    await reg.disposeAll()
    expect(deps.commands.get('m.cmd')).toBeUndefined()
    expect(deps.contributions.list('view')).toHaveLength(0)
  })

  it('calls each module dispose hook', async () => {
    const disposed = vi.fn()
    const reg = createModuleRegistry(makeDeps())
    reg.register({ id: 'm', setup: () => {}, dispose: disposed })
    await reg.setupAll()
    await reg.disposeAll()
    expect(disposed).toHaveBeenCalledOnce()
  })
})
