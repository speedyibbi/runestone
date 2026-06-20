import { describe, it, expect } from 'vitest'
import { computed } from 'vue'
import { createContributionRegistry } from '@/kernel/stubs'

describe('contribution registry', () => {
  it('registers and lists, optionally filtering by kind', () => {
    const reg = createContributionRegistry()
    reg.register({ id: 'v1', kind: 'view', payload: { name: 'A' } })
    reg.register({ id: 'a1', kind: 'action' })
    expect(reg.list()).toHaveLength(2)
    expect(reg.list('view').map((c) => c.id)).toEqual(['v1'])
    expect(reg.list('action').map((c) => c.id)).toEqual(['a1'])
  })

  it('unregister removes the contribution', () => {
    const reg = createContributionRegistry()
    const off = reg.register({ id: 'v1', kind: 'view' })
    off()
    expect(reg.list()).toHaveLength(0)
  })

  it('list is reactive to register / unregister', () => {
    const reg = createContributionRegistry()
    const views = computed(() => reg.list('view'))
    expect(views.value).toHaveLength(0)
    const off = reg.register({ id: 'v1', kind: 'view' })
    expect(views.value).toHaveLength(1)
    off()
    expect(views.value).toHaveLength(0)
  })
})
