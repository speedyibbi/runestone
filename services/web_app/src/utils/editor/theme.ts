import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * Minimal, sleek editor theme that uses CSS variables from global.css
 */
export const minimalTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--color-foreground)',
      backgroundColor: 'var(--color-background)',
      fontFamily: 'var(--font-primary)',
      fontSize: '1rem',
      height: '100%',
    },

    '.cm-content': {
      caretColor: 'var(--color-foreground)',
      padding: '2rem',
    },

    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--color-foreground)',
      borderLeftWidth: '2px',
    },

    '&.cm-focused': {
      outline: 'none',
    },

    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-selection-focused)',
    },

    '.cm-selectionBackground': {
      backgroundColor: 'var(--color-selection)',
    },

    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },

    '.cm-gutters': {
      display: 'none', // No line numbers
    },

    '.cm-line': {
      padding: '0',
      lineHeight: '1.6',
    },

    '.cm-scroller': {
      fontFamily: 'var(--font-primary)',
      lineHeight: '1.6',
    },

    // Code blocks
    '.cm-line .tok-monospace': {
      fontFamily: 'var(--font-code)',
    },

    // Search panel styling
    '.cm-panel': {
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-foreground)',
      border: '1px solid var(--color-accent)',
    },

    '.cm-panel input': {
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-foreground)',
      border: '1px solid var(--color-accent)',
      padding: '0.25rem 0.5rem',
      fontFamily: 'var(--font-code)',
    },

    '.cm-panel button': {
      backgroundColor: 'transparent',
      color: 'var(--color-foreground)',
      border: '1px solid var(--color-accent)',
      padding: '0.25rem 0.5rem',
      cursor: 'pointer',
      fontFamily: 'var(--font-code)',
    },

    '.cm-panel button:hover': {
      backgroundColor: 'var(--color-accent)',
    },

    // Search match highlighting
    '.cm-searchMatch': {
      backgroundColor: 'var(--color-accent)',
      outline: '1px solid var(--color-accent)',
    },

    '.cm-searchMatch-selected': {
      backgroundColor: 'var(--color-selection-focused)',
    },

    // Autocomplete styling
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--color-background)',
      border: '1px solid var(--color-accent)',
      fontFamily: 'var(--font-code)',
    },

    '.cm-tooltip-autocomplete > ul > li': {
      color: 'var(--color-foreground)',
      padding: '0.25rem 0.5rem',
    },

    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--color-accent)',
      color: 'var(--color-foreground)',
    },

    // Horizontal rules (---, ***, ___) - visual styling
    '.cm-line:has(.tok-contentSeparator)': {
      borderTop: '1px solid var(--color-accent)',
      marginTop: '1rem',
      marginBottom: '1rem',
      paddingTop: '0.5rem',
    },
  },
  { dark: true },
)

/**
 * Comprehensive syntax highlighting for Markdown
 */
const minimalHighlightStyle = HighlightStyle.define([
  // Headers (# through ######)
  { tag: t.heading1, fontSize: '1.8rem', fontWeight: '700', color: 'var(--color-foreground)' },
  { tag: t.heading2, fontSize: '1.6rem', fontWeight: '700', color: 'var(--color-foreground)' },
  { tag: t.heading3, fontSize: '1.4rem', fontWeight: '600', color: 'var(--color-foreground)' },
  { tag: t.heading4, fontSize: '1.2rem', fontWeight: '600', color: 'var(--color-foreground)' },
  { tag: t.heading5, fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-foreground)' },
  { tag: t.heading6, fontSize: '1rem', fontWeight: '600', color: 'var(--color-foreground)' },

  // Emphasis (italic with * or _)
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--color-foreground)' },
  
  // Strong emphasis (bold with ** or __)
  { tag: t.strong, fontWeight: '700', color: 'var(--color-foreground)' },
  
  // Strikethrough (GFM extension with ~~)
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--color-foreground)' },

  // Inline code (backticks)
  {
    tag: t.monospace,
    fontFamily: 'var(--font-code)',
    backgroundColor: 'var(--color-selection)',
    padding: '0.1rem 0.3rem',
    borderRadius: '3px',
  },
  
  // Code blocks (triple backticks)
  { tag: t.special(t.string), fontFamily: 'var(--font-code)', color: 'var(--color-foreground)' },
  { tag: t.atom, fontFamily: 'var(--font-code)' },
  
  // Code block language identifier (e.g., ```javascript)
  { tag: t.labelName, fontFamily: 'var(--font-code)', color: 'var(--color-accent)', fontSize: '0.85rem' },

  // Links (inline and reference style)
  { tag: t.link, color: 'var(--color-foreground)', textDecoration: 'underline', cursor: 'pointer' },
  
  // URLs in links and autolinks
  { tag: t.url, color: 'var(--color-foreground)', textDecoration: 'underline' },

  // Ordered and unordered lists
  { tag: t.list, color: 'var(--color-foreground)' },
  
  // List markers (-, *, +, 1., 2., etc.)
  { tag: t.processingInstruction, color: 'var(--color-accent)', fontWeight: '600' },
  
  // Task list markers ([ ] and [x])
  { tag: t.bool, color: 'var(--color-accent)', fontWeight: '600' },

  // Blockquotes (>)
  { tag: t.quote, fontStyle: 'italic', color: 'var(--color-muted)' },

  // Meta elements (markdown syntax characters like *, **, ~~, [], (), etc.)
  { tag: t.meta, color: 'var(--color-muted)', opacity: 0.7 },
  
  // Escape characters (\)
  { tag: t.escape, color: 'var(--color-muted)' },
  
  // HTML comments in markdown
  { tag: t.comment, color: 'var(--color-muted)', fontStyle: 'italic' },
  
  // HTML tags in markdown
  { tag: t.tagName, color: 'var(--color-accent)' },
  { tag: t.angleBracket, color: 'var(--color-muted)' },
  { tag: t.attributeName, color: 'var(--color-foreground)' },
  { tag: t.attributeValue, color: 'var(--color-foreground)' },

  // Horizontal rules (---, ***, ___)
  { tag: t.contentSeparator, color: 'var(--color-accent)', fontWeight: '700' },

  // Default text
  { tag: t.content, color: 'var(--color-foreground)' },
])

/**
 * Complete theme extension combining base theme and syntax highlighting
 */
export const theme: Extension = [minimalTheme, syntaxHighlighting(minimalHighlightStyle)]
