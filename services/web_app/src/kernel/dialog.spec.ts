import { describe, it, expect } from 'vitest'
import type { Component } from 'vue'
import { createDialogService } from '@/kernel/dialog'

describe('dialog service', () => {
  it('confirm resolves true via the request resolve and pops the stack', async () => {
    const svc = createDialogService()
    const p = svc.confirm({ message: 'ok?' })
    expect(svc.stack).toHaveLength(1)
    const req = svc.stack[0]
    if (req.kind === 'confirm') req.resolve(true)
    await expect(p).resolves.toBe(true)
    expect(svc.stack).toHaveLength(0)
  })

  it('confirm can resolve false', async () => {
    const svc = createDialogService()
    const p = svc.confirm({ message: 'ok?' })
    const req = svc.stack[0]
    if (req.kind === 'confirm') req.resolve(false)
    await expect(p).resolves.toBe(false)
  })

  it('prompt resolves a value or null', async () => {
    const svc = createDialogService()
    const p1 = svc.prompt({ message: 'name?' })
    const r1 = svc.stack[0]
    if (r1.kind === 'prompt') r1.resolve('bob')
    await expect(p1).resolves.toBe('bob')

    const p2 = svc.prompt({ message: 'name?' })
    const r2 = svc.stack[0]
    if (r2.kind === 'prompt') r2.resolve(null)
    await expect(p2).resolves.toBeNull()
  })

  it('open pushes a request and the handle closes it', () => {
    const svc = createDialogService()
    const handle = svc.open({} as Component)
    expect(svc.stack).toHaveLength(1)
    expect(svc.stack[0].kind).toBe('open')
    handle.close()
    expect(svc.stack).toHaveLength(0)
  })
})
