import { describe, it, expect, vi } from 'vitest'
import { createCommandRegistry, type CommandContext } from '@/kernel/commands'

function registryWith(initial: CommandContext = {}) {
  let context = initial
  const reg = createCommandRegistry(() => context)
  return { reg, setContext: (c: CommandContext) => (context = c) }
}

describe('command registry', () => {
  it('registers, gets, and executes a command', async () => {
    const { reg } = registryWith()
    const run = vi.fn()
    reg.register({ id: 'rune.create', title: 'Create Rune', run })
    expect(reg.get('rune.create')?.title).toBe('Create Rune')
    await reg.execute('rune.create')
    expect(run).toHaveBeenCalledOnce()
  })

  it('unregister removes the command', () => {
    const { reg } = registryWith()
    const off = reg.register({ id: 'x', title: 'X', run: () => {} })
    off()
    expect(reg.get('x')).toBeUndefined()
  })

  it('rejects executing an unknown or disabled command', async () => {
    const { reg } = registryWith({ ready: false })
    reg.register({ id: 'gated', title: 'Gated', isEnabled: (c) => c.ready === true, run: () => {} })
    await expect(reg.execute('nope')).rejects.toThrow(/unknown/i)
    await expect(reg.execute('gated')).rejects.toThrow(/disabled/i)
  })

  it('list filters by category and by enabledOnly (reading live context)', () => {
    const { reg, setContext } = registryWith({ ready: true })
    reg.register({ id: 'a', title: 'A', category: 'Codex', run: () => {} })
    reg.register({
      id: 'b',
      title: 'B',
      category: 'Editor',
      isEnabled: (c) => c.ready === true,
      run: () => {},
    })
    reg.register({ id: 'c', title: 'C', category: 'Editor', isVisible: () => false, run: () => {} })

    expect(reg.list({ category: 'Editor' }).map((c) => c.id)).toEqual(['b', 'c'])
    // a: no gates → shown; b: enabled (ready); c: isVisible false → hidden
    expect(reg.list({ enabledOnly: true }).map((c) => c.id)).toEqual(['a', 'b'])

    setContext({ ready: false })
    // b now disabled → only a remains
    expect(reg.list({ enabledOnly: true }).map((c) => c.id)).toEqual(['a'])
  })
})
