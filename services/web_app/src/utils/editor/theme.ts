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
      maxWidth: '100%',
      caretColor: 'var(--color-foreground)',
      padding: '2rem 2rem 2rem 0',
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
      backgroundColor: 'transparent',
      border: 'none',
    },

    '.cm-lineNumbers': {
      display: 'none', // Hide line numbers
    },

    '.cm-foldGutter': {
      width: '2rem',
      color: 'var(--text-color-secondary, #888)',
      cursor: 'pointer',
      userSelect: 'none',
    },

    '.cm-foldGutter .cm-gutterElement': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      opacity: 0,
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    },

    // Show chevron on active line (cursor on that line)
    '.cm-foldGutter .cm-activeLine-gutter': {
      opacity: 0.6,
    },

    // Show chevron on direct hover
    '.cm-foldGutter .cm-gutterElement:hover': {
      opacity: 1,
    },

    '.cm-foldGutter .cm-gutterElement:hover .cm-fold-marker': {
      transform: 'scale(1.15)',
    },

    '.cm-fold-marker': {
      color: 'var(--color-foreground)',
    },

    // Fold placeholder styling (shown when content is folded)
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-color-secondary, #888)',
      fontSize: '0.9rem',
      fontWeight: '300',
      padding: '0',
      margin: '0 0.2rem',
      opacity: 0.3,
      cursor: 'pointer',
      transition: 'opacity 0.2s ease',
      verticalAlign: 'baseline',
    },

    '.cm-foldPlaceholder:hover': {
      opacity: 0.6,
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

    // Horizontal rule widget (live preview)
    '.cm-hr-widget': {
      height: '1px',
      backgroundColor: 'var(--color-accent)',
      width: '100%',
    },

    // Blockquote line styling (live preview)
    '.cm-blockquote-line': {
      borderLeft: '4px solid var(--color-accent)',
      paddingLeft: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      fontStyle: 'italic',
    },

    // Image widget wrapper (live preview)
    '.cm-image-wrapper': {
      display: 'block',
      margin: '0.5rem 0',
    },

    // Image widget container (live preview)
    '.cm-image-widget': {
      display: 'block',
      lineHeight: 0,
    },

    // Inline images (live preview)
    '.cm-image': {
      maxWidth: '100%',
      height: 'auto',
      display: 'block',
      borderRadius: '4px',
      cursor: 'pointer',
    },

    // Image error fallback (live preview)
    '.cm-image-error': {
      display: 'inline-block',
      padding: '0.5rem 1rem',
      backgroundColor: 'rgba(255, 100, 100, 0.1)',
      color: 'var(--color-muted)',
      borderRadius: '4px',
      fontSize: '0.875rem',
      border: '1px dashed rgba(255, 100, 100, 0.3)',
    },

    // Reference definition indicator (live preview)
    '.cm-reference-definition': {
      display: 'inline-block',
      fontSize: '0.75rem',
      opacity: 0.5,
      cursor: 'help',
    },

    // Task list checkboxes (live preview)
    '.cm-task-checkbox': {
      marginRight: '0.5rem',
      cursor: 'pointer',
      accentColor: 'var(--color-accent)',
    },

    // Hidden table markdown lines (collapsed to zero height)
    '.cm-table-hidden-line': {
      height: '0 !important',
      padding: '0 !important',
      margin: '0 !important',
      lineHeight: '0 !important',
      overflow: 'hidden',
    },

    // Table container (holds wrapper and add row button)
    '.cm-table-container': {
      width: '100%',
      margin: '0.5rem 0',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '6px',
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },

    // Table wrapper (enables horizontal scrolling)
    '.cm-table-wrapper': {
      width: '100%',
      overflowX: 'auto',
      overflowY: 'hidden',
      backgroundColor: 'transparent',
    },

    // Custom scrollbar for table wrapper
    '.cm-table-wrapper::-webkit-scrollbar': {
      height: '2px',
    },

    '.cm-table-wrapper::-webkit-scrollbar-track': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '0 0 6px 6px',
    },

    '.cm-table-wrapper::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: '4px',
    },

    '.cm-table-wrapper::-webkit-scrollbar-thumb:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },

    // Add column button in header
    '.cm-table-add-column-header': {
      padding: '0.75rem 1rem',
      fontWeight: 'normal',
      textAlign: 'center',
      cursor: 'pointer',
      color: 'var(--color-accent)',
      fontSize: '0.9em',
      borderRight: 'none',
      userSelect: 'none',
      backgroundColor: 'transparent',
      transition: 'background-color 0.2s',
      whiteSpace: 'nowrap',
    },

    '.cm-table-add-column-header:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },

    // Placeholder cells under the Add Column button
    '.cm-table-add-column-placeholder': {
      padding: '0.75rem 1rem',
      backgroundColor: 'transparent',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      borderRight: 'none',
      userSelect: 'none',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    },

    // Add row button (below table)
    '.cm-table-add-row': {
      textAlign: 'center',
      padding: '0.5rem',
      cursor: 'pointer',
      color: 'var(--color-accent)',
      fontSize: '0.9em',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      userSelect: 'none',
      backgroundColor: 'transparent',
      transition: 'background-color 0.2s',
    },

    '.cm-table-add-row:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },

    // Table widget (live preview)
    '.cm-table-widget': {
      width: '100%',
      borderCollapse: 'collapse',
      margin: '0',
      fontSize: 'inherit',
      backgroundColor: 'transparent',
      border: 'none',
      tableLayout: 'auto',
      display: 'table',
    },

    '.cm-table-widget thead': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
    },

    '.cm-table-widget th': {
      padding: '0.75rem 1rem',
      fontWeight: '600',
      color: 'var(--color-foreground)',
      textAlign: 'left',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      whiteSpace: 'nowrap',
      cursor: 'text',
      transition: 'background-color 0.2s',
    },

    '.cm-table-widget th:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },

    '.cm-table-widget th:focus': {
      outline: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      boxShadow: 'inset 0 0 0 1px var(--color-accent)',
    },

    '.cm-table-widget th:last-child': {
      borderRight: 'none',
    },

    // Override cursor for add column button (must come after th styles)
    '.cm-table-widget .cm-table-add-column-header': {
      cursor: 'pointer',
    },

    '.cm-table-widget td': {
      padding: '0.75rem 1rem',
      color: 'var(--color-foreground)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      whiteSpace: 'nowrap',
      cursor: 'text',
      transition: 'background-color 0.2s',
    },

    '.cm-table-widget td:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },

    '.cm-table-widget td:focus': {
      outline: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      boxShadow: 'inset 0 0 0 1px var(--color-accent)',
    },

    '.cm-table-widget td:last-child': {
      borderRight: 'none',
    },

    '.cm-table-widget tbody tr:last-child td': {
      borderBottom: 'none',
    },

    '.cm-table-widget tbody tr:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
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

  // Links (inline and reference style) - clickable with Ctrl/Cmd+Click
  { tag: t.link, color: 'var(--color-foreground)', textDecoration: 'underline', cursor: 'pointer' },
  
  // URLs in links and autolinks - also clickable
  { tag: t.url, color: 'var(--color-foreground)', textDecoration: 'underline', cursor: 'pointer' },

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
