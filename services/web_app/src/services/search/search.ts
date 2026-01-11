import DatabaseService from '@/services/database/db'
import type { SearchResult, SearchOptions, SearchServiceResult } from '@/interfaces/search'
import { ManifestEntryType } from '@/interfaces/manifest'

/**
 * SearchService handles full-text search using SQLite FTS5
 */
export default class SearchService {
  private static readonly DEFAULT_INDEXER_TABLE = 'blob_index'
  private static readonly FEATURE_FTS_SEARCH = __APP_CONFIG__.global.featureFlags.ftsSearch

  /**
   * Execute search query
   * Supports different search modes: normal, phrase, boolean
   */
  static async search(query: string, options: SearchOptions = {}): Promise<SearchServiceResult> {
    if (!this.FEATURE_FTS_SEARCH) {
      return { results: [], total: 0, query }
    }

    if (!DatabaseService.isReady()) {
      return { results: [], total: 0, query }
    }

    const {
      limit = 50,
      offset = 0,
      mode = 'normal',
      exact = false,
      operators,
      ranking,
      caseSensitive = false,
    } = options

    // Format query based on search mode
    let formattedQuery: string

    // If exact is enabled, wrap the entire query in quotes for exact phrase matching
    if (exact) {
      // FTS5 quotes provide exact phrase matching (no partial word matches)
      const escapedPhrase = query.replace(/"/g, '""')
      formattedQuery = `"${escapedPhrase}"`
    } else {
      // Otherwise, format based on search mode
      switch (mode) {
        case 'phrase':
          // Wrap in quotes for exact phrase matching
          // FTS5 quotes provide exact phrase matching (no partial word matches)
          const escapedPhrase = query.replace(/"/g, '""')
          formattedQuery = `"${escapedPhrase}"`
          break
        case 'boolean':
          // Normalize boolean operators to uppercase for FTS5
          let booleanQuery = query.trim()

          // If operators option is specified and query doesn't contain explicit operators,
          // use the specified operator as default between terms
          if (operators && !/\b(AND|OR|NOT)\b/i.test(booleanQuery)) {
            // Split by spaces and join with the specified operator
            const terms = booleanQuery.split(/\s+/).filter((t) => t.length > 0)
            if (terms.length > 1) {
              booleanQuery = terms.join(` ${operators} `)
            }
          }

          // Normalize any existing operators to uppercase for FTS5
          booleanQuery = booleanQuery
            .replace(/\b(and|AND)\b/g, 'AND')
            .replace(/\b(or|OR)\b/g, 'OR')
            .replace(/\b(not|NOT)\b/g, 'NOT')
            .replace(/"/g, '""')

          formattedQuery = booleanQuery
          break
        case 'normal':
        default:
          // Normal search: handle special characters and escape quotes
          // FTS5 special characters that need quoting: . ( ) { } [ ] : ^ $ -
          const fts5SpecialChars = /[.(){}\[\]:^$\-]/

          // Split query into terms, preserving quoted phrases
          const terms: string[] = []
          let currentTerm = ''
          let inQuotes = false

          for (let i = 0; i < query.length; i++) {
            const char = query[i]
            if (char === '"' && (i === 0 || query[i - 1] !== '\\')) {
              if (inQuotes) {
                // End of quoted phrase
                currentTerm += char
                terms.push(currentTerm)
                currentTerm = ''
                inQuotes = false
              } else {
                // Start of quoted phrase
                if (currentTerm.trim()) {
                  terms.push(currentTerm.trim())
                  currentTerm = ''
                }
                currentTerm = char
                inQuotes = true
              }
            } else if (!inQuotes && /\s/.test(char)) {
              // Space outside quotes - term separator
              if (currentTerm.trim()) {
                terms.push(currentTerm.trim())
                currentTerm = ''
              }
            } else {
              currentTerm += char
            }
          }

          if (currentTerm.trim()) {
            terms.push(currentTerm.trim())
          }

          // Process each term: quote terms with special characters, escape quotes in all terms
          formattedQuery = terms
            .filter((term) => term.length > 0)
            .map((term) => {
              // If already quoted, preserve outer quotes and only escape internal quotes
              if (term.startsWith('"') && term.endsWith('"') && term.length > 2) {
                const inner = term.slice(1, -1) // Get content between quotes
                const escapedInner = inner.replace(/"/g, '""')
                return `"${escapedInner}"`
              }

              // If contains special characters, quote it (and escape internal quotes)
              if (fts5SpecialChars.test(term)) {
                const escaped = term.replace(/"/g, '""')
                return `"${escaped}"`
              }

              // Otherwise, just escape any quotes
              return term.replace(/"/g, '""')
            })
            .join(' ')
          break
      }
    }

    // Determine ranking algorithm (defaults to BM25)
    const rankingAlgorithm = ranking?.algorithm ?? 'bm25'

    // Get ranking weights (defaults: title=1.0, content=1.0)
    // FTS5 bm25() function signature: bm25(table, weight1, weight2, weight3, weight4, weight5, ...)
    // Default indexer table columns: id, type, title, content, metadata
    // We use 0 for id, 0 for type, title weight, content weight, 0 for metadata
    const titleWeight = ranking?.weights?.title ?? 1.0
    const contentWeight = ranking?.weights?.content ?? 1.0

    // Build BM25 function call with weights
    // bm25(default_indexer_table, id_weight, type_weight, title_weight, content_weight, metadata_weight)
    const bm25Function = `bm25(${this.DEFAULT_INDEXER_TABLE}, 0, 0, ${titleWeight}, ${contentWeight}, 0)`

    try {
      const promiser = DatabaseService.getPromiser()

      // Escape single quotes for SQL
      const escapeSql = (str: string) => str.replace(/'/g, "''")
      const escapedQuery = escapeSql(formattedQuery)

      // Execute search with BM25 ranking
      // BM25 considers term frequency, inverse document frequency, and document length
      // Custom weights allow prioritizing title matches over content matches
      // Search only notes

      const searchResponse = await promiser('exec', {
        sql: `
          SELECT 
            id as uuid,
            title,
            snippet(${this.DEFAULT_INDEXER_TABLE}, 3, '<mark>', '</mark>', '...', 32) as snippet,
            ${bm25Function} as rank
          FROM ${this.DEFAULT_INDEXER_TABLE}
          WHERE type = '${ManifestEntryType.NOTE}' AND ${this.DEFAULT_INDEXER_TABLE} MATCH '${escapedQuery}'
          ORDER BY ${bm25Function}
          LIMIT ${limit} OFFSET ${offset};
        `,
        returnValue: 'resultRows',
      })

      const rows = searchResponse.result?.resultRows ?? searchResponse.resultRows ?? []
      let results: SearchResult[] = rows.map((row: any) => ({
        uuid: row.uuid ?? row[0],
        title: row.title ?? row[1],
        snippet: row.snippet ?? row[2] ?? '',
        rank: row.rank ?? row[3] ?? 0,
      }))

      // Filter results for case-sensitive matching if enabled
      if (caseSensitive) {
        // Extract search terms from the original query
        // Handle quoted phrases and individual terms
        const originalQuery = query.trim()
        const searchTerms: string[] = []

        // Extract quoted phrases first
        const quotedPhrases = originalQuery.match(/"([^"]+)"/g)
        if (quotedPhrases) {
          quotedPhrases.forEach((phrase) => {
            const cleanPhrase = phrase.replace(/"/g, '')
            if (cleanPhrase.length > 0) {
              searchTerms.push(cleanPhrase)
            }
          })
        }

        // Extract remaining terms (remove quotes, operators, and asterisks)
        const remainingQuery = originalQuery
          .replace(/"[^"]+"/g, '') // Remove quoted phrases
          .replace(/\b(AND|OR|NOT)\b/gi, '') // Remove boolean operators
          .split(/\s+/)
          .map((term) => term.replace(/\*$/, '')) // Remove trailing asterisks
          .filter((term) => term.length > 0 && !term.includes('*'))

        searchTerms.push(...remainingQuery)

        // Filter results to only include those where all terms match case-sensitively
        if (searchTerms.length > 0) {
          results = results.filter((result) => {
            // Check if all search terms appear case-sensitively in title or snippet
            return searchTerms.every((term) => {
              return result.title.includes(term) || result.snippet.includes(term)
            })
          })
        }
      }

      // Get total count (after case-sensitive filtering if applicable)
      let total: number
      if (caseSensitive) {
        // If case-sensitive, count filtered results
        total = results.length
      } else {
        const countResponse = await promiser('exec', {
          sql: `SELECT COUNT(*) as count FROM ${this.DEFAULT_INDEXER_TABLE} WHERE type = '${ManifestEntryType.NOTE}' AND ${this.DEFAULT_INDEXER_TABLE} MATCH '${escapedQuery}';`,
          returnValue: 'resultRows',
        })
        total =
          countResponse.result?.resultRows?.[0]?.count ?? countResponse.resultRows?.[0]?.count ?? 0
      }

      return {
        results,
        total,
        query,
      }
    } catch (error) {
      console.error('Error searching notes:', error, { query, options })
      throw error
    }
  }
}
