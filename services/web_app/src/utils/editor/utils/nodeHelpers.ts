/**
 * Node Helpers - Utility functions for working with syntax tree nodes
 * Provides helpers for extracting data from syntax nodes
 */

import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

/**
 * Get the text content of a child node by name
 */
export function getChildText(parentNode: SyntaxNode, childName: string, view: EditorView): string {
  const child = parentNode.getChild(childName)
  if (!child) return ''
  return view.state.doc.sliceString(child.from, child.to)
}

/**
 * Check if a position is within a node of a specific type
 */
export function isInNodeType(view: EditorView, pos: number, nodeType: string): boolean {
  const tree = syntaxTree(view.state)
  let node: SyntaxNode | null = tree.resolveInner(pos, 1)

  while (node) {
    if (node.type.name === nodeType) {
      return true
    }
    node = node.parent
  }

  return false
}

/**
 * Find the closest ancestor node of a specific type
 */
export function findAncestorNode(node: SyntaxNode | null, nodeType: string): SyntaxNode | null {
  let current = node
  while (current && current.parent) {
    if (current.type.name === nodeType) {
      return current
    }
    current = current.parent
  }
  return null
}

/**
 * Get link URL at a given position
 * Handles inline links, autolinks, reference-style links, and wiki links
 */
export function getLinkAtPos(view: EditorView, pos: number): string | null {
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
  let linkNode: SyntaxNode | null = node
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
  let autolinkNode: SyntaxNode | null = node
  while (autolinkNode && autolinkNode.parent) {
    if (autolinkNode.type.name === 'Autolink') {
      const url = view.state.doc.sliceString(autolinkNode.from, autolinkNode.to)
      return url.trim()
    }
    autolinkNode = autolinkNode.parent
  }

  // Check for wiki links: [[Title]] or [[Title|Display Text]]
  // We need to scan the text around the position to find wiki links
  const line = view.state.doc.lineAt(pos)
  const lineText = line.text
  const lineStart = line.from
  const posInLine = pos - lineStart

  // Find all wiki links in the line
  const wikiLinkRegex = /\[\[([^\]]+?)(?:\|([^\]]+?))?\]\]/g
  let wikiMatch
  while ((wikiMatch = wikiLinkRegex.exec(lineText)) !== null) {
    const matchStart = lineStart + wikiMatch.index
    const matchEnd = matchStart + wikiMatch[0].length

    // Check if the position is within this wiki link
    if (pos >= matchStart && pos <= matchEnd) {
      const targetTitle = wikiMatch[1].trim()
      // Return the target title as the link (could be converted to a URL later)
      // For now, we'll return it as-is, but it could be prefixed with a protocol
      // or converted to a rune:// URL format if needed
      return targetTitle
    }
  }

  // Check for hashtags: #tag or #multi-word-tag
  // Pattern matches at start of line or after whitespace
  const hashtagRegex = /(?:^|\s)(#)([\w-]+)/g
  let hashtagMatch
  while ((hashtagMatch = hashtagRegex.exec(lineText)) !== null) {
    const fullMatchStart = lineStart + hashtagMatch.index
    const hashStart = fullMatchStart + hashtagMatch[0].indexOf('#')
    const tagEnd = fullMatchStart + hashtagMatch[0].length

    // Check if the position is within this hashtag (including the #)
    if (pos >= hashStart && pos <= tagEnd) {
      const hashtag = hashtagMatch[2].toLowerCase()
      // Return the hashtag prefixed with # for identification
      return `#${hashtag}`
    }
  }

  return null
}

/**
 * Parse table data from a Table node
 */
export function parseTable(
  view: EditorView,
  tableNode: SyntaxNode,
): {
  headers: string[]
  alignments: ('left' | 'center' | 'right')[]
  rows: string[][]
} | null {
  // Get the full table text and parse it line by line
  const tableText = view.state.doc.sliceString(tableNode.from, tableNode.to)
  const lines = tableText.split('\n').filter((line) => line.trim())

  if (lines.length < 2) {
    return null // Need at least header and delimiter
  }

  // Parse header row (first line)
  const headerLine = lines[0]
  const headerParts = headerLine.split('|')
  // Remove first and last empty parts (before first | and after last |)
  const headers = headerParts.slice(1, -1).map((cell) => cell.trim())

  if (headers.length === 0) {
    return null
  }

  // Parse delimiter row (second line) for alignments
  const delimiterLine = lines[1]
  const delimiterParts = delimiterLine.split('|')
  // Remove first and last empty parts (before first | and after last |)
  const delimiterCells = delimiterParts.slice(1, -1).map((cell) => cell.trim())

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
    const cells = parts.slice(1, -1).map((cell) => cell.trim())

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
