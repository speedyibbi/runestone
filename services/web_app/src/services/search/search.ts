import { initializeSQLite, getSQLiteModule, createDatabase } from './sqlite-setup'
import type { SearchResult, SearchOptions, SearchServiceResult } from '@/interfaces/search'

/**
 * SearchService handles full-text search using SQLite FTS5
 */
export default class SearchService {
  private static initialized = false

  /**
   * Initialize SQLite WASM module
   * Should be called once at application startup
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (!__APP_CONFIG__.global.featureFlags.ftsSearch) {
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
  static create(existingDbBytes?: Uint8Array): any {
    if (!__APP_CONFIG__.global.featureFlags.ftsSearch) {
      throw new Error('FTS search is disabled')
    }

    if (!this.initialized) {
      throw new Error('SearchService not initialized. Call initialize() first.')
    }

    let db: any

    if (existingDbBytes) {
      // Load database from bytes
      const sqlite3 = getSQLiteModule()
      db = new sqlite3.oo1.DB(existingDbBytes)
    } else {
      // Create new database
      db = createDatabase(':memory:')
    }

    // Create FTS5 table if it doesn't exist
    // UUID is stored as a regular column (not UNINDEXED so we can query by it)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS note_search USING fts5(
        uuid,
        title,
        content,
        tokenize = 'unicode61'
      );
    `)

    return db
  }

  /**
   * Index a note
   * Updates existing note if UUID already exists, otherwise inserts new one
   */
  static indexNote(db: any, uuid: string, title: string, content: string): void {
    if (!__APP_CONFIG__.global.featureFlags.ftsSearch) {
      return
    }

    // Check if note already exists by querying for the UUID
    const checkStmt = db.prepare('SELECT rowid FROM note_search WHERE uuid = ?')
    checkStmt.bind([uuid])
    const existing = checkStmt.step() ? checkStmt.get({}) : null
    checkStmt.finalize()

    if (existing) {
      // Update existing note
      // FTS5 UPDATE requires using rowid
      const rowid = existing.rowid
      const updateStmt = db.prepare(`
        UPDATE note_search SET uuid = ?, title = ?, content = ? WHERE rowid = ?
      `)
      updateStmt.bind([uuid, title, content, rowid]).step()
      updateStmt.finalize()
    } else {
      // Insert new note
      const insertStmt = db.prepare(`
        INSERT INTO note_search(uuid, title, content)
        VALUES (?, ?, ?)
      `)
      insertStmt.bind([uuid, title, content]).step()
      insertStmt.finalize()
    }
  }

  /**
   * Remove note from index
   */
  static removeNote(db: any, uuid: string): void {
    if (!__APP_CONFIG__.global.featureFlags.ftsSearch) {
      return
    }

    // Get rowid for the UUID
    const findStmt = db.prepare('SELECT rowid FROM note_search WHERE uuid = ?')
    findStmt.bind([uuid])
    const result = findStmt.step() ? findStmt.get({}) : null
    findStmt.finalize()

    if (result) {
      const rowid = result.rowid
      // Delete from FTS5 table using rowid
      const deleteStmt = db.prepare('DELETE FROM note_search WHERE rowid = ?')
      deleteStmt.bind([rowid]).step()
      deleteStmt.finalize()
    }
  }

  /**
   * Execute search query
   * Supports different search modes: normal, phrase, boolean
   * Uses BM25 ranking for better relevance scoring
   */
  static search(
    db: any,
    query: string,
    options: SearchOptions = {},
  ): SearchServiceResult {
    if (!__APP_CONFIG__.global.featureFlags.ftsSearch) {
      return { results: [], total: 0, query }
    }

    const { limit = 50, offset = 0, mode = 'normal' } = options

    // Format query based on search mode
    let formattedQuery: string
    switch (mode) {
      case 'phrase':
        // Wrap in quotes for exact phrase matching
        const escapedPhrase = query.replace(/"/g, '""')
        formattedQuery = `"${escapedPhrase}"`
        break
      case 'boolean':
        // Normalize boolean operators to uppercase for FTS5
        formattedQuery = query
          .replace(/\b(and|AND)\b/g, 'AND')
          .replace(/\b(or|OR)\b/g, 'OR')
          .replace(/\b(not|NOT)\b/g, 'NOT')
          .replace(/"/g, '""')
        break
      case 'normal':
      default:
        // Normal search: escape quotes, spaces treated as implicit AND
        formattedQuery = query.replace(/"/g, '""')
        break
    }

    // Execute search with BM25 ranking (for better relevance)
    // BM25 considers term frequency, inverse document frequency, and document length
    const stmt = db.prepare(`
      SELECT 
        uuid,
        title,
        snippet(note_search, 2, '<mark>', '</mark>', '...', 32) as snippet,
        bm25(note_search) as rank
      FROM note_search
      WHERE note_search MATCH ?
      ORDER BY bm25(note_search)
      LIMIT ? OFFSET ?;
    `)

    const results: SearchResult[] = []
    stmt.bind([formattedQuery, limit, offset])

    while (stmt.step()) {
      const row = stmt.get({})
      results.push({
        uuid: row.uuid,
        title: row.title,
        snippet: row.snippet || '',
        rank: row.rank || 0,
      })
    }

    stmt.finalize()

    // Get total count
    const countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM note_search
      WHERE note_search MATCH ?;
    `)

    countStmt.bind([formattedQuery])
    countStmt.step()
    const total = countStmt.get({}).count || 0
    countStmt.finalize()

    return {
      results,
      total,
      query,
    }
  }

  /**
   * Clear entire search index
   */
  static clear(db: any): void {
    if (!__APP_CONFIG__.global.featureFlags.ftsSearch) {
      return
    }

    // Clear existing index
    db.exec('DELETE FROM note_search;')
  }
}
