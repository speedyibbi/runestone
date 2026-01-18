/**
 * Live Preview Plugin - Main plugin for live preview functionality
 *
 * Provides live preview with:
 * - Syntax character hiding/fading
 * - Inline image rendering
 * - Clickable checkboxes
 * - Clickable links
 * - Table rendering
 * - Math equation rendering
 *
 * Architecture:
 * - Uses ViewPlugin with decorations
 * - Separates widgets into individual files
 * - Uses utility functions for common operations
 */

import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { Range, Extension } from '@codemirror/state'
import { StateField, StateEffect, Facet } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

// Import widgets
import {
  ImageWidget,
  VideoWidget,
  AudioWidget,
  CheckboxWidget,
  TableWidget,
  InlineMathWidget,
  BlockMathWidget,
  HorizontalRuleWidget,
  ReferenceDefinitionWidget,
  BulletWidget,
  type SigilUrlResolver,
} from './widgets'

// Import utilities
import { getChildText, getLinkAtPos, parseTable } from './utils'
import { MediaEntryType } from '@/interfaces/manifest'

/**
 * Facet to provide sigil URL resolver function
 */
export const sigilResolverFacet = Facet.define<SigilUrlResolver | null, SigilUrlResolver | null>({
  combine: (values) => values[values.length - 1] ?? null,
})

/**
 * Facet to provide rune opener function
 * Takes a rune title and opens the corresponding rune
 */
export const runeOpenerFacet = Facet.define<
  ((runeTitle: string) => Promise<void>) | null,
  ((runeTitle: string) => Promise<void>) | null
>({
  combine: (values) => values[values.length - 1] ?? null,
})

/**
 * Facet to provide manifest entry type resolver function
 * Takes a sigil ID and returns the MediaEntryType or null
 */
export const manifestEntryTypeFacet = Facet.define<
  ((sigilId: string) => MediaEntryType | null) | null,
  ((sigilId: string) => MediaEntryType | null) | null
>({
  combine: (values) => values[values.length - 1] ?? null,
})

/**
 * State field to track preview mode
 */
export const togglePreviewMode = StateEffect.define<boolean>()

export const previewModeField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(togglePreviewMode)) {
        return effect.value
      }
    }
    return value
  },
})

/**
 * Build decorations to hide markdown syntax and render interactive elements
 */
