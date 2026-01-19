/**
 * Table Import Utilities - Convert CSV/XLSX files to markdown table format
 */

import * as XLSX from 'xlsx'

/**
 * Convert a CSV or Excel file to markdown table format
 */
export async function convertFileToMarkdownTable(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return null
    }

    const worksheet = workbook.Sheets[firstSheetName]

    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use array of arrays format
      defval: '', // Default value for empty cells
      raw: false, // Convert all values to strings
    }) as string[][]

    if (jsonData.length === 0) {
      return null
    }

    // First row is headers
    const headers = jsonData[0] || []
    if (headers.length === 0) {
      return null
    }

    // Clean headers - remove empty strings and trim
    const cleanHeaders = headers.map((h) => String(h || '').trim() || 'Column')
    const numColumns = cleanHeaders.length

    // Data rows (skip first row which is headers)
    const rows = jsonData.slice(1).map((row) => {
      // Ensure row has the same number of columns as headers
      const paddedRow = [...row]
      while (paddedRow.length < numColumns) {
        paddedRow.push('')
      }
      // Trim and convert to strings, limit to header length
      return paddedRow.slice(0, numColumns).map((cell) => String(cell || '').trim())
    })

    // Build markdown table
    // Header row
    const headerRow = `| ${cleanHeaders.join(' | ')} |`

    // Separator row with left alignment (default)
    const separatorRow = `| ${cleanHeaders.map(() => '---').join(' | ')} |`

    // Data rows - if no data rows, add an empty row to maintain table structure
    let dataRows = rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
    if (rows.length === 0) {
      // Add an empty row to maintain table structure
      const emptyRow = Array(numColumns).fill(' ')
      dataRows = `| ${emptyRow.join(' | ')} |`
    }

    // Combine all parts
    const markdownTable = `${headerRow}\n${separatorRow}\n${dataRows}`

    return markdownTable
  } catch (error) {
    console.error('Failed to parse CSV/XLSX file:', error)
    return null
  }
}

/**
 * Check if a file is a CSV or Excel file
 */
export function isSpreadsheetFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()

  // Check by extension
  if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return true
  }

  // Check by MIME type
  if (
    mimeType === 'text/csv' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12'
  ) {
    return true
  }

  return false
}
