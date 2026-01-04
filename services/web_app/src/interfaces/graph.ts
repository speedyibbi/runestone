/**
 * Graph node
 */
export interface GraphNode {
  uuid: string
  title: string
  linkCount: number // total edges
  hashtags: string[]
}

export type GraphNodeLinkType = 'markdown' | 'wiki' | 'hashtag'

/**
 * Graph edge representing a link between nodes
 */
export interface GraphEdge {
  source: string // uuid
  target: string // uuid
  linkType: GraphNodeLinkType
  linkText: string
  targetTitle?: string // resolved title for wiki links
}

/**
 * Complete graph data structure
 */
export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  hashtags: Map<string, number>
}

/**
 * Filter options for graph queries
 */
export interface GraphFilters {
  linkTypes?: GraphNodeLinkType[]
  hashtags?: string[] // include only nodes with these tags
  dateRange?: { start: string; end: string } // use manifest last_updated
  titlePattern?: string // regex or substring match
  excludeUuids?: string[] // hide specific nodes
}

/**
 * Options for graph queries
 */
export interface GraphQueryOptions {
  filters?: GraphFilters
  maxNodes?: number
  centerUuid?: string // for ego networks
  depth?: number
}

/**
 * Extracted link from markdown content
 */
export interface ExtractedLink {
  type: GraphNodeLinkType
  targetUuid?: string // resolved UUID if found
  targetTitle?: string // title for wiki links or display text
  linkText: string // display text or hashtag name
  sourceUuid: string // node containing the link
}

/**
 * Extracted hashtag
 */
export interface ExtractedHashtag {
  hashtag: string // normalized (lowercase)
  sourceUuid: string // node containing the hashtag
}
