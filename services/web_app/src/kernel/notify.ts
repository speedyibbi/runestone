/**
 * Notification service: a programmatic, headless way for modules to signal the user
 * without owning a toast/banner component. It is just a reactive queue of plain
 * descriptors — the design (or the dev scaffold) renders it however it likes, and a
 * headless host could route the queue to logs instead. The kernel never assumes it
 * is rendered.
 */

import { reactive } from 'vue'

export type NotificationLevel = 'info' | 'success' | 'warn' | 'error'

export interface Notification {
  id: string
  level: NotificationLevel
  message: string
}

export interface DismissHandle {
  dismiss(): void
}

export interface NotificationService {
  /** reactive queue the host renders (toasts, banners, …) */
  queue: Notification[]
  info(message: string): DismissHandle
  success(message: string): DismissHandle
  warn(message: string): DismissHandle
  error(message: string): DismissHandle
  /** remove one notification by id (e.g. from a rendered dismiss button) */
  dismiss(id: string): void
  /** drop every queued notification */
  clear(): void
}

export function createNotificationService(): NotificationService {
  const queue = reactive<Notification[]>([])
  let seq = 0

  function dismiss(id: string) {
    const i = queue.findIndex((n) => n.id === id)
    if (i !== -1) queue.splice(i, 1)
  }

  function push(level: NotificationLevel, message: string): DismissHandle {
    const id = `n${++seq}`
    queue.push({ id, level, message })
    return { dismiss: () => dismiss(id) }
  }

  return {
    queue,
    info: (message) => push('info', message),
    success: (message) => push('success', message),
    warn: (message) => push('warn', message),
    error: (message) => push('error', message),
    dismiss,
    clear: () => {
      queue.splice(0)
    },
  }
}
