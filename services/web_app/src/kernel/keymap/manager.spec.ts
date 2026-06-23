import { describe, it, expect, vi } from 'vitest'
import { createKeymapManager } from '@/kernel/keymap/manager'
import type { CommandContext } from '@/kernel/commands'

/** Dispatch a synthetic keydown carrying the fields the chord parser reads. */
function dispatchKey(
  target: EventTarget,
  init: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean },
) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function setup(context: CommandContext = {}) {
  const execute = vi.fn(() => Promise.resolve())
  const warn = vi.fn()
  const km = createKeymapManager({
    commands: { execute },
    getContext: () => context,
    isMac: false,
    warn,
  })
  const target = new EventTarget()
  const detach = km.attach(target)
  return { km, execute, warn, target, detach }
}

describe('keymap manager', () => {
  it('runs the bound command and prevents default on match', () => {
    const { km, execute, target } = setup()
    km.add({ id: 'b1', keys: 'Mod+P', command: 'palette.open' })
    const event = dispatchKey(target, { key: 'p', ctrlKey: true })
    expect(execute).toHaveBeenCalledWith('palette.open')
    expect(event.defaultPrevented).toBe(true)
  })

  it('respects preventDefault: false', () => {
    const { km, execute, target } = setup()
    km.add({ id: 'b1', keys: 'Mod+P', command: 'c', preventDefault: false })
    const event = dispatchKey(target, { key: 'p', ctrlKey: true })
    expect(execute).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(false)
  })

  it('remove() unbinds', () => {
    const { km, execute, target } = setup()
    const off = km.add({ id: 'b1', keys: 'Mod+P', command: 'c' })
    off()
    dispatchKey(target, { key: 'p', ctrlKey: true })
    expect(execute).not.toHaveBeenCalled()
  })

  it('detach() stops listening', () => {
    const { km, execute, target, detach } = setup()
    km.add({ id: 'b1', keys: 'Mod+P', command: 'c' })
    detach()
    dispatchKey(target, { key: 'p', ctrlKey: true })
    expect(execute).not.toHaveBeenCalled()
  })

  it('gates on a string when-scope against live context', () => {
    const ctx: CommandContext = { paletteOpen: false }
    const { km, execute, target } = setup(ctx)
    km.add({ id: 'b1', keys: 'Enter', command: 'palette.accept', when: 'paletteOpen' })

    dispatchKey(target, { key: 'Enter' })
    expect(execute).not.toHaveBeenCalled()

    ctx.paletteOpen = true
    dispatchKey(target, { key: 'Enter' })
    expect(execute).toHaveBeenCalledWith('palette.accept')
  })

  it('gates on a function when-scope', () => {
    const ctx: CommandContext = { editorFocused: true }
    const { km, execute, target } = setup(ctx)
    km.add({ id: 'b1', keys: 'Mod+B', command: 'editor.bold', when: (c) => Boolean(c.editorFocused) })
    dispatchKey(target, { key: 'b', ctrlKey: true })
    expect(execute).toHaveBeenCalledWith('editor.bold')
  })

  it('last-registered wins on a conflict, and warns', () => {
    const { km, execute, warn, target } = setup()
    km.add({ id: 'first', keys: 'Mod+K', command: 'cmd.first' })
    km.add({ id: 'second', keys: 'Mod+K', command: 'cmd.second' })
    expect(warn).toHaveBeenCalledOnce()

    dispatchKey(target, { key: 'k', ctrlKey: true })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('cmd.second')
  })

  it('a user override beats the default; null unbinds', () => {
    const { km, execute, target } = setup()
    km.add({ id: 'b1', keys: 'Mod+P', command: 'palette.open' })

    km.setUserBinding('palette.open', 'Mod+J')
    dispatchKey(target, { key: 'p', ctrlKey: true })
    expect(execute).not.toHaveBeenCalled() // the default no longer fires
    dispatchKey(target, { key: 'j', ctrlKey: true })
    expect(execute).toHaveBeenCalledWith('palette.open')

    execute.mockClear()
    km.setUserBinding('palette.open', null)
    dispatchKey(target, { key: 'j', ctrlKey: true })
    expect(execute).not.toHaveBeenCalled()
  })

  it('list() reflects overrides', () => {
    const { km } = setup()
    km.add({ id: 'b1', keys: 'Mod+P', command: 'palette.open' })

    km.setUserBinding('palette.open', 'Mod+J')
    expect(km.list()).toEqual([{ id: 'b1', keys: 'Mod+J', command: 'palette.open' }])

    km.setUserBinding('palette.open', null)
    expect(km.list()).toEqual([])
  })
})
