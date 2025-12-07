import { foldService, foldGutter } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view'

/**
 * Folding service for Markdown headings.
 * Allows folding/unfolding content under headings.
 */
export const markdownHeadingFolding = foldService.of((state: EditorState, from: number, to: number) => {
  const tree = syntaxTree(state)
  const node = tree.resolveInner(from, 1)
  
  // Check if we're at a heading
  let headingNode = node
  while (headingNode && headingNode.parent) {
    if (headingNode.type.name.startsWith('ATXHeading')) {
      return getFoldRangeForHeading(state, headingNode)
    }
    headingNode = headingNode.parent
  }
  
  return null
})

/**
 * Calculate the fold range for a heading.
 * The fold range includes everything from the end of the heading line
 * to the start of the next heading of the same or higher level.
 */
function getFoldRangeForHeading(state: EditorState, headingNode: any) {
  // Get the heading level (ATXHeading1, ATXHeading2, etc.)
  const headingLevel = parseInt(headingNode.type.name.replace('ATXHeading', ''))
  
  // Get the line containing the heading
  const headingLine = state.doc.lineAt(headingNode.from)
  
  // Start folding from the end of the heading line
  const foldStart = headingLine.to
  
  // Find the next heading of the same or higher level (lower number)
  const tree = syntaxTree(state)
  let foldEnd = state.doc.length
  let foundNextHeading = false
  
  tree.iterate({
    from: headingNode.to,
    to: state.doc.length,
    enter: (node) => {
      if (foundNextHeading) return false
      
      if (node.type.name.startsWith('ATXHeading')) {
        const nextLevel = parseInt(node.type.name.replace('ATXHeading', ''))
        if (nextLevel <= headingLevel) {
          // Found a heading of same or higher level
          const nextHeadingLine = state.doc.lineAt(node.from)
          foldEnd = nextHeadingLine.from
          foundNextHeading = true
          return false
        }
      }
    },
  })
  
  // Return the fold range if there's any content to fold
  if (foldEnd > foldStart) {
    return { from: foldStart, to: foldEnd }
  }
  
  return null
}

/**
 * Create a custom chevron icon for fold markers
 */
function createChevronIcon(isOpen: boolean): HTMLElement {
  const wrapper = document.createElement('span')
  wrapper.className = 'cm-fold-marker'
  wrapper.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.15s ease;
  `
  
  // Create SVG chevron
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '12')
  svg.setAttribute('height', '12')
  svg.style.cssText = `
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  `
  
  // Create chevron path (right-pointing by default)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M6 4 L10 8 L6 12')
  
  // Rotate if open (down-pointing)
  if (isOpen) {
    svg.style.transform = 'rotate(90deg)'
  }
  
  svg.appendChild(path)
  wrapper.appendChild(svg)
  
  return wrapper
}

/**
 * Fold gutter with custom SVG chevron icons.
 * Shows fold/unfold controls in the gutter.
 */
export const markdownFoldGutter = foldGutter({
  markerDOM: (open) => createChevronIcon(open),
})

/**
 * ViewPlugin to highlight gutter elements on active line.
 * This adds a class to gutter elements when the cursor is on their line.
 */
export const activeLineFoldGutter = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      // Initial update will happen on first update() call
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.viewportChanged || update.docChanged) {
        // Schedule update after current update cycle
        setTimeout(() => this.updateGutterHighlight(update.view), 0)
      }
    }

    updateGutterHighlight(view: EditorView) {
      try {
        // Get the current cursor position
        const cursorPos = view.state.selection.main.head
        const cursorLine = view.state.doc.lineAt(cursorPos)
        
        // Remove all active classes first
        const allGutters = view.dom.querySelectorAll('.cm-foldGutter .cm-gutterElement')
        allGutters.forEach((g) => g.classList.remove('cm-activeLine-gutter'))
        
        // Find the gutter container
        const foldGutter = view.dom.querySelector('.cm-foldGutter')
        if (!foldGutter) return
        
        // Get all gutter elements
        const gutterElements = Array.from(foldGutter.querySelectorAll('.cm-gutterElement'))
        if (gutterElements.length === 0) return
        
        // Check if cursor is anywhere on a line with a heading
        const tree = syntaxTree(view.state)
        
        // Check all nodes on the current line, not just at cursor position
        let isOnHeading = false
        tree.iterate({
          from: cursorLine.from,
          to: cursorLine.to,
          enter: (node) => {
            if (node.type.name.startsWith('ATXHeading')) {
              isOnHeading = true
              return false
            }
          }
        })
        
        // If not on a heading line, no chevron to highlight
        if (!isOnHeading) return
        
        // Find which gutter element corresponds to this line by comparing positions
        // Use the start of the line for consistency
        const lineCoords = view.coordsAtPos(cursorLine.from)
        if (!lineCoords) return
        
        let closestGutter: Element | null = null
        let minDistance = Infinity
        
        for (const gutterEl of gutterElements) {
          const gutterRect = gutterEl.getBoundingClientRect()
          const distance = Math.abs(gutterRect.top - lineCoords.top)
          
          if (distance < minDistance) {
            minDistance = distance
            closestGutter = gutterEl
          }
        }
        
        // If we found a close match (within 10px), highlight it
        if (closestGutter && minDistance < 10) {
          closestGutter.classList.add('cm-activeLine-gutter')
        }
      } catch (error) {
        // Silently fail if layout reading isn't allowed
        console.debug('Could not update gutter highlight:', error)
      }
    }
  }
)
