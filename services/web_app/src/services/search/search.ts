import { initializeSQLite, openDatabase, exportDatabase, closeDatabase, getPromiser } from '@/services/search/sqlite-setup'
import type { SearchResult, SearchOptions, SearchServiceResult } from '@/interfaces/search'

/**
 * SearchService handles full-text search using SQLite FTS5
 */
export default class SearchService {
  private static initialized = false
  private static readonly FEATURE_FTS_SEARCH = __APP_CONFIG__.global.featureFlags.ftsSearch

  /**
   * Initialize SQLite WASM module
   * Should be called once at application startup
   */
  static async initialize(): Promise<void> {
    if (!this.FEATURE_FTS_SEARCH) {
      return
    }

    if (this.initialized) {
      return
    }

    try {
      await initializeSQLite()
      this.initialized = true
    } catch (error) {
      throw new Error(
        `Failed to initialize search service: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Create a new search database
   */
  static async create(): Promise<string> {
    if (!this.FEATURE_FTS_SEARCH) {
      throw new Error('FTS search is disabled')
    }

    if (!this.initialized) {
      throw new Error('SearchService not initialized. Call initialize() first.')
    }

    const dbId = await openDatabase()

    // Always create FTS5 table if it doesn't exist
    const promiser = getPromiser()

    try {
      await promiser('exec', {
        dbId,
        sql: `
          CREATE VIRTUAL TABLE IF NOT EXISTS note_search USING fts5(
            uuid,
            title,
            content,
            tokenize = 'unicode61'
          );
        `,
      })
    } catch (error) {
      console.error('Error creating FTS5 table:', error)
      throw error
    }

    return dbId
  }

  /**
   * Index a note
   * Updates existing note if UUID already exists, otherwise inserts new one
   */
  static async indexNote(
    dbId: string,
    uuid: string,
    title: string,
    content: string,
  ): Promise<void> {
    if (!this.FEATURE_FTS_SEARCH) {
      return
    }

    try {
      const promiser = getPromiser()

      // Escape single quotes for SQL (basic protection)
      const escapeSql = (str: string) => str.replace(/'/g, "''")
      const escapedUuid = escapeSql(uuid)
      const escapedTitle = escapeSql(title)
      const escapedContent = escapeSql(content)

      // Check if note already exists by querying for the UUID
      const checkResponse = await promiser('exec', {
        dbId,
        sql: `SELECT rowid FROM note_search WHERE uuid = '${escapedUuid}'`,
        returnValue: 'resultRows',
      })

      const existing = checkResponse.result?.resultRows?.[0] ?? checkResponse.resultRows?.[0]

      if (existing) {
        // Update existing note
        // FTS5 UPDATE requires using rowid
        const rowid = existing.rowid ?? existing[0]
        await promiser('exec', {
          dbId,
          sql: `UPDATE note_search SET uuid = '${escapedUuid}', title = '${escapedTitle}', content = '${escapedContent}' WHERE rowid = ${rowid}`,
        })
      } else {
        // Insert new note
        await promiser('exec', {
          dbId,
          sql: `INSERT INTO note_search(uuid, title, content) VALUES ('${escapedUuid}', '${escapedTitle}', '${escapedContent}')`,
        })
      }
    } catch (error) {
      console.error('Error indexing note:', error, { uuid, title, dbId })
      throw error
    }
  }

  /**
   * Remove note from index
   */
  static async removeNote(dbId: string, uuid: string): Promise<void> {
    if (!this.FEATURE_FTS_SEARCH) {
      return
    }

    try {
      const promiser = getPromiser()

      // Escape single quotes for SQL
      const escapeSql = (str: string) => str.replace(/'/g, "''")
      const escapedUuid = escapeSql(uuid)

      // Get rowid for the UUID
      const findResponse = await promiser('exec', {
        dbId,
        sql: `SELECT rowid FROM note_search WHERE uuid = '${escapedUuid}'`,
        returnValue: 'resultRows',
      })

      const result = findResponse.result?.resultRows?.[0] ?? findResponse.resultRows?.[0]

      if (result) {
        const rowid = result.rowid ?? result[0]
        // Delete from FTS5 table using rowid
        await promiser('exec', {
          dbId,
          sql: `DELETE FROM note_search WHERE rowid = ${rowid}`,
        })
      }
    } catch (error) {
      console.error('Error removing note from index:', error, { uuid })
      throw error
    }
  }

  /**
   * Execute search query
   * Supports different search modes: normal, phrase, boolean
   */
  static async search(
    dbId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchServiceResult> {
    if (!this.FEATURE_FTS_SEARCH) {
      return { results: [], total: 0, query }
    }

    const {
      limit = 50,
      offset = 0,
      mode = 'normal',
      exact,
      operators,
      ranking,
    } = options

    // Format query based on search mode
    let formattedQuery: string
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
          const terms = booleanQuery.split(/\s+/).filter(t => t.length > 0)
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
        // Normal search: escape quotes, spaces treated as implicit AND
        formattedQuery = query.replace(/"/g, '""')
        break
    }

    // Determine ranking algorithm (defaults to BM25)
    const rankingAlgorithm = ranking?.algorithm ?? 'bm25'
    
    // Get ranking weights (defaults: title=1.0, content=1.0)
    // FTS5 bm25() function signature: bm25(table, weight1, weight2, weight3, ...)
    // Our table columns: uuid, title, content
    // We use 0 for uuid (don't weight it), then title weight, then content weight
    const titleWeight = ranking?.weights?.title ?? 1.0
    const contentWeight = ranking?.weights?.content ?? 1.0
    
    // Build BM25 function call with weights
    // bm25(note_search, uuid_weight, title_weight, content_weight)
    const bm25Function = `bm25(note_search, 0, ${titleWeight}, ${contentWeight})`

    try {
      const promiser = getPromiser()

      // Escape single quotes for SQL
      const escapeSql = (str: string) => str.replace(/'/g, "''")
      const escapedQuery = escapeSql(formattedQuery)

      // Execute search with BM25 ranking
      // BM25 considers term frequency, inverse document frequency, and document length
      // Custom weights allow prioritizing title matches over content matches

      const searchResponse = await promiser('exec', {
        dbId,
        sql: `
          SELECT 
            uuid,
            title,
            snippet(note_search, 2, '<mark>', '</mark>', '...', 32) as snippet,
            ${bm25Function} as rank
          FROM note_search
          WHERE note_search MATCH '${escapedQuery}'
          ORDER BY ${bm25Function}
          LIMIT ${limit} OFFSET ${offset};
        `,
        returnValue: 'resultRows',
      })

      const rows = searchResponse.result?.resultRows ?? searchResponse.resultRows ?? []
      const results: SearchResult[] = rows.map((row: any) => ({
        uuid: row.uuid ?? row[0],
        title: row.title ?? row[1],
        snippet: row.snippet ?? row[2] ?? '',
        rank: row.rank ?? row[3] ?? 0,
      }))

      // Get total count
      const countResponse = await promiser('exec', {
        dbId,
        sql: `SELECT COUNT(*) as count FROM note_search WHERE note_search MATCH '${escapedQuery}';`,
        returnValue: 'resultRows',
      })

      const total = countResponse.result?.resultRows?.[0]?.count ?? countResponse.resultRows?.[0]?.count ?? 0

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

  /**
   * Clear entire search index
   */
  static async clear(dbId: string): Promise<void> {
    if (!this.FEATURE_FTS_SEARCH) {
      return
    }

    const promiser = getPromiser()

    // Clear existing index
    await promiser('exec', {
      dbId,
      sql: 'DELETE FROM note_search;',
    })
  }

  /**
   * Close search index
   */
  static async close(dbId: string): Promise<void> {
    if (!this.FEATURE_FTS_SEARCH) {
      return
    }

    await closeDatabase(dbId)
  }
}
