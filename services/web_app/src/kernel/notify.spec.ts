import { describe, it, expect } from 'vitest'
import { createNotificationService } from '@/kernel/notify'

describe('notification service', () => {
  it('enqueues with level and message and returns a dismiss handle', () => {
    const svc = createNotificationService()
    const handle = svc.info('hello')
    expect(svc.queue).toHaveLength(1)
    expect(svc.queue[0]).toMatchObject({ level: 'info', message: 'hello' })
    handle.dismiss()
    expect(svc.queue).toHaveLength(0)
  })

  it('uses the right level per method', () => {
    const svc = createNotificationService()
    svc.info('i')
    svc.success('s')
    svc.warn('w')
    svc.error('e')
    expect(svc.queue.map((n) => n.level)).toEqual(['info', 'success', 'warn', 'error'])
  })

  it('dismiss(id) removes a specific notification', () => {
    const svc = createNotificationService()
    svc.success('a')
    svc.error('b')
    svc.dismiss(svc.queue[0].id)
    expect(svc.queue.map((n) => n.message)).toEqual(['b'])
  })

  it('clear() empties the queue', () => {
    const svc = createNotificationService()
    svc.info('a')
    svc.warn('b')
    svc.clear()
    expect(svc.queue).toHaveLength(0)
  })
})
