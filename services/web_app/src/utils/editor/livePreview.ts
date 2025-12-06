/**
 * Hides markdown syntax characters when cursor is not on the line
 */

import { ViewPlugin, Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/**
 * Build decorations to hide markdown syntax
 */
function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = []
  
  // Get the line number where the cursor is
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number
  
  // Track which lines have blockquote markers for styling
  const blockquoteLines = new Set<number>()
  
  // First pass: collect blockquote lines
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const line = view.state.doc.lineAt(node.from).number
        if (line !== cursorLine && node.type.name === 'QuoteMark') {
          blockquoteLines.add(line)
        }
      },
    })
  }
  
  // Add line decorations for blockquotes first
  blockquoteLines.forEach((lineNum) => {
    const lineObj = view.state.doc.line(lineNum)
    decorations.push(
      Decoration.line({
        class: 'cm-blockquote-line',
      }).range(lineObj.from)
    )
  })
  
  // Second pass: add all other decorations
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const line = view.state.doc.lineAt(node.from).number
        
        // Don't hide syntax on cursor line
        if (line === cursorLine) return
        
        const nodeType = node.type.name
        
        // Hide heading marks (# symbols)
        if (nodeType === 'HeaderMark') {
          decorations.push(
            Decoration.replace({}).range(node.from, node.to)
          )
        }
        
        // Hide emphasis marks (bold: **, __)
        else if (nodeType === 'EmphasisMark') {
          const text = view.state.doc.sliceString(node.from, node.to)
          if (text === '**' || text === '__' || text === '*' || text === '_' || text === '***' || text === '___') {
            decorations.push(
              Decoration.replace({}).range(node.from, node.to)
            )
          }
        }
        
        // Hide strikethrough marks (~~)
        else if (nodeType === 'StrikethroughMark') {
          decorations.push(
            Decoration.replace({}).range(node.from, node.to)
          )
        }
        
        // Hide horizontal rule content
        else if (nodeType === 'HorizontalRule') {
          const hrLine = view.state.doc.lineAt(node.from)
          const hrText = hrLine.text.trim()
          
          if (hrText.match(/^(\-{3,}|\*{3,}|_{3,})$/)) {
            decorations.push(
              Decoration.replace({
                widget: new HorizontalRuleWidget(),
              }).range(hrLine.from, hrLine.to)
            )
          }
        }
        
        // Hide inline code backticks
        else if (nodeType === 'CodeMark') {
          decorations.push(
            Decoration.replace({}).range(node.from, node.to)
          )
        }
        
        // Hide blockquote markers (>)
        else if (nodeType === 'QuoteMark') {
          decorations.push(
            Decoration.replace({}).range(node.from, node.to)
          )
        }
        
        // Hide link brackets, parentheses, and other marks
        else if (nodeType === 'LinkMark') {
          decorations.push(
            Decoration.replace({}).range(node.from, node.to)
          )
        }
        
        // Hide link URLs (the (url) part - just the URL text)
        // But NOT for autolinks (bare URLs without brackets)
        else if (nodeType === 'URL') {
          // Check if this is inside a Link node (not an Autolink)
          const parent = node.node.parent
          if (parent && parent.type.name === 'Link') {
            // This is [text](url) - hide the URL
            decorations.push(
              Decoration.replace({}).range(node.from, node.to)
            )
          }
          // If parent is Autolink or null, don't hide (it's a bare URL)
        }
        
        // Hide link titles ("Optional title" part in links)
        else if (nodeType === 'LinkTitle') {
          decorations.push(
            Decoration.replace({}).range(node.from, node.to)
          )
        }
        
        // Hide link labels in reference-style links [text][label]
        // This catches the [label] part after the link text
        else if (nodeType === 'LinkLabel') {
          // Check if this is part of a link (not a reference definition)
          const lineStart = view.state.doc.lineAt(node.from)
          const lineText = lineStart.text.trim()
          
          // If it's a reference definition line [ref]: url, hide entire line
          if (lineText.match(/^\[.+\]:\s*.+/)) {
            decorations.push(
              Decoration.replace({
                widget: new ReferenceDefinitionWidget(),
              }).range(lineStart.from, lineStart.to)
            )
          } else {
            // Otherwise it's part of a reference-style link [text][ref]
            // Check if there's link text before it (meaning this is the [ref] part)
            const textBefore = view.state.doc.sliceString(Math.max(0, node.from - 50), node.from)
            if (textBefore.match(/\]\s*$/)) {
              // This is the [ref] after [text], hide it
              decorations.push(
                Decoration.replace({}).range(node.from, node.to)
              )
            }
          }
        }
        
        // Hide image syntax completely
        else if (nodeType === 'Image') {
          decorations.push(
            Decoration.replace({
              widget: new ImagePlaceholderWidget(),
            }).range(node.from, node.to)
          )
        }
      },
    })
  }
  
  // Sort all decorations by position
  decorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  
  return Decoration.set(decorations)
}

/**
 * Widget for images (placeholder for now)
 * Will be replaced with actual image rendering in Phase 1
 */
class ImagePlaceholderWidget extends WidgetType {
  toDOM(): HTMLElement {
    const placeholder = document.createElement('span')
    placeholder.className = 'cm-image-placeholder'
    placeholder.textContent = '🖼️ Image'
    return placeholder
  }
  
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Widget for reference definitions
 * Hides reference definition lines like [ref]: url
 */
class ReferenceDefinitionWidget extends WidgetType {
  toDOM(): HTMLElement {
    const placeholder = document.createElement('span')
    placeholder.className = 'cm-reference-definition'
    placeholder.textContent = '🔗'
    placeholder.title = 'Link reference (hidden in preview)'
    return placeholder
  }
  
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Widget for horizontal rules
 * Replaces the markdown syntax with a visual line
 */
class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('div')
    hr.className = 'cm-hr-widget'
    return hr
  }
  
  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Live Preview Plugin
 * Manages decoration updates based on cursor position and document changes
 */
export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    
    update(update: ViewUpdate) {
      // Rebuild decorations when document changes, selection changes, or viewport changes
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)
