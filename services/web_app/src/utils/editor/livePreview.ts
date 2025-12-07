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
 * Parse table data from a Table node
 */
interface TableData {
  headers: string[]
  alignments: ('left' | 'center' | 'right')[]
  rows: string[][]
}

function parseTable(view: EditorView, tableNode: any): TableData | null {
  // Get the full table text and parse it line by line
  const tableText = view.state.doc.sliceString(tableNode.from, tableNode.to)
  const lines = tableText.split('\n').filter(line => line.trim())
  
  if (lines.length < 2) {
    return null // Need at least header and delimiter
  }
  
  // Parse header row (first line)
  const headerLine = lines[0]
  const headerParts = headerLine.split('|')
  // Remove first and last empty parts (before first | and after last |)
  const headers = headerParts.slice(1, -1).map(cell => cell.trim())
  
  if (headers.length === 0) {
    return null
  }
  
  // Parse delimiter row (second line) for alignments
  const delimiterLine = lines[1]
  const delimiterParts = delimiterLine.split('|')
  // Remove first and last empty parts (before first | and after last |)
  const delimiterCells = delimiterParts.slice(1, -1).map(cell => cell.trim())
  
  const alignments: ('left' | 'center' | 'right')[] = delimiterCells.map((cell) => {
    const trimmed = cell.trim()
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
      return 'center'
    } else if (trimmed.endsWith(':')) {
      return 'right'
    } else {
      return 'left'
    }
  })
  
  // Parse data rows (remaining lines)
  const rows: string[][] = []
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]
    const parts = line.split('|')
    // Remove first and last empty parts (before first | and after last |)
    // Keep empty cells as empty strings to preserve structure
    const cells = parts.slice(1, -1).map(cell => cell.trim())
    
    // Ensure row has the same number of columns as headers
    while (cells.length < headers.length) {
      cells.push('')
    }
    
    // Only include rows that have the right structure
    if (cells.length > 0) {
      rows.push(cells.slice(0, headers.length))
    }
  }
  
  return { headers, alignments, rows }
}

/**
 * Widget to render tables
 */
class TableWidget extends WidgetType {
  constructor(
    readonly data: TableData,
    readonly view: EditorView,
    readonly tableFrom: number,
    readonly tableTo: number
  ) {
    super()
  }
  
  eq(other: TableWidget): boolean {
    return (
      JSON.stringify(this.data) === JSON.stringify(other.data) &&
      this.tableFrom === other.tableFrom &&
      this.tableTo === other.tableTo
    )
  }
  
  toDOM(): HTMLElement {
    // Create container to hold both the scrollable wrapper and the add row button
    const container = document.createElement('div')
    container.className = 'cm-table-container'
    
    // Create wrapper for horizontal scrolling
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-wrapper'
    
    const table = document.createElement('table')
    table.className = 'cm-table-widget'
    
    // Handle double-click to edit markdown directly
    table.addEventListener('dblclick', (e) => {
      // Only handle if not clicking on an editable cell
      const target = e.target as HTMLElement
      if (target.contentEditable === 'true') {
        return
      }
      
      // Move cursor to the table position to show markdown
      this.view.dispatch({
        selection: { anchor: this.tableFrom },
      })
      this.view.focus()
    })
    
    // Create header
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    
    this.data.headers.forEach((header, i) => {
      const th = document.createElement('th')
      th.textContent = header
      th.contentEditable = 'true'
      th.spellcheck = false
      if (this.data.alignments[i]) {
        th.style.textAlign = this.data.alignments[i]
      }
      
      // Handle header editing - only update on blur to avoid cursor issues
      th.addEventListener('blur', () => {
        const newValue = th.textContent || ''
        // Try to update immediately, fall back to deferred if there's an error
        try {
          this.updateHeader(i, newValue)
        } catch (error) {
          // If update is in progress, defer it
          requestAnimationFrame(() => {
            this.updateHeader(i, newValue)
          })
        }
      })
      
      // Prevent Enter key from creating new lines
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          th.blur()
        }
      })
      
