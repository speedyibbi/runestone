/**
 * Pure keyboard-chord normalization for the keymap. Every function here is
 * deterministic and DOM-free: the platform is passed in (never read from a global)
 * and events are read through a minimal {@link KeyboardEventLike} shape, so the
 * whole module is trivially unit-testable.
 *
 * A *chord* is one canonical keypress string like `Mod+Shift+P`, where `Mod` means
 * Cmd on macOS and Ctrl elsewhere.
 */

/** The subset of a `KeyboardEvent` the chord parser reads. */
export interface KeyboardEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** True on macOS, where `Mod` resolves to Cmd (Meta) rather than Ctrl. Safe in Node. */
export function detectMac(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
}

// Canonical modifier order, so `Shift+Mod+P` and `Mod+Shift+P` collapse to one string.
const MOD_RANK: Record<string, number> = { Mod: 0, Ctrl: 1, Meta: 2, Alt: 3, Shift: 4 }

// Non-letter key aliases so declared bindings read naturally ('Mod+Space', 'Mod+Up').
const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  spacebar: 'Space',
  esc: 'Escape',
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
}

/** Key names that are modifiers themselves — a bare press of one is not a chord. */
export const MODIFIER_KEY_NAMES = new Set(['Shift', 'Control', 'Alt', 'Meta'])

/** Canonicalize a single key name: known aliases first, then upper-case single letters. */
function normalizeKey(key: string): string {
  const alias = KEY_ALIASES[key.toLowerCase()]
  if (alias) return alias
  return key.length === 1 ? key.toUpperCase() : key
}

/** Map a declared modifier token to its canonical name, honoring the platform. */
function normalizeModifier(part: string, isMac: boolean): string | null {
  switch (part.toLowerCase()) {
    case 'mod':
      return 'Mod'
    case 'cmd':
    case 'command':
    case 'meta':
    case 'super':
      return isMac ? 'Mod' : 'Meta'
    case 'ctrl':
    case 'control':
      return isMac ? 'Ctrl' : 'Mod'
    case 'alt':
    case 'option':
      return 'Alt'
    case 'shift':
      return 'Shift'
    default:
      return null
  }
}

function canonical(mods: string[], key: string): string {
  const ordered = [...new Set(mods)].sort((a, b) => (MOD_RANK[a] ?? 99) - (MOD_RANK[b] ?? 99))
  return key ? [...ordered, key].join('+') : ordered.join('+')
}

/** One keypress event → its canonical chord string. */
export function eventToChord(e: KeyboardEventLike, isMac: boolean): string {
  const mods: string[] = []
  if (isMac) {
    if (e.metaKey) mods.push('Mod')
    if (e.ctrlKey) mods.push('Ctrl')
  } else {
    if (e.ctrlKey) mods.push('Mod')
    if (e.metaKey) mods.push('Meta')
  }
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')

  const key = MODIFIER_KEY_NAMES.has(e.key) ? '' : normalizeKey(e.key)
  return canonical(mods, key)
}

/** Parse one declared chord token (`'Mod+Shift+P'`) into its canonical form. */
/** Parse a declared binding (`'Mod+Shift+P'`) into its canonical chord string. */
export function normalizeChord(keys: string, isMac: boolean): string {
  const mods: string[] = []
  let key = ''
  for (const raw of keys.split('+').map((p) => p.trim()).filter(Boolean)) {
    const mod = normalizeModifier(raw, isMac)
    if (mod) mods.push(mod)
    else key = normalizeKey(raw)
  }
  return canonical(mods, key)
}
