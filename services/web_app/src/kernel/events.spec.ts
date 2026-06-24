import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '@/kernel/events'

describe('event bus', () => {
  it('delivers emitted payloads to subscribers', () => {
    const bus = createEventBus()
    const seen: string[] = []
    bus.on('rune:created', (p) => seen.push(p.title))
    bus.emit('rune:created', { uuid: 'a', title: 'Alpha' })
    expect(seen).toEqual(['Alpha'])
  })

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus()
    const fn = vi.fn()
    const off = bus.on('rune:deleted', fn)
    bus.emit('rune:deleted', { uuid: 'a' })
    off()
    bus.emit('rune:deleted', { uuid: 'b' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('once fires at most once', () => {
    const bus = createEventBus()
    const fn = vi.fn()
    bus.once('codex:closed', fn)
    bus.emit('codex:closed', { codexId: 'x' })
    bus.emit('codex:closed', { codexId: 'x' })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('isolates handlers across event keys', () => {
    const bus = createEventBus()
    const onCreate = vi.fn()
    bus.on('rune:created', onCreate)
    bus.emit('rune:deleted', { uuid: 'a' })
    expect(onCreate).not.toHaveBeenCalled()
  })
})
