/**
 * The keymap: one binding table and one (host-attached) keyboard listener that turn
 * keypresses into command executions. Bindings reference command *ids* — the manager
 * never holds inline behavior — so the same action can be triggered by a key, a
 * button, or a remapped chord, and a settings screen is just a view over `list()`.
 *
 * Per §6.4 the listener is NOT auto-wired: the kernel builds the manager, but a host
 * (the shell/design) calls `attach(window)` to start listening. A keyboard-less host
 * simply never does.
 */

import type { CommandContext, CommandRegistry } from '@/kernel/commands'
import {
  detectMac,
  eventToChord,
  normalizeChord,
  MODIFIER_KEY_NAMES,
  type KeyboardEventLike,
} from '@/kernel/keymap/chord'

export interface Keybinding {
  id: string
  keys: string // canonical chord, e.g. 'Mod+P', 'Mod+Shift+F'
  command: string // command id to execute on match
  when?: string | ((ctx: CommandContext) => boolean) // scope predicate
  preventDefault?: boolean // default true on match
}

export interface KeymapManager {
  add(binding: Keybinding): () => void // returns remove
  remove(id: string): void
  /** current effective bindings (defaults overlaid with user overrides) */
  list(): Keybinding[]
  /** user override; `null` unbinds the command's default. In-memory until persisted. */
  setUserBinding(commandId: string, keys: string | null): void
  /** host-activated: wire a capture-phase keydown listener; returns a detach fn. */
  attach(target: EventTarget): () => void
}

interface KeymapDeps {
  commands: Pick<CommandRegistry, 'execute'>
  getContext: () => CommandContext
  isMac?: boolean
  /** dev-time conflict warnings; defaults to a DEV-gated console.warn. */
  warn?: (message: string) => void
}

type KeydownLike = KeyboardEventLike & Pick<Event, 'preventDefault'>

// Conflicts are only comparable when both scopes are plain strings (or both absent);
// function predicates are opaque, so we don't warn on those.
function sameScope(a: Keybinding['when'], b: Keybinding['when']): boolean {
  if (a == null && b == null) return true
  return typeof a === 'string' && typeof b === 'string' && a === b
}

export function createKeymapManager(deps: KeymapDeps): KeymapManager {
  const isMac = deps.isMac ?? detectMac()
  const warn =
    deps.warn ??
    ((message: string) => {
      if (import.meta.env.DEV) console.warn(message)
    })

  // Insertion order matters: among equal matches the last-registered binding wins.
  const bindings = new Map<string, Keybinding>()
  const userBindings = new Map<string, string | null>()

  /** Effective canonical chord for a binding, or null if the user unbound it. */
  function effectiveChord(b: Keybinding): string | null {
    const override = userBindings.get(b.command) // undefined ⇒ no override
    const keys = override === undefined ? b.keys : override
    return keys === null ? null : normalizeChord(keys, isMac)
  }

  function passes(b: Keybinding, ctx: CommandContext): boolean {
    const when = b.when
    if (when == null) return true
    if (typeof when === 'function') return when(ctx)
    const token = when.trim()
    return token.startsWith('!') ? !ctx[token.slice(1).trim()] : Boolean(ctx[token])
  }

  /** Last-registered binding whose effective chord equals `chord` and whose scope passes. */
  function exactWinner(chord: string, ctx: CommandContext): Keybinding | undefined {
    let winner: Keybinding | undefined
    for (const b of bindings.values()) {
      if (effectiveChord(b) === chord && passes(b, ctx)) winner = b
    }
    return winner
  }

  function handleKeydown(e: KeydownLike): void {
    if (MODIFIER_KEY_NAMES.has(e.key)) return // ignore bare modifier presses
    const winner = exactWinner(eventToChord(e, isMac), deps.getContext())
    if (!winner) return
    if (winner.preventDefault !== false) e.preventDefault()
    void deps.commands.execute(winner.command)
  }

  return {
    add(binding) {
      const incoming = normalizeChord(binding.keys, isMac)
      for (const existing of bindings.values()) {
        if (existing.id === binding.id) continue
        if (normalizeChord(existing.keys, isMac) === incoming && sameScope(existing.when, binding.when)) {
          warn(`Keybinding conflict on "${incoming}": "${existing.id}" superseded by "${binding.id}".`)
          break
        }
      }
      bindings.set(binding.id, binding)
      return () => {
        bindings.delete(binding.id)
      }
    },
    remove(id) {
      bindings.delete(id)
    },
    list() {
      const result: Keybinding[] = []
      for (const b of bindings.values()) {
        const override = userBindings.get(b.command) // undefined ⇒ no override
        if (override === undefined) result.push(b)
        else if (override !== null) result.push({ ...b, keys: override })
        // override === null ⇒ unbound, omit from the effective view
      }
      return result
    },
    setUserBinding(commandId, keys) {
      userBindings.set(commandId, keys)
    },
    attach(target) {
      const handler = (e: Event) => handleKeydown(e as KeyboardEvent)
      target.addEventListener('keydown', handler, { capture: true })
      return () => target.removeEventListener('keydown', handler, { capture: true })
    },
  }
}
