import { reactive } from 'vue'
import { defineStore } from 'pinia'
import type { CommandContext } from '@/kernel/commands'

/**
 * Kernel context-key store. Holds an open bag of reactive "context keys" that
 * gate commands (`isEnabled` / `isVisible`) and, later, keymap `when` predicates.
 *
 * The kernel defines NO key names. Owners write their own keys: the session
 * facade sets domain keys (`hasOpenCodex`, …), feature modules set feature keys
 * (`editor.focused`, `palette.open`, …), and a design may set design-specific
 * states. Document / editor session state (open runes, active rune, editor mode)
 * is editor-feature state and lives in the editor module — not here.
 */
export const useContextStore = defineStore('kernel-context', () => {
  const keys = reactive<Record<string, unknown>>({})

  function set(key: string, value: unknown): void {
    keys[key] = value
  }

  function get(key: string): unknown {
    return keys[key]
  }

  function snapshot(): CommandContext {
    return { ...keys }
  }

  return { keys, set, get, snapshot }
})