function buildDecorations(view: EditorView, isPreviewMode = false): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const checkboxDecorations: Range<Decoration>[] = []

  // Get sigil resolver from facet
  const sigilResolver = view.state.facet(sigilResolverFacet)

  // Get manifest entry type resolver from facet
  const manifestEntryTypeResolver = view.state.facet(manifestEntryTypeFacet)

  // Get the line number where the cursor is
  // In preview mode, set cursorLine to -1 so all syntax is hidden
  const cursorLine = isPreviewMode
    ? -1
    : view.state.doc.lineAt(view.state.selection.main.head).number

  // Track which lines have special elements
  const blockquoteLines = new Set<number>()
  const imageLines = new Set<number>()
  const tableLines = new Set<number>()
  const processedTables = new Set<number>()
  const processedMath = new Set<string>()

  // First pass: collect line metadata
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const line = view.state.doc.lineAt(node.from).number

        if (line !== cursorLine && node.type.name === 'QuoteMark') {
          blockquoteLines.add(line)
        }

        if (node.type.name === 'Image') {
          imageLines.add(line)
        }

        if (node.type.name === 'Table') {
          const tableStartLine = view.state.doc.lineAt(node.from).number
          const tableEndLine = view.state.doc.lineAt(node.to).number
          for (let i = tableStartLine; i <= tableEndLine; i++) {
            tableLines.add(i)
          }
        }
      },
    })
  }

  // Add line decorations for blockquotes
  blockquoteLines.forEach((lineNum) => {
    const lineObj = view.state.doc.line(lineNum)
    decorations.push(
      Decoration.line({
        class: 'cm-blockquote-line',
      }).range(lineObj.from),
    )
  })

  // Track processed wiki links to avoid duplicates
  const processedWikiLinks = new Set<number>()

  // Scan for wiki links [[Title]] or [[Title|Display Text]]
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Find wiki links: [[Title]] or [[Title|Display Text]]
    const wikiLinkRegex = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g
    let wikiMatch
    while ((wikiMatch = wikiLinkRegex.exec(text)) !== null) {
      const matchStart = from + wikiMatch.index
      const matchEnd = matchStart + wikiMatch[0].length
      const targetTitle = wikiMatch[1].trim()
      const displayText = wikiMatch[2]?.trim() || targetTitle

      // Check if cursor is within the wiki link
      const cursorPos = view.state.selection.main.head
      const cursorInWikiLink = cursorPos >= matchStart && cursorPos <= matchEnd

      if (!cursorInWikiLink && !processedWikiLinks.has(matchStart)) {
        processedWikiLinks.add(matchStart)

        // Hide the opening brackets [[
        decorations.push(Decoration.replace({}).range(matchStart, matchStart + 2))

        // Hide the closing brackets ]]
        decorations.push(Decoration.replace({}).range(matchEnd - 2, matchEnd))

        if (wikiMatch[2]) {
          // Has display text: [[Title|Display Text]]
          // Hide the target title and pipe, show only display text as link
          const targetStart = matchStart + 2
          const targetEnd = targetStart + targetTitle.length
          const pipeEnd = targetEnd + 1 // pipe is 1 char
          const displayStart = pipeEnd
          const displayEnd = matchEnd - 2

          // Hide target title and pipe
          decorations.push(Decoration.replace({}).range(targetStart, displayStart))

          // Decorate the display text to look like a markdown link
          decorations.push(
            Decoration.mark({
              class: 'cm-wiki-link',
              attributes: {
                'data-wiki-target': targetTitle,
              },
            }).range(displayStart, displayEnd),
          )
        } else {
          // No display text: [[Title]] - show title as link
          const linkTextStart = matchStart + 2
          const linkTextEnd = matchEnd - 2

          decorations.push(
            Decoration.mark({
              class: 'cm-wiki-link',
              attributes: {
                'data-wiki-target': targetTitle,
              },
            }).range(linkTextStart, linkTextEnd),
          )
        }
      }
    }
  }

  // Track processed hashtags to avoid duplicates
  const processedHashtags = new Set<number>()

  // Scan for hashtags #tag or #multi-word-tag
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Find hashtags: #tag (word characters and hyphens)
    // Pattern matches at start of line or after whitespace
    const hashtagRegex = /(?:^|\s)(#)([\w-]+)/g
    let hashtagMatch
    while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
      const fullMatchStart = from + hashtagMatch.index
      const hashStart = fullMatchStart + hashtagMatch[0].indexOf('#')
      const tagStart = hashStart + 1 // After the #
      const tagEnd = fullMatchStart + hashtagMatch[0].length
      const hashtag = hashtagMatch[2]

      // Check if cursor is within the hashtag
      const cursorPos = view.state.selection.main.head
      const cursorInHashtag = cursorPos >= hashStart && cursorPos <= tagEnd

      if (!cursorInHashtag && !processedHashtags.has(hashStart)) {
        processedHashtags.add(hashStart)

        // Hide the # symbol
        decorations.push(Decoration.replace({}).range(hashStart, tagStart))

        // Decorate the tag text to look like an Obsidian tag (pill/badge style)
        decorations.push(
          Decoration.mark({
            class: 'cm-hashtag',
            attributes: {
              'data-hashtag': hashtag.toLowerCase(),
            },
          }).range(tagStart, tagEnd),
        )
      }
    }
  }

  // Scan for math equations (inline $...$ and block $$...$$)
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)

    // Find block math ($$...$$) - multiline
    const blockMathRegex = /\$\$([^$]+(?:\$(?!\$)[^$]*)*)\$\$/g
    let blockMatch
    while ((blockMatch = blockMathRegex.exec(text)) !== null) {
      const matchStart = from + blockMatch.index
      const matchEnd = matchStart + blockMatch[0].length
      const latex = blockMatch[1].trim()

      // Check if cursor is on any line of this math block
      const matchStartLine = view.state.doc.lineAt(matchStart).number
      const matchEndLine = view.state.doc.lineAt(matchEnd).number
      const cursorOnMath = cursorLine >= matchStartLine && cursorLine <= matchEndLine

      if (!cursorOnMath && latex && !processedMath.has(`block-${matchStart}`)) {
        processedMath.add(`block-${matchStart}`)

        // Add the widget at the start of the block
        decorations.push(
          Decoration.widget({
            widget: new BlockMathWidget(latex),
            side: -1,
          }).range(matchStart),
        )

        // Hide each line of the math block separately
        for (let lineNum = matchStartLine; lineNum <= matchEndLine; lineNum++) {
          const lineObj = view.state.doc.line(lineNum)

          decorations.push(Decoration.replace({}).range(lineObj.from, lineObj.to))

          if (lineNum > matchStartLine) {
            decorations.push(
              Decoration.line({
                attributes: { class: 'cm-math-hidden-line' },
              }).range(lineObj.from),
            )
          }
        }
      }
    }

    // Find inline math ($...$) - single line, not $$
    const inlineMathRegex = /(?<!\$)\$(?!\$)([^$\n]+)\$(?!\$)/g
    let inlineMatch
    while ((inlineMatch = inlineMathRegex.exec(text)) !== null) {
      const matchStart = from + inlineMatch.index
      const matchEnd = matchStart + inlineMatch[0].length
      const latex = inlineMatch[1].trim()

      const matchLine = view.state.doc.lineAt(matchStart).number
      const cursorOnMath = matchLine === cursorLine

      if (!cursorOnMath && latex && !processedMath.has(`inline-${matchStart}`)) {
        processedMath.add(`inline-${matchStart}`)
        decorations.push(
          Decoration.replace({
            widget: new InlineMathWidget(latex),
          }).range(matchStart, matchEnd),
        )
      }
    }
  }

  // Second pass: process syntax nodes for decorations
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const line = view.state.doc.lineAt(node.from).number
        const nodeType = node.type.name
        const onCursorLine = line === cursorLine
        const onImageLine = imageLines.has(line)

        // Handle table rendering
        if (nodeType === 'Table' && !processedTables.has(node.from)) {
          processedTables.add(node.from)

          const tableStartLine = view.state.doc.lineAt(node.from).number
          const tableEndLine = view.state.doc.lineAt(node.to).number
          const cursorOnTable = cursorLine >= tableStartLine && cursorLine <= tableEndLine

          if (!cursorOnTable) {
            const tableData = parseTable(view, node.node)
            if (tableData) {
              decorations.push(
                Decoration.widget({
                  widget: new TableWidget(tableData, view, node.from, node.to, isPreviewMode),
                  side: -1,
                }).range(node.from),
              )

              for (let lineNum = tableStartLine; lineNum <= tableEndLine; lineNum++) {
                const lineObj = view.state.doc.line(lineNum)

                decorations.push(Decoration.replace({}).range(lineObj.from, lineObj.to))

                if (lineNum > tableStartLine) {
                  decorations.push(
                    Decoration.line({
                      attributes: { class: 'cm-table-hidden-line' },
                    }).range(lineObj.from),
                  )
                }
              }
            }
          }

          return false
        }

        // Handle images, videos, and audio
        if (nodeType === 'Image') {
          const imageNode = node.node
          const alt = getChildText(imageNode, 'LinkLabel', view).replace(/^\[|\]$/g, '')
          const url = getChildText(imageNode, 'URL', view).replace(/^\(|\)$/g, '')

          if (url) {
            // Determine which widget to use based on manifest entry type
            let widget: ImageWidget | VideoWidget | AudioWidget

            // Check if it's a sigil:// URL and we have a type resolver
            if (
              (url.startsWith('sigil://') || url.startsWith('sigil:')) &&
              manifestEntryTypeResolver
            ) {
              const sigilId = url.replace(/^sigil:\/\//, '').replace(/^sigil:/, '')
              const entryType = manifestEntryTypeResolver(sigilId)

              // Create appropriate widget based on entry type
              if (entryType === MediaEntryType.VIDEO) {
                widget = new VideoWidget(url, alt, sigilResolver || undefined)
              } else if (entryType === MediaEntryType.AUDIO) {
                widget = new AudioWidget(url, alt, sigilResolver || undefined)
              } else {
                // Default to ImageWidget for IMAGE or unknown types
                widget = new ImageWidget(url, alt, sigilResolver || undefined)
              }
            } else {
              // Not a sigil:// URL or no resolver - default to ImageWidget
              widget = new ImageWidget(url, alt, sigilResolver || undefined)
            }

            if (onCursorLine && onImageLine) {
              // On cursor line: show markdown AND media below it
              decorations.push(
                Decoration.widget({
                  widget: widget,
                  side: 1,
                }).range(node.to),
              )
            } else if (!onCursorLine) {
              // Off cursor line: replace markdown with media
              decorations.push(
                Decoration.replace({
                  widget: widget,
                }).range(node.from, node.to),
              )
            }
          }
          return
        }

        // Don't hide syntax on cursor line (except for special cases)
        if (onCursorLine && nodeType !== 'ListItem') return

        // Hide heading marks (#)
        if (nodeType === 'HeaderMark') {
          decorations.push(Decoration.replace({}).range(node.from, node.to))
        }

        // Hide emphasis marks (**, __, *, _)
        else if (nodeType === 'EmphasisMark') {
          const text = view.state.doc.sliceString(node.from, node.to)
          if (text.match(/^(\*+|_+)$/)) {
            decorations.push(Decoration.replace({}).range(node.from, node.to))
          }
        }

        // Hide strikethrough marks (~~)
        else if (nodeType === 'StrikethroughMark') {
          decorations.push(Decoration.replace({}).range(node.from, node.to))
        }

        // Hide horizontal rules
        else if (nodeType === 'HorizontalRule') {
          const hrLine = view.state.doc.lineAt(node.from)
          const hrText = hrLine.text.trim()

          if (hrText.match(/^(\-{3,}|\*{3,}|_{3,})$/)) {
            decorations.push(
              Decoration.replace({
                widget: new HorizontalRuleWidget(),
              }).range(hrLine.from, hrLine.to),
            )
          }
        }

        // Hide inline code backticks
        else if (nodeType === 'CodeMark') {
          decorations.push(Decoration.replace({}).range(node.from, node.to))
        }

        // Hide blockquote markers (>)
        else if (nodeType === 'QuoteMark') {
          decorations.push(Decoration.replace({}).range(node.from, node.to))
        }

        // Handle list items (task lists and bullets)
        else if (nodeType === 'ListItem') {
          const lineStart = view.state.doc.lineAt(node.from)
          const lineText = lineStart.text

          // Check for task list item
          const taskMatch = lineText.match(/^(\s*)([-*+])\s+(\[[ xX]\])/)
          if (taskMatch) {
            const indentLength = taskMatch[1].length
            const markerLength = taskMatch[2].length
            const spaceAfterMarker = 1

            const listMarkerStart = lineStart.from + indentLength
            const checkboxStart = listMarkerStart + markerLength + spaceAfterMarker
            const checkboxEnd = checkboxStart + 3
            const spaceAfterCheckbox = 1
            const replaceEnd = checkboxEnd + spaceAfterCheckbox

            const cursorPos = view.state.selection.main.head
            const cursorInTaskMarker =
              onCursorLine && cursorPos >= listMarkerStart && cursorPos <= replaceEnd

            if (!cursorInTaskMarker) {
              const isChecked = taskMatch[3].includes('x') || taskMatch[3].includes('X')

              checkboxDecorations.push(
                Decoration.replace({
                  widget: new CheckboxWidget(isChecked, checkboxStart),
                }).range(listMarkerStart, replaceEnd),
              )
            }
          } else {
            // Regular bullet list
            const bulletMatch = lineText.match(/^(\s*)([-*+])\s+/)
            if (bulletMatch && !onCursorLine) {
              const indentLength = bulletMatch[1].length
              const markerLength = bulletMatch[2].length
              const spaceLength = 1

              const markerStart = lineStart.from + indentLength
              const markerEnd = markerStart + markerLength + spaceLength

              decorations.push(
                Decoration.replace({
                  widget: new BulletWidget(),
                }).range(markerStart, markerEnd),
              )
            }
          }
        }

        // Hide link marks
        else if (nodeType === 'LinkMark') {
          decorations.push(Decoration.replace({}).range(node.from, node.to))
        }

        // Hide URL in links (but not autolinks)
        else if (nodeType === 'URL') {
          const parent = node.node.parent
          if (parent && parent.type.name === 'Link') {
            decorations.push(Decoration.replace({}).range(node.from, node.to))
          }
        }

        // Hide link titles
        else if (nodeType === 'LinkTitle') {
          decorations.push(Decoration.replace({}).range(node.from, node.to))
        }

        // Hide link labels in reference-style links
        else if (nodeType === 'LinkLabel') {
          const lineStart = view.state.doc.lineAt(node.from)
          const lineText = lineStart.text.trim()

          // Reference definition line [ref]: url
          if (lineText.match(/^\[.+\]:\s*.+/)) {
            decorations.push(
              Decoration.replace({
                widget: new ReferenceDefinitionWidget(),
              }).range(lineStart.from, lineStart.to),
            )
          } else {
            // Reference-style link [text][ref]
            const textBefore = view.state.doc.sliceString(Math.max(0, node.from - 50), node.from)
            if (textBefore.match(/\]\s*$/)) {
              decorations.push(Decoration.replace({}).range(node.from, node.to))
            }
          }
        }
      },
    })
  }

  // Combine all decorations: checkboxes first, then others
  const allDecorations = [...checkboxDecorations, ...decorations]

  // Sort all decorations by position
  allDecorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)

  return Decoration.set(allDecorations)
}

