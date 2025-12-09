/**
 * TableWidget - Renders markdown tables as interactive HTML tables
 * Allows editing cells, adding rows and columns in live preview mode
 */

import { WidgetType, EditorView } from '@codemirror/view'

export interface TableData {
  headers: string[]
  alignments: ('left' | 'center' | 'right')[]
  rows: string[][]
}

export class TableWidget extends WidgetType {
  constructor(
    readonly data: TableData,
    readonly view: EditorView,
    readonly tableFrom: number,
    readonly tableTo: number,
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
    const cells = parts.slice(1, -1).map((c) => c.trim())

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
      const cells = parts.slice(1, -1).map((c) => c.trim())

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
