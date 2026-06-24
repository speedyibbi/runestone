/**
 * Dialog service: programmatic modals without modules owning a modal component.
 * `confirm`/`prompt` return promises that settle when the host resolves the matching
 * request; `open` mounts arbitrary component content. Backed by a reactive stack of
 * plain descriptors — the design (or the dev scaffold) renders it, and a headless
 * host could auto-resolve. The kernel never assumes it is rendered.
 */

import { reactive, markRaw, type Component } from 'vue'

export interface ConfirmOptions {
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
}

export interface PromptOptions {
  message: string
  title?: string
  defaultValue?: string
  placeholder?: string
}

interface ConfirmRequest {
  id: string
  kind: 'confirm'
  options: ConfirmOptions
  resolve(value: boolean): void
}

interface PromptRequest {
  id: string
  kind: 'prompt'
  options: PromptOptions
  resolve(value: string | null): void
}

interface OpenRequest {
  id: string
  kind: 'open'
  component: Component
  props?: Record<string, unknown>
  resolve(): void
}

export type DialogRequest = ConfirmRequest | PromptRequest | OpenRequest

export interface DialogHandle {
  close(): void
}

export interface DialogService {
  /** reactive stack the host renders (last entry = most recent) */
  stack: DialogRequest[]
  confirm(options: ConfirmOptions): Promise<boolean>
  prompt(options: PromptOptions): Promise<string | null>
  open(component: Component, props?: Record<string, unknown>): DialogHandle
}

export function createDialogService(): DialogService {
  const stack = reactive<DialogRequest[]>([])
  let seq = 0

  function remove(id: string) {
    const i = stack.findIndex((d) => d.id === id)
    if (i !== -1) stack.splice(i, 1)
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    const id = `d${++seq}`
    return new Promise<boolean>((settle) => {
      stack.push({
        id,
        kind: 'confirm',
        options,
        resolve: (value: boolean) => {
          remove(id)
          settle(value)
        },
      })
    })
  }

  function prompt(options: PromptOptions): Promise<string | null> {
    const id = `d${++seq}`
    return new Promise<string | null>((settle) => {
      stack.push({
        id,
        kind: 'prompt',
        options,
        resolve: (value: string | null) => {
          remove(id)
          settle(value)
        },
      })
    })
  }

  function open(component: Component, props?: Record<string, unknown>): DialogHandle {
    const id = `d${++seq}`
    stack.push({ id, kind: 'open', component: markRaw(component), props, resolve: () => remove(id) })
    return { close: () => remove(id) }
  }

  return { stack, confirm, prompt, open }
}
