/**
 * Search result for a single note
 */
export interface SearchResult {
  uuid: string
  title: string
  snippet: string
  rank: number
}

/**
 * Search mode type
 */
export type SearchMode = 'normal' | 'phrase' | 'boolean'

/**
 * Ranking algorithm type
 * Currently only 'bm25' is supported (FTS5 native)
 */
export type RankingAlgorithm = 'bm25'

/**
 * Search configuration options
 */
export interface SearchOptions {
  limit?: number
  offset?: number
  highlight?: boolean
  mode?: SearchMode
  // Phrase search options
  exact?: boolean // For phrase mode: require exact phrase match
  // Boolean search options
  operators?: 'AND' | 'OR' | 'NOT' // Preferred operator for boolean mode
  // Case sensitivity
  caseSensitive?: boolean // Whether to match case (default: false)
  // Ranking options
  ranking?: {
    algorithm?: RankingAlgorithm
    weights?: {
      title?: number // Weight for title matches
      content?: number // Weight for content matches
    }
  }
}

/**
 * Service-level search result wrapper
 */
export interface SearchServiceResult {
  results: SearchResult[]
  total: number
  query: string
}

/**
 * Options for index updates
 */
export interface IndexUpdateOptions {
  notebookId: string
  uuid: string
  title: string
  content: string
}
