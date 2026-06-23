import { describe, it, expect } from 'vitest'
import { eventToChord, normalizeChord, type KeyboardEventLike } from '@/kernel/keymap/chord'

function key(partial: Partial<KeyboardEventLike> & { key: string }): KeyboardEventLike {
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...partial }
}

describe('eventToChord', () => {
  it('maps Mod to Cmd on mac and Ctrl elsewhere', () => {
    expect(eventToChord(key({ key: 'p', metaKey: true }), true)).toBe('Mod+P')
    expect(eventToChord(key({ key: 'p', ctrlKey: true }), false)).toBe('Mod+P')
  })

  it('treats the non-Mod primary modifier as a literal Ctrl/Meta', () => {
    expect(eventToChord(key({ key: 'p', ctrlKey: true }), true)).toBe('Ctrl+P') // mac: Ctrl isn't Mod
    expect(eventToChord(key({ key: 'p', metaKey: true }), false)).toBe('Meta+P') // win: Meta isn't Mod
  })

  it('canonicalizes modifier order', () => {
    const e = key({ key: 'F', metaKey: true, altKey: true, shiftKey: true })
    expect(eventToChord(e, true)).toBe('Mod+Alt+Shift+F')
  })

  it('normalizes edge keys', () => {
    expect(eventToChord(key({ key: ' ' }), false)).toBe('Space')
    expect(eventToChord(key({ key: 'ArrowUp', shiftKey: true }), false)).toBe('Shift+Up')
  })

  it('drops the base key for a bare modifier press', () => {
    expect(eventToChord(key({ key: 'Shift', shiftKey: true }), false)).toBe('Shift')
  })
})

describe('normalizeChord', () => {
  it('canonicalizes a declared combo regardless of order or case', () => {
    expect(normalizeChord('shift+mod+f', true)).toBe('Mod+Shift+F')
  })

  it('resolves Ctrl/Cmd per platform', () => {
    expect(normalizeChord('Ctrl+P', false)).toBe('Mod+P') // non-mac: Ctrl is Mod
    expect(normalizeChord('Cmd+P', true)).toBe('Mod+P') // mac: Cmd is Mod
    expect(normalizeChord('Ctrl+P', true)).toBe('Ctrl+P') // mac: Ctrl stays literal
  })
})
