/**
 * - Hides markdown syntax characters when cursor is not on the line
 * - Renders images inline
 * - Makes links clickable with Ctrl/Cmd+Click
 */

import { ViewPlugin, Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { Range, Extension } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/**
 * Build decorations to hide markdown syntax
 */
function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const checkboxDecorations: Range<Decoration>[] = []
  
  // Get the line number where the cursor is
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number
  
  // Track which lines have blockquote markers for styling
  const blockquoteLines = new Set<number>()
  
  // Track which lines have images (to avoid hiding their child nodes on cursor line)
  const imageLines = new Set<number>()
  
  // First pass: collect blockquote lines and image lines
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
        const nodeType = node.type.name
        const onCursorLine = line === cursorLine
        const onImageLine = imageLines.has(line)
        
        // If cursor is on an image line, don't hide any syntax - let user edit
        if (onCursorLine && onImageLine) {
          // Only add the image widget below, don't hide anything
          if (nodeType === 'Image') {
            const imageNode = node.node
            let alt = ''
            let url = ''
            
            const altNode = imageNode.getChild('LinkLabel')
            if (altNode) {
              alt = view.state.doc.sliceString(altNode.from, altNode.to)
              alt = alt.replace(/^\[|\]$/g, '')
            }
            
            const urlNode = imageNode.getChild('URL')
            if (urlNode) {
              url = view.state.doc.sliceString(urlNode.from, urlNode.to)
              url = url.replace(/^\(|\)$/g, '')
            }
            
            if (url) {
              decorations.push(
                Decoration.widget({
                  widget: new ImageWidget(url, alt),
                  side: 1,
                }).range(node.to)
              )
            }
          }
          return // Don't hide any child nodes
        }
        
        // Special handling for images - always render them
        if (nodeType === 'Image') {
          // Extract alt text and URL from the image node
          const imageNode = node.node
          let alt = ''
          let url = ''
          
          // Get alt text (from LinkLabel child)
          const altNode = imageNode.getChild('LinkLabel')
          if (altNode) {
            alt = view.state.doc.sliceString(altNode.from, altNode.to)
            // Remove brackets
            alt = alt.replace(/^\[|\]$/g, '')
          }
          
          // Get URL (from URL child)
          const urlNode = imageNode.getChild('URL')
          if (urlNode) {
            url = view.state.doc.sliceString(urlNode.from, urlNode.to)
            // Remove parentheses if present
            url = url.replace(/^\(|\)$/g, '')
          }
          
          if (url) {
            if (onCursorLine) {
              // On cursor line: show markdown AND image below it
              decorations.push(
                Decoration.widget({
                  widget: new ImageWidget(url, alt),
                  side: 1, // Place after the markdown
                }).range(node.to)
              )
            } else {
              // Off cursor line: replace markdown with image
              decorations.push(
                Decoration.replace({
                  widget: new ImageWidget(url, alt),
                }).range(node.from, node.to)
              )
            }
          }
          return // Don't process further for images
        }
        
        // Don't hide syntax on cursor line (except for images and task lists)
        if (onCursorLine && nodeType !== 'ListItem') return
        
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
        
        // Replace task markers with clickable checkboxes
        // Note: Process this BEFORE other decorations to ensure proper ordering
        else if (nodeType === 'ListItem') {
          // Get the line text
          const lineStart = view.state.doc.lineAt(node.from)
          const lineText = lineStart.text
          
          // Check if this is a task list item (- [ ] or - [x])
          const taskMatch = lineText.match(/^(\s*)([-*+])\s+(\[[ xX]\])/)
          if (taskMatch) {
            // Calculate positions for list marker and checkbox
            const indentLength = taskMatch[1].length
            const markerLength = taskMatch[2].length // - or * or +
            const spaceAfterMarker = 1
            
            // Position of the list marker (- or * or +)
            const listMarkerStart = lineStart.from + indentLength
            
            // Position of the checkbox marker [ ] or [x]
            const checkboxStart = listMarkerStart + markerLength + spaceAfterMarker
            const checkboxEnd = checkboxStart + 3 // [x] is 3 characters
            
            // Space after checkbox
            const spaceAfterCheckbox = 1
            const replaceEnd = checkboxEnd + spaceAfterCheckbox
            
            // Show checkbox UNLESS cursor is within the "- [ ] " part
            const cursorPos = view.state.selection.main.head
            const cursorInTaskMarker = onCursorLine && cursorPos >= listMarkerStart && cursorPos <= replaceEnd
            
            if (!cursorInTaskMarker) {
              const isChecked = taskMatch[3].includes('x') || taskMatch[3].includes('X')
              
              // Replace entire "- [ ] " with just the checkbox
              checkboxDecorations.push(
                Decoration.replace({
                  widget: new CheckboxWidget(isChecked, checkboxStart),
                }).range(listMarkerStart, replaceEnd)
              )
            }
            // Note: Don't return false - allow processing of nested ListItems
          }
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
      },
    })
  }
  
  // Combine all decorations: checkboxes first, then others
  const allDecorations = [
    ...checkboxDecorations,
    ...decorations,
  ]
  
  // Sort all decorations by position
  allDecorations.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  
  return Decoration.set(allDecorations)
}

