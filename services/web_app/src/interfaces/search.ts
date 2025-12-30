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
 * Search configuration options
 */
export interface SearchOptions {
  limit?: number
  offset?: number
  highlight?: boolean
  mode?: SearchMode
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

/**
 * Placeholder interface for future phrase search
 */
export interface PhraseSearchOptions extends SearchOptions {
  exact?: boolean
}

/**
 * Placeholder interface for future boolean search
 */
export interface BooleanSearchOptions extends SearchOptions {
  operators?: 'AND' | 'OR' | 'NOT'
}

/**
 * Placeholder interface for future ranking options
 */
export interface RankingOptions {
  algorithm?: 'bm25' | 'rank' | 'custom'
  weights?: {
    title?: number
    content?: number
  }
}
