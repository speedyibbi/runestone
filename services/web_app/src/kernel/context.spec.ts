import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContextStore } from '@/kernel/context'

describe('context store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('round-trips a key through set/get', () => {
    const ctx = useContextStore()
    ctx.set('hasOpenCodex', true)
    expect(ctx.get('hasOpenCodex')).toBe(true)
  })

  it('snapshot returns a detached point-in-time copy', () => {
    const ctx = useContextStore()
    ctx.set('a', 1)
    const snap = ctx.snapshot()
    ctx.set('a', 2)
    expect(snap.a).toBe(1)
    expect(ctx.get('a')).toBe(2)
  })
})
