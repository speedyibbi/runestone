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
      color: 'var(--color-muted)',
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
      color: 'var(--color-muted)',
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
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none', // IE and Edge
    },

    // Code blocks
    '.cm-line .tok-monospace': {
      fontFamily: 'var(--font-code)',
    },

    // Search panel styling
    '.cm-panel': {
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-foreground)',
      border: '1px solid var(--color-overlay-border)',
    },

    '.cm-panel input': {
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-foreground)',
      border: '1px solid var(--color-overlay-border)',
      padding: '0.25rem 0.5rem',
      fontFamily: 'var(--font-code)',
    },

    '.cm-panel button': {
      backgroundColor: 'transparent',
      color: 'var(--color-foreground)',
      border: '1px solid var(--color-overlay-border)',
      padding: '0.25rem 0.5rem',
      cursor: 'pointer',
      fontFamily: 'var(--font-code)',
    },

    '.cm-panel button:hover': {
      backgroundColor: 'var(--color-overlay-light)',
    },

    // Search match highlighting
    '.cm-searchMatch': {
      backgroundColor: 'var(--color-overlay-medium)',
      outline: '1px solid var(--color-overlay-border)',
    },

    '.cm-searchMatch-selected': {
      backgroundColor: 'var(--color-selection-focused)',
    },

    // Autocomplete styling
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--color-background)',
      border: '1px solid var(--color-overlay-border)',
      fontFamily: 'var(--font-code)',
    },

    '.cm-tooltip-autocomplete > ul > li': {
      color: 'var(--color-foreground)',
      padding: '0.25rem 0.5rem',
    },

    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'var(--color-overlay-medium)',
      color: 'var(--color-foreground)',
    },

    // Horizontal rules (---, ***, ___) - visual styling
    '.cm-line:has(.tok-contentSeparator)': {
      borderTop: '1px solid var(--color-overlay-border)',
      marginTop: '1rem',
      marginBottom: '1rem',
      paddingTop: '0.5rem',
    },

    // Horizontal rule widget (live preview)
    '.cm-hr-widget': {
      height: '1px',
      backgroundColor: 'var(--color-overlay-border)',
      width: '100%',
    },

    // Blockquote line styling (live preview)
    '.cm-blockquote-line': {
      borderLeft: '4px solid var(--color-accent)',
      paddingLeft: '1rem',
      // backgroundColor: 'var(--color-overlay-subtle)',
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
      backgroundColor: 'var(--color-error-bg)',
      color: 'var(--color-muted)',
      borderRadius: '4px',
      fontSize: '0.875rem',
      border: '1px dashed var(--color-error-border)',
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
      border: '1px solid var(--color-overlay-border)',
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
      backgroundColor: 'var(--color-overlay-light)',
      borderRadius: '0 0 6px 6px',
    },

    '.cm-table-wrapper::-webkit-scrollbar-thumb': {
      backgroundColor: 'var(--color-overlay-hover)',
      borderRadius: '4px',
    },

    '.cm-table-wrapper::-webkit-scrollbar-thumb:hover': {
      backgroundColor: 'var(--color-overlay-active)',
    },

    // Add column button in header
    '.cm-table-add-column-header': {
      padding: '0.75rem 1rem',
      fontWeight: 'normal',
      textAlign: 'center',
      cursor: 'pointer',
      color: 'var(--color-muted)',
      fontSize: '0.9em',
      borderRight: 'none',
      userSelect: 'none',
      backgroundColor: 'transparent',
      transition: 'background-color 0.2s',
      whiteSpace: 'nowrap',
    },

    '.cm-table-add-column-header:hover': {
      backgroundColor: 'var(--color-overlay-light)',
    },

    // Placeholder cells under the Add Column button
    '.cm-table-add-column-placeholder': {
      padding: '0.75rem 1rem',
      backgroundColor: 'transparent',
      borderBottom: '1px solid var(--color-overlay-medium)',
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
      color: 'var(--color-muted)',
      fontSize: '0.9em',
      borderTop: '1px solid var(--color-overlay-strong)',
      userSelect: 'none',
      backgroundColor: 'transparent',
      transition: 'background-color 0.2s',
    },

    '.cm-table-add-row:hover': {
      backgroundColor: 'var(--color-overlay-light)',
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
      backgroundColor: 'var(--color-overlay-medium)',
      borderBottom: '2px solid var(--color-overlay-hover)',
    },

    '.cm-table-widget th': {
      padding: '0.75rem 1rem',
      fontWeight: '600',
      color: 'var(--color-foreground)',
      textAlign: 'left',
      borderRight: '1px solid var(--color-overlay-strong)',
      whiteSpace: 'nowrap',
      cursor: 'text',
      transition: 'background-color 0.2s',
    },

    '.cm-table-widget th:hover': {
      backgroundColor: 'var(--color-overlay-subtle)',
    },

    '.cm-table-widget th:focus': {
      outline: 'none',
      backgroundColor: 'var(--color-overlay-light)',
      boxShadow: 'inset 0 0 0 1px var(--color-overlay-border)',
    },

    // Preview mode: remove edit cursor and hover effects
    '&.cm-preview-mode .cm-table-widget th': {
      cursor: 'default',
    },

    '&.cm-preview-mode .cm-table-widget th:hover': {
      backgroundColor: 'transparent',
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
      borderBottom: '1px solid var(--color-overlay-medium)',
      borderRight: '1px solid var(--color-overlay-medium)',
      whiteSpace: 'nowrap',
      cursor: 'text',
      transition: 'background-color 0.2s',
    },

    '.cm-table-widget td:hover': {
      backgroundColor: 'var(--color-overlay-subtle)',
    },

    '.cm-table-widget td:focus': {
      outline: 'none',
      backgroundColor: 'var(--color-overlay-light)',
      boxShadow: 'inset 0 0 0 1px var(--color-overlay-border)',
    },

    // Preview mode: remove edit cursor and hover effects
    '&.cm-preview-mode .cm-table-widget td': {
      cursor: 'default',
    },

    '&.cm-preview-mode .cm-table-widget td:hover': {
      backgroundColor: 'transparent',
    },

    '.cm-table-widget td:last-child': {
      borderRight: 'none',
    },

    '.cm-table-widget tbody tr:last-child td': {
      borderBottom: 'none',
    },

    '.cm-table-widget tbody tr:hover': {
      backgroundColor: 'var(--color-overlay-light)',
    },

    // Preview mode: remove row hover effect
    '&.cm-preview-mode .cm-table-widget tbody tr:hover': {
      backgroundColor: 'transparent',
    },

    // Hidden math markdown lines (collapsed to zero height)
    '.cm-math-hidden-line': {
      height: '0 !important',
      padding: '0 !important',
      margin: '0 !important',
      lineHeight: '0 !important',
      overflow: 'hidden',
    },

    // Math equation styling (KaTeX)
    // Inline math
    '.cm-inline-math': {
      display: 'inline-block',
      padding: '0.1rem 0.3rem',
      margin: '0 0.2rem',
      borderRadius: '3px',
      backgroundColor: 'var(--color-overlay-subtle)',
      fontSize: '1em',
      verticalAlign: 'middle',
    },

    // Block/display math
    '.cm-block-math': {
      display: 'block',
      padding: '1rem',
      margin: '1rem 0',
      borderRadius: '6px',
      backgroundColor: 'var(--color-overlay-subtle)',
      border: '1px solid var(--color-overlay-strong)',
      textAlign: 'center',
      overflowX: 'auto',
    },

    // KaTeX elements styling
    '.cm-inline-math .katex, .cm-block-math .katex': {
      color: 'var(--color-foreground)',
    },

    '.cm-inline-math .katex-display, .cm-block-math .katex-display': {
      margin: '0',
    },

    // Math error styling
    '.cm-inline-math[title], .cm-block-math[title]': {
      borderColor: 'var(--color-error-border)',
      backgroundColor: 'var(--color-error-bg)',
    },

    // Wiki links - styled to match markdown links
    '.cm-wiki-link': {
      color: 'var(--color-accent)',
      textDecoration: 'underline',
      cursor: 'pointer',
    },

    // Hashtags - Obsidian-style pill/badge appearance
    '.cm-hashtag': {
      display: 'inline-block',
      backgroundColor: 'var(--color-overlay-medium)',
      color: 'var(--color-accent)',
      padding: '0.15rem 0.5rem',
      borderRadius: '0.25rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      verticalAlign: 'baseline',
      lineHeight: '1.4',
    },

    '.cm-hashtag:hover': {
      backgroundColor: 'var(--color-overlay-hover)',
    },

    // Audio widget wrapper
    '.cm-audio-wrapper': {
      margin: '0.5rem 0',
      width: '100%',
    },

    // Audio widget container
    '.cm-audio-widget': {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      backgroundColor: 'var(--color-overlay-subtle)',
      border: '1px solid var(--color-overlay-border)',
      borderRadius: '999px',
      padding: '0.45rem 1rem',
      gap: '0.875rem',
      transition: 'opacity 0.2s ease',
    },

    // Hide native audio element
    '.cm-audio-widget .cm-audio': {
      display: 'none',
    },

    // Audio controls container
    '.cm-audio-controls': {
      display: 'flex',
      alignItems: 'center',
      gap: '0.875rem',
      width: '100%',
    },

    // Play/pause button
    '.cm-audio-play-pause': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2.125rem',
      height: '2.125rem',
      minWidth: '2.125rem',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--color-foreground)',
      cursor: 'pointer',
      padding: '0',
      transition: 'background-color 0.15s ease, transform 0.1s ease',
      outline: 'none',
    },

    '.cm-audio-play-pause:hover': {
      backgroundColor: 'var(--color-overlay-light)',
    },

    '.cm-audio-play-pause:active': {
      transform: 'scale(0.96)',
      backgroundColor: 'var(--color-overlay-medium)',
    },

    '.cm-audio-play-pause svg': {
      width: '1.125rem',
      height: '1.125rem',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },

    // Progress container
    '.cm-audio-progress-container': {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      minWidth: '0',
    },

    '.cm-audio-progress-bar': {
      position: 'relative',
      width: '100%',
      height: '0.375rem',
      backgroundColor: 'var(--color-overlay-medium)',
      borderRadius: '3px',
      cursor: 'pointer',
      overflow: 'hidden',
    },

    '.cm-audio-progress-track': {
      position: 'absolute',
      left: '0',
      top: '0',
      height: '100%',
      backgroundColor: 'var(--color-accent)',
      borderRadius: '3px',
      transition: 'width 0.1s linear',
    },

    // Disable transition during dragging for instant response
    '.cm-audio-progress-bar.dragging .cm-audio-progress-track': {
      transition: 'none',
    },

    '.cm-audio-progress-thumb': {
      position: 'absolute',
      right: '0',
      top: '50%',
      transform: 'translate(50%, -50%)',
      width: '0.8125rem',
      height: '0.8125rem',
      backgroundColor: 'var(--color-foreground)',
      borderRadius: '50%',
      opacity: '0',
      transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
      boxShadow: '0 0 0 2px var(--color-background), 0 1px 2px rgba(0, 0, 0, 0.3)',
    },

    '.cm-audio-progress-bar:hover .cm-audio-progress-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.35)',
    },

    '.cm-audio-progress-bar:active .cm-audio-progress-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    // Keep thumb visible while dragging (using class added via JS if needed)
    '.cm-audio-progress-bar.dragging .cm-audio-progress-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    // Time display
    '.cm-audio-time': {
      fontSize: '0.75rem',
      color: 'var(--color-muted)',
      fontFamily: 'var(--font-code)',
      whiteSpace: 'nowrap',
      minWidth: '5.5rem',
      textAlign: 'right',
      letterSpacing: '0.01em',
    },

    // Volume container
    '.cm-audio-volume-container': {
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      position: 'relative',
    },

    '.cm-audio-volume-btn': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '1.875rem',
      height: '1.875rem',
      minWidth: '1.875rem',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--color-foreground)',
      cursor: 'pointer',
      padding: '0',
      transition: 'background-color 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
    },

    '.cm-audio-volume-btn:hover': {
      backgroundColor: 'var(--color-overlay-light)',
      transform: 'scale(1.15)',
    },

    '.cm-audio-volume-btn:active': {
      transform: 'scale(1.08)',
      backgroundColor: 'var(--color-overlay-medium)',
    },

    '.cm-audio-volume-btn svg': {
      width: '1.0625rem',
      height: '1.0625rem',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },

    '.cm-audio-volume-slider': {
      position: 'relative',
      maxWidth: '0',
      width: '4rem',
      height: '0.375rem',
      backgroundColor: 'var(--color-overlay-medium)',
      borderRadius: '3px',
      cursor: 'pointer',
      overflow: 'hidden',
      opacity: '0',
      transition: 'opacity 0.15s ease, max-width 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
    },

    '.cm-audio-volume-container:hover .cm-audio-volume-slider': {
      maxWidth: '4rem',
      opacity: '1',
      pointerEvents: 'auto',
    },

    '.cm-audio-volume-track': {
      position: 'absolute',
      left: '0',
      top: '0',
      height: '100%',
      backgroundColor: 'var(--color-accent)',
      borderRadius: '3px',
      transition: 'width 0.1s linear',
    },

    // Disable transition during dragging for instant response
    '.cm-audio-volume-slider.dragging .cm-audio-volume-track': {
      transition: 'none',
    },

    '.cm-audio-volume-thumb': {
      position: 'absolute',
      right: '0',
      top: '50%',
      transform: 'translate(50%, -50%)',
      width: '0.6875rem',
      height: '0.6875rem',
      backgroundColor: 'var(--color-foreground)',
      borderRadius: '50%',
      opacity: '0',
      transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
      boxShadow: '0 0 0 2px var(--color-background), 0 1px 2px rgba(0, 0, 0, 0.3)',
    },

    '.cm-audio-volume-slider:hover .cm-audio-volume-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.35)',
    },

    '.cm-audio-volume-slider:active .cm-audio-volume-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    // Keep thumb visible while dragging
    '.cm-audio-volume-slider.dragging .cm-audio-volume-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    // Audio error fallback
    '.cm-audio-error': {
      display: 'inline-block',
      padding: '0.5rem 1rem',
      backgroundColor: 'var(--color-error-bg)',
      color: 'var(--color-muted)',
      borderRadius: '4px',
      fontSize: '0.875rem',
      border: '1px dashed var(--color-error-border)',
    },

    // Video widget wrapper
    '.cm-video-wrapper': {
      margin: '0.5rem 0',
      width: '100%',
    },

    // Video widget container
    '.cm-video-widget': {
      position: 'relative',
      width: '100%',
      backgroundColor: 'var(--color-overlay-subtle)',
      border: '1px solid var(--color-overlay-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      transition: 'opacity 0.2s ease',
    },

    // Video element
    '.cm-video-widget .cm-video': {
      display: 'block',
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
    },

    // Video controls overlay
    '.cm-video-controls-overlay': {
      position: 'absolute',
      bottom: '0',
      left: '0',
      right: '0',
      background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
      padding: '1rem 1rem 0.875rem',
      opacity: '0',
      transition: 'opacity 0.2s ease',
      pointerEvents: 'none',
    },

    '.cm-video-controls-overlay.visible': {
      opacity: '1',
      pointerEvents: 'auto',
    },

    // Video controls container
    '.cm-video-controls': {
      display: 'flex',
      alignItems: 'center',
      gap: '0.875rem',
      width: '100%',
    },

    // Play/pause button
    '.cm-video-play-pause': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2.125rem',
      height: '2.125rem',
      minWidth: '2.125rem',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(4px)',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--color-foreground)',
      cursor: 'pointer',
      padding: '0',
      transition: 'background-color 0.15s ease, transform 0.1s ease',
      outline: 'none',
    },

    '.cm-video-play-pause:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },

    '.cm-video-play-pause:active': {
      transform: 'scale(0.96)',
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    '.cm-video-play-pause svg': {
      width: '1.125rem',
      height: '1.125rem',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },

    // Progress container
    '.cm-video-progress-container': {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      minWidth: '0',
    },

    '.cm-video-progress-bar': {
      position: 'relative',
      width: '100%',
      height: '0.375rem',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: '3px',
      cursor: 'pointer',
      overflow: 'hidden',
    },

    '.cm-video-progress-track': {
      position: 'absolute',
      left: '0',
      top: '0',
      height: '100%',
      backgroundColor: 'var(--color-foreground)',
      borderRadius: '3px',
      transition: 'width 0.1s linear',
    },

    // Disable transition during dragging for instant response
    '.cm-video-progress-bar.dragging .cm-video-progress-track': {
      transition: 'none',
    },

    '.cm-video-progress-thumb': {
      position: 'absolute',
      right: '0',
      top: '50%',
      transform: 'translate(50%, -50%)',
      width: '0.8125rem',
      height: '0.8125rem',
      backgroundColor: 'var(--color-foreground)',
      borderRadius: '50%',
      opacity: '0',
      transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
      boxShadow: '0 0 0 2px var(--color-background), 0 1px 2px rgba(0, 0, 0, 0.3)',
    },

    '.cm-video-progress-bar:hover .cm-video-progress-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.35)',
    },

    '.cm-video-progress-bar:active .cm-video-progress-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    '.cm-video-progress-bar.dragging .cm-video-progress-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    // Time display
    '.cm-video-time': {
      fontSize: '0.75rem',
      color: 'var(--color-foreground)',
      fontFamily: 'var(--font-code)',
      whiteSpace: 'nowrap',
      minWidth: '5.5rem',
      textAlign: 'right',
      letterSpacing: '0.01em',
      textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
    },

    // Volume container
    '.cm-video-volume-container': {
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      position: 'relative',
    },

    '.cm-video-volume-btn': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '1.875rem',
      height: '1.875rem',
      minWidth: '1.875rem',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(4px)',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--color-foreground)',
      cursor: 'pointer',
      padding: '0',
      transition: 'background-color 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
    },

    '.cm-video-volume-btn:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      transform: 'scale(1.15)',
    },

    '.cm-video-volume-btn:active': {
      transform: 'scale(1.08)',
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    '.cm-video-volume-btn svg': {
      width: '1.0625rem',
      height: '1.0625rem',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },

    '.cm-video-volume-slider': {
      position: 'relative',
      maxWidth: '0',
      width: '4rem',
      height: '0.375rem',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: '3px',
      cursor: 'pointer',
      overflow: 'hidden',
      opacity: '0',
      transition: 'opacity 0.15s ease, max-width 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
    },

    '.cm-video-volume-container:hover .cm-video-volume-slider': {
      maxWidth: '4rem',
      opacity: '1',
      pointerEvents: 'auto',
    },

    '.cm-video-volume-track': {
      position: 'absolute',
      left: '0',
      top: '0',
      height: '100%',
      backgroundColor: 'var(--color-foreground)',
      borderRadius: '3px',
      transition: 'width 0.1s linear',
    },

    // Disable transition during dragging for instant response
    '.cm-video-volume-slider.dragging .cm-video-volume-track': {
      transition: 'none',
    },

    '.cm-video-volume-thumb': {
      position: 'absolute',
      right: '0',
      top: '50%',
      transform: 'translate(50%, -50%)',
      width: '0.6875rem',
      height: '0.6875rem',
      backgroundColor: 'var(--color-foreground)',
      borderRadius: '50%',
      opacity: '0',
      transition: 'opacity 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: 'none',
      boxShadow: '0 0 0 2px var(--color-background), 0 1px 2px rgba(0, 0, 0, 0.3)',
    },

    '.cm-video-volume-slider:hover .cm-video-volume-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.35)',
    },

    '.cm-video-volume-slider:active .cm-video-volume-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    '.cm-video-volume-slider.dragging .cm-video-volume-thumb': {
      opacity: '1',
      transform: 'translate(50%, -50%) scale(1.5)',
    },

    // Fullscreen button
    '.cm-video-fullscreen': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '1.875rem',
      height: '1.875rem',
      minWidth: '1.875rem',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(4px)',
      border: 'none',
      borderRadius: '6px',
      color: 'var(--color-foreground)',
      cursor: 'pointer',
      padding: '0',
      transition: 'background-color 0.15s ease, transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      outline: 'none',
    },

    '.cm-video-fullscreen:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      transform: 'scale(1.15)',
    },

    '.cm-video-fullscreen:active': {
      transform: 'scale(1.08)',
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    '.cm-video-fullscreen svg': {
      width: '1.0625rem',
      height: '1.0625rem',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },

    // Video error fallback
    '.cm-video-error': {
      display: 'inline-block',
      padding: '0.5rem 1rem',
      backgroundColor: 'var(--color-error-bg)',
      color: 'var(--color-muted)',
      borderRadius: '4px',
      fontSize: '0.875rem',
      border: '1px dashed var(--color-error-border)',
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
  {
    tag: t.labelName,
    fontFamily: 'var(--font-code)',
    color: 'var(--color-accent)',
    fontSize: '0.85rem',
  },

  // Links (inline and reference style) - clickable with Ctrl/Cmd+Click
  { tag: t.link, color: 'var(--color-accent)', textDecoration: 'underline', cursor: 'pointer' },

  // URLs in links and autolinks - also clickable
  { tag: t.url, color: 'var(--color-accent)', textDecoration: 'underline', cursor: 'pointer' },

  // Ordered and unordered lists
  { tag: t.list, color: 'var(--color-foreground)' },

  // List markers (-, *, +, 1., 2., etc.)
  { tag: t.processingInstruction, color: 'var(--color-accent)', fontWeight: '600' },

  // Task list markers ([ ] and [x])
  { tag: t.bool, color: 'var(--color-accent)', fontWeight: '600' },

  // Blockquotes (>)
  { tag: t.quote, fontStyle: 'italic', color: 'var(--color-accent)' },

  // Meta elements (markdown syntax characters like *, **, ~~, [], (), etc.)
  { tag: t.meta, color: 'var(--color-accent)', opacity: 0.7 },

  // Escape characters (\)
  { tag: t.escape, color: 'var(--color-accent)' },

  // HTML comments in markdown
  { tag: t.comment, color: 'var(--color-accent)', fontStyle: 'italic' },

  // HTML tags in markdown
  { tag: t.tagName, color: 'var(--color-accent)' },
  { tag: t.angleBracket, color: 'var(--color-accent)' },
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