/**
 * Widget for rendering inline images
 * Displays actual images in the editor
 */
class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string
  ) {
    super()
  }
  
  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }
  
  toDOM(): HTMLElement {
    const container = document.createElement('span')
    container.className = 'cm-image-widget'
    
    const img = document.createElement('img')
    img.src = this.src
    img.alt = this.alt
    img.className = 'cm-image'
    
    // Set max dimensions for images
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
    img.style.display = 'block'
    img.style.margin = '0.5rem 0'
    img.style.borderRadius = '4px'
    
    // Handle loading states
    img.onload = () => {
      img.style.opacity = '1'
    }
    
    // Handle errors - show fallback
    img.onerror = () => {
      img.style.display = 'none'
      const error = document.createElement('span')
      error.className = 'cm-image-error'
      error.textContent = `🖼️ Image not found: ${this.alt || this.src}`
      container.appendChild(error)
    }
    
    // Start with slightly transparent while loading
    img.style.opacity = '0.5'
    img.style.transition = 'opacity 0.2s'
    
    container.appendChild(img)
    
    // Add a wrapper for better layout
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-wrapper'
    wrapper.appendChild(container)
    
    return wrapper
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
 * Widget for clickable checkboxes in task lists
 * Replaces [ ] and [x] with interactive checkboxes
 */
class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number
  ) {
    super()
  }
  
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos
  }
  
  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-checkbox-wrapper'
    wrapper.style.display = 'inline-block'
    
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.checked
    checkbox.className = 'cm-task-checkbox'
    
    // Add inline styling to ensure visibility
    checkbox.style.width = '16px'
    checkbox.style.height = '16px'
    checkbox.style.margin = '0 0.5rem 0 0'
    checkbox.style.cursor = 'pointer'
    checkbox.style.verticalAlign = 'middle'
    checkbox.style.appearance = 'auto'
    
    // Handle checkbox toggle on mousedown (before the checkbox toggles)
    checkbox.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      // Toggle the checkbox state manually
      const newChecked = !this.checked
      const newValue = newChecked ? '[x]' : '[ ]'
      
      // Update the document - this will rebuild decorations with new state
      view.dispatch({
        changes: {
          from: this.pos,
          to: this.pos + 3,
          insert: newValue,
        },
      })
    })
    
    wrapper.appendChild(checkbox)
    return wrapper
  }
  
  ignoreEvent(): boolean {
    // Let the widget handle all events
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

/**
 * Get link URL at a given position
 */
function getLinkAtPos(view: EditorView, pos: number): string | null {
  const tree = syntaxTree(view.state)
  const node = tree.resolveInner(pos, 1)
  
  // Check if we're in a Link node
  let linkNode = node
  while (linkNode && linkNode.parent) {
    if (linkNode.type.name === 'Link') {
      // Found a link, extract the URL
      const urlNode = linkNode.node.getChild('URL')
      if (urlNode) {
        let url = view.state.doc.sliceString(urlNode.from, urlNode.to)
        // Remove parentheses if present
        url = url.replace(/^\(|\)$/g, '').trim()
        return url
      }
      return null
    }
    linkNode = linkNode.parent
  }
  
  // Check if we're in an Autolink
  let autolinkNode = node
  while (autolinkNode && autolinkNode.parent) {
    if (autolinkNode.type.name === 'Autolink') {
      const url = view.state.doc.sliceString(autolinkNode.from, autolinkNode.to)
      return url.trim()
    }
    autolinkNode = autolinkNode.parent
  }
  
  return null
}

/**
 * Handle click events to detect Ctrl/Cmd+Click on links
 */
function handleClick(event: MouseEvent, view: EditorView): boolean {
  // Only handle left mouse button with Ctrl or Cmd key
  if (event.button !== 0) return false
  if (!event.ctrlKey && !event.metaKey) return false
  
  // Get the position where the click occurred
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return false
  
  // Check if there's a link at this position
  const url = getLinkAtPos(view, pos)
  if (!url) return false
  
  // Prevent default behavior and open the link
  event.preventDefault()
  event.stopPropagation()
  
  // Open the link in a new tab
  try {
    // Handle relative URLs, data URIs, and absolute URLs
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      window.location.href = url
    } else {
      // For relative URLs, might need special handling based on your app
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