      headerRow.appendChild(th)
    })
    
    // Add "Add Column" button as the last header cell
    const addColumnHeader = document.createElement('th')
    addColumnHeader.className = 'cm-table-add-column-header'
    addColumnHeader.textContent = '+ Add Column'
    
    // Prevent mousedown from blurring focused cells and moving cursor
    addColumnHeader.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    
    addColumnHeader.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.addColumn()
    })
    
    // Prevent double-click from triggering markdown mode
    addColumnHeader.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    
    headerRow.appendChild(addColumnHeader)
    
    thead.appendChild(headerRow)
    table.appendChild(thead)
    
    // Create body
    const tbody = document.createElement('tbody')
    
    this.data.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      row.forEach((cell, colIndex) => {
        const td = document.createElement('td')
        td.textContent = cell
        td.contentEditable = 'true'
        td.spellcheck = false
        if (this.data.alignments[colIndex]) {
          td.style.textAlign = this.data.alignments[colIndex]
        }
        
        // Handle cell editing - only update on blur to avoid cursor issues
        td.addEventListener('blur', () => {
          const newValue = td.textContent || ''
          // Try to update immediately, fall back to deferred if there's an error
          try {
            this.updateCell(rowIndex, colIndex, newValue)
          } catch (error) {
            // If update is in progress, defer it
            requestAnimationFrame(() => {
              this.updateCell(rowIndex, colIndex, newValue)
            })
          }
        })
        
        // Prevent Enter key from creating new lines
        td.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            td.blur()
          }
        })
        
        tr.appendChild(td)
      })
      
      // Add placeholder cell for the "Add Column" button column
      const placeholderCell = document.createElement('td')
      placeholderCell.className = 'cm-table-add-column-placeholder'
      tr.appendChild(placeholderCell)
      
      tbody.appendChild(tr)
    })
    
    table.appendChild(tbody)
    
    // Add "Add Row" button
    const addRowButton = document.createElement('div')
    addRowButton.className = 'cm-table-add-row'
    addRowButton.textContent = '+ Add Row'
    
    // Prevent mousedown from blurring focused cells and moving cursor
    addRowButton.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    
    addRowButton.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.addRow()
    })
    
    // Prevent double-click from triggering markdown mode
    addRowButton.addEventListener('dblclick', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    
    // Append table to wrapper
    wrapper.appendChild(table)
    
    // Append wrapper and button to container
    container.appendChild(wrapper)
    container.appendChild(addRowButton)
    
    return container
  }
  
  updateHeader(colIndex: number, newValue: string): void {
    const tableText = this.view.state.doc.sliceString(this.tableFrom, this.tableTo)
    const lines = tableText.split('\n')
    
    if (lines.length < 1) return
    
    // Parse the header line - don't filter empty cells
    const headerLine = lines[0]
    const parts = headerLine.split('|')
    // Remove first and last empty parts (before first | and after last |)
    const cells = parts.slice(1, -1).map(c => c.trim())
    
    // Ensure we have the right number of columns
    while (cells.length < this.data.headers.length) {
      cells.push('')
    }
    
    if (colIndex < cells.length) {
      // Keep at least one space if empty to preserve cell structure
      cells[colIndex] = newValue.trim() || ' '
      const newHeaderLine = `| ${cells.join(' | ')} |`
      lines[0] = newHeaderLine
      
      const newTableText = lines.join('\n')
      this.view.dispatch({
        changes: {
          from: this.tableFrom,
          to: this.tableTo,
          insert: newTableText,
        },
      })
    }
  }
  
  updateCell(rowIndex: number, colIndex: number, newValue: string): void {
    const tableText = this.view.state.doc.sliceString(this.tableFrom, this.tableTo)
    const lines = tableText.split('\n')
    
    // Row index + 2 to account for header and separator lines
    const lineIndex = rowIndex + 2
    
    if (lineIndex < lines.length) {
      const line = lines[lineIndex]
      const parts = line.split('|')
      // Remove first and last empty parts (before first | and after last |)
      const cells = parts.slice(1, -1).map(c => c.trim())
      
      // Ensure we have the right number of columns
      while (cells.length < this.data.headers.length) {
        cells.push('')
      }
      
      if (colIndex < cells.length) {
        // Keep at least one space if empty to preserve cell structure
        cells[colIndex] = newValue.trim() || ' '
        const newLine = `| ${cells.join(' | ')} |`
        lines[lineIndex] = newLine
        
        const newTableText = lines.join('\n')
        this.view.dispatch({
          changes: {
            from: this.tableFrom,
            to: this.tableTo,
            insert: newTableText,
          },
        })
      }
    }
  }
  
  addRow(): void {
    const tableText = this.view.state.doc.sliceString(this.tableFrom, this.tableTo)
    const lines = tableText.split('\n')
    
    // Create a new empty row with the correct number of columns
    const numCols = this.data.headers.length
    const emptyCells = Array(numCols).fill(' ')
    const newRow = `| ${emptyCells.join(' | ')} |`
    
    // Add the new row at the end
    lines.push(newRow)
    
    const newTableText = lines.join('\n')
    this.view.dispatch({
      changes: {
        from: this.tableFrom,
        to: this.tableTo,
        insert: newTableText,
      },
    })
  }
  
  addColumn(): void {
    const tableText = this.view.state.doc.sliceString(this.tableFrom, this.tableTo)
    const lines = tableText.split('\n')
    
    if (lines.length < 2) return
    
    // Process each line and add a new column
    const newLines = lines.map((line, index) => {
      if (line.trim() === '') return line
      
      const parts = line.split('|')
      // Remove first and last empty parts
      const cells = parts.slice(1, -1)
      
      if (index === 0) {
        // Header row - add empty header
        cells.push(' Column ')
      } else if (index === 1) {
        // Separator row - add alignment marker
        cells.push('---')
      } else {
        // Data row - add empty cell
        cells.push(' ')
      }
      
      return `| ${cells.join(' | ')} |`
    })
    
    const newTableText = newLines.join('\n')
    this.view.dispatch({
      changes: {
        from: this.tableFrom,
        to: this.tableTo,
        insert: newTableText,
      },
    })
  }
  
  ignoreEvent(event: Event): boolean {
    // Ignore all events (prevent cursor from moving into table on click)
    // This allows our widget to handle editing internally
    return true
  }
}

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
  
  // Track which lines are part of tables
  const tableLines = new Set<number>()
  const processedTables = new Set<number>()
  
  // First pass: collect blockquote lines, image lines, and table lines
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
        // Track all lines that are part of a table
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
        const onTableLine = tableLines.has(line)
        
        // Handle table rendering
        if (nodeType === 'Table' && !processedTables.has(node.from)) {
          processedTables.add(node.from)
          
          // Check if cursor is on any line of this table
          const tableStartLine = view.state.doc.lineAt(node.from).number
          const tableEndLine = view.state.doc.lineAt(node.to).number
          const cursorOnTable = cursorLine >= tableStartLine && cursorLine <= tableEndLine
          
          if (!cursorOnTable) {
            // Parse and render the table
            const tableData = parseTable(view, node)
            if (tableData) {
              // Add the table widget at the start of the table
              decorations.push(
                Decoration.widget({
                  widget: new TableWidget(tableData, view, node.from, node.to),
                  side: -1,
                }).range(node.from)
              )
              
              // Hide all lines of the table by replacing each line's content and collapsing the line
              // Don't collapse the first line since that's where the widget is placed
              for (let lineNum = tableStartLine; lineNum <= tableEndLine; lineNum++) {
                const lineObj = view.state.doc.line(lineNum)
                
                // Replace the line content (but not the line break)
                decorations.push(
                  Decoration.replace({}).range(lineObj.from, lineObj.to)
                )
                
                // Collapse all lines EXCEPT the first one (where the widget is displayed)
                if (lineNum > tableStartLine) {
                  decorations.push(
                    Decoration.line({
                      attributes: { class: 'cm-table-hidden-line' },
                    }).range(lineObj.from)
                  )
                }
              }
            }
          }
          
          return false // Don't process children if we're rendering the table
        }
        
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
          } else {
            // This is a regular bullet list item (not a task list)
            const bulletMatch = lineText.match(/^(\s*)([-*+])\s+/)
            if (bulletMatch) {
              const indentLength = bulletMatch[1].length
              const markerLength = bulletMatch[2].length
              const spaceLength = 1
              
              const markerStart = lineStart.from + indentLength
              const markerEnd = markerStart + markerLength + spaceLength
              
              // Show bullet UNLESS cursor is on this line
              if (!onCursorLine) {
                decorations.push(
                  Decoration.replace({
                    widget: new BulletWidget(),
                  }).range(markerStart, markerEnd)
                )
              }
            }
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
// Widget for regular bullet list items
class BulletWidget extends WidgetType {
  eq(other: BulletWidget): boolean {
    return true // All bullet widgets are the same
  }
  
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '• '
    span.style.color = 'var(--text-color-secondary, #888)'
    span.style.userSelect = 'none'
    span.style.marginRight = '0.5rem'
    return span
  }
  
  ignoreEvent(): boolean {
    return false
  }
}

// Widget for task list checkboxes
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
  
  // Check if the node itself is a URL (for autolinks in GFM)
  if (node.type.name === 'URL') {
    // Check if this URL is part of a Link or standalone autolink
    const parent = node.parent
    
    if (parent && parent.type.name !== 'Link') {
      // This is a standalone autolink URL, not inside [text](url)
      const url = view.state.doc.sliceString(node.from, node.to)
      return url.trim()
    }
  }
  
  // Check if we're in a Link node [text](url)
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
  
  // Check if we're in an Autolink wrapper node
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