/**
 * Live Preview Plugin - Manages decoration updates
 */
export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      const isPreviewMode = view.state.field(previewModeField)
      this.decorations = buildDecorations(view, isPreviewMode)
    }

    update(update: ViewUpdate) {
      const isPreviewMode = update.state.field(previewModeField)
      // Rebuild decorations when document changes, selection changes, viewport changes, or preview mode changes
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        update.transactions.some((tr) => tr.effects.some((e) => e.is(togglePreviewMode)))
      ) {
        this.decorations = buildDecorations(update.view, isPreviewMode)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

/**
 * Handle click events to detect Ctrl/Cmd+Click on links
 */
function handleClick(event: MouseEvent, view: EditorView): boolean {
  // Only handle left mouse button with Ctrl or Cmd key
  if (event.button !== 0) return false
  if (!event.ctrlKey && !event.metaKey) return false

  // Check if we clicked on a wiki link decoration element
  const target = event.target as HTMLElement
  const wikiTarget = target.closest('.cm-wiki-link')?.getAttribute('data-wiki-target')

  if (wikiTarget) {
    // Clicked on a wiki link - open the rune
    event.preventDefault()
    event.stopPropagation()

    const runeOpener = view.state.facet(runeOpenerFacet)
    if (runeOpener) {
      runeOpener(wikiTarget).catch((error) => {
        console.warn('Failed to open rune:', error.message || error)
      })
    }
    return true
  }

  // Get the position where the click occurred
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return false

  // Check if there's a link at this position
  const url = getLinkAtPos(view, pos)
  if (!url) return false

  // Prevent default behavior and open the link
  event.preventDefault()
  event.stopPropagation()

  // Get rune opener from facet
  const runeOpener = view.state.facet(runeOpenerFacet)

  // Check if this is a rune link (wiki link or markdown link pointing to a rune)
  // Wiki links return the title directly, markdown links might point to a rune
  if (runeOpener) {
    // Check for rune:// protocol (markdown links to runes)
    const isRuneProtocol = url.startsWith('rune://')

    // For wiki links, the URL is the rune title
    // For markdown links, check if the URL doesn't look like an external URL
    const isExternalUrl =
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('//') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('#')

    if (isRuneProtocol || !isExternalUrl) {
      // This is a rune link - try to open it
      // The URL could be:
      // - rune://uuid (from markdown link)
      // - rune title (from wiki link)
      // - relative path (treated as rune title)
      runeOpener(url).catch((error) => {
        // If opening as rune fails (e.g., rune not found), just log it
        // Don't fall back to external link behavior for non-external URLs
        console.warn('Failed to open rune:', error.message || error)
      })
      return true
    }
  }

  // Open external links in a new tab
  try {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      window.location.href = url
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  } catch (error) {
    console.error('Failed to open link:', error)
  }

  return true
}

/**
 * Extension to make links clickable with Ctrl/Cmd+Click
 */
export const clickableLinks: Extension = EditorView.domEventHandlers({
  mousedown(event, view) {
    return handleClick(event, view)
  },
})

/**
 * Preview mode theme extension - hides cursor and disables selection styling
 */
export const previewModeTheme = EditorView.theme({
  '&.cm-preview-mode': {
    cursor: 'default',
  },
  '&.cm-preview-mode .cm-cursor': {
    display: 'none',
  },
  '&.cm-preview-mode .cm-selectionBackground': {
    backgroundColor: 'transparent',
  },
  '&.cm-preview-mode .cm-content': {
    caretColor: 'transparent',
  },
})

/**
 * Extension that adds the preview mode class when in preview mode
 */
export const previewModeExtension: Extension = EditorView.updateListener.of((update) => {
  const isPreview = update.state.field(previewModeField)
  const hasClass = update.view.dom.classList.contains('cm-preview-mode')

  if (isPreview && !hasClass) {
    update.view.dom.classList.add('cm-preview-mode')
  } else if (!isPreview && hasClass) {
    update.view.dom.classList.remove('cm-preview-mode')
  }
})
