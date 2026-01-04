import DatabaseService from '@/services/database/db'
import GraphIndexer from '@/services/graph/indexer'
import type {
  GraphNode,
  GraphEdge,
  GraphData,
  GraphFilters,
  GraphQueryOptions,
} from '@/interfaces/graph'

/**
 * GraphService provides high-level graph query APIs with filtering
 */
export default class GraphService {
  /**
   * Initialize graph tables and register callbacks
   */
  static async register(): Promise<void> {
    if (!DatabaseService.isReady()) {
      throw new Error('Database is not ready')
    }

    await GraphIndexer.initialize()
  }

  /**
   * Get full graph or subgraph with filters
   */
  static async getGraph(options: GraphQueryOptions = {}): Promise<GraphData> {
    if (!DatabaseService.isReady()) {
      return { nodes: [], edges: [], hashtags: new Map() }
    }

    const { filters, maxNodes, centerUuid, depth } = options
    const promiser = DatabaseService.getPromiser()

    try {
      // Get all nodes
      let nodesQuery = 'SELECT uuid, title FROM graph_nodes'
      const nodeConditions: string[] = []

      // Apply filters
      if (filters) {
        if (filters.excludeUuids && filters.excludeUuids.length > 0) {
          const excluded = filters.excludeUuids.map((id) => `'${this.escapeSql(id)}'`).join(', ')
          nodeConditions.push(`uuid NOT IN (${excluded})`)
        }

        if (filters.titlePattern) {
          nodeConditions.push(`title LIKE '%${this.escapeSql(filters.titlePattern)}%'`)
        }

        if (filters.hashtags && filters.hashtags.length > 0) {
          const hashtagList = filters.hashtags
            .map((tag) => `'${this.escapeSql(tag.toLowerCase())}'`)
            .join(', ')
          nodeConditions.push(
            `uuid IN (SELECT note_uuid FROM graph_note_hashtags WHERE hashtag IN (${hashtagList}))`,
          )
        }
      }

      if (nodeConditions.length > 0) {
        nodesQuery += ' WHERE ' + nodeConditions.join(' AND ')
      }

      if (maxNodes) {
        nodesQuery += ` LIMIT ${maxNodes}`
      }

      const nodesResponse = await promiser('exec', {
        sql: nodesQuery,
        returnValue: 'resultRows',
      })

      const nodeRows = nodesResponse.result?.resultRows ?? nodesResponse.resultRows ?? []
      const nodeUuids = new Set(nodeRows.map((row: any) => row.uuid ?? row[0]))

      // If centerUuid is specified, get neighborhood
      if (centerUuid && depth !== undefined) {
        const connected = await GraphIndexer.getConnectedNodes(centerUuid, depth)
        connected.push(centerUuid) // Include center node
        const connectedSet = new Set(connected)
        // Filter nodes to only include connected ones
        const filteredRows = nodeRows.filter((row: any) => {
          const uuid = row.uuid ?? row[0]
          return connectedSet.has(uuid)
        })
        nodeRows.length = 0
        nodeRows.push(...filteredRows)
        nodeUuids.clear()
        connected.forEach((uuid) => nodeUuids.add(uuid))
      }

      // Get edges for filtered nodes
      if (nodeUuids.size === 0) {
        return { nodes: [], edges: [], hashtags: new Map() }
      }

      const nodeUuidArray = Array.from(nodeUuids) as string[]
      let edgesQuery = `
        SELECT source_uuid, target_uuid, link_type, link_text, target_title
        FROM graph_edges
        WHERE source_uuid IN (${nodeUuidArray.map((uuid) => `'${this.escapeSql(uuid)}'`).join(', ')})
        AND target_uuid IN (${nodeUuidArray.map((uuid) => `'${this.escapeSql(uuid)}'`).join(', ')})
      `

      if (filters?.linkTypes && filters.linkTypes.length > 0) {
        const linkTypes = filters.linkTypes.map((type) => `'${this.escapeSql(type)}'`).join(', ')
        edgesQuery += ` AND link_type IN (${linkTypes})`
      }

      const edgesResponse = await promiser('exec', {
        sql: edgesQuery,
        returnValue: 'resultRows',
      })

      const edgeRows = edgesResponse.result?.resultRows ?? edgesResponse.resultRows ?? []

      // Build nodes with link counts and hashtags
      const nodes: GraphNode[] = []
      for (const row of nodeRows) {
        const uuid = row.uuid ?? row[0]
        const title = row.title ?? row[1]

        // Count edges
        const outlinkCount = edgeRows.filter((e: any) => (e.source_uuid ?? e[0]) === uuid).length
        const backlinkCount = edgeRows.filter((e: any) => (e.target_uuid ?? e[1]) === uuid).length

        // Get hashtags for this node
        const hashtagsResponse = await promiser('exec', {
          sql: `SELECT hashtag FROM graph_note_hashtags WHERE note_uuid = '${this.escapeSql(uuid)}'`,
          returnValue: 'resultRows',
        })

        const hashtagRows = hashtagsResponse.result?.resultRows ?? hashtagsResponse.resultRows ?? []
        const hashtags = hashtagRows.map((h: any) => h.hashtag ?? h[0])

        nodes.push({
          uuid,
          title,
          linkCount: outlinkCount + backlinkCount,
          hashtags,
        })
      }

      // Build edges
      const edges: GraphEdge[] = edgeRows.map((row: any) => ({
        source: row.source_uuid ?? row[0],
        target: row.target_uuid ?? row[1],
        linkType: row.link_type ?? row[2],
        linkText: row.link_text ?? row[3],
        targetTitle: row.target_title ?? row[4],
      }))

      // Get all hashtags
      const hashtags = await GraphIndexer.getAllHashtags()

      return { nodes, edges, hashtags }
    } catch (error) {
      console.error('Error getting graph:', error)
      return { nodes: [], edges: [], hashtags: new Map() }
    }
  }

  /**
   * Get ego network (neighborhood) around a node
   */
  static async getNodeNeighborhood(
    uuid: string,
    depth: number = 1,
    filters?: GraphFilters,
  ): Promise<GraphData> {
    return this.getGraph({
      centerUuid: uuid,
      depth,
      filters,
    })
  }

  /**
   * Get shortest path between two nodes (BFS)
   */
  static async getShortestPath(fromUuid: string, toUuid: string): Promise<string[]> {
    if (!DatabaseService.isReady()) {
      return []
    }

    if (fromUuid === toUuid) {
      return [fromUuid]
    }

    const visited = new Set<string>([fromUuid])
    const queue: Array<{ uuid: string; path: string[] }> = [{ uuid: fromUuid, path: [fromUuid] }]

    while (queue.length > 0) {
      const { uuid: currentUuid, path } = queue.shift()!

      // Get all connected nodes (both directions)
      const outlinks = await GraphIndexer.getOutlinks(currentUuid)
      const backlinks = await GraphIndexer.getBacklinks(currentUuid)

      const neighbors = [...outlinks.map((l) => l.target), ...backlinks.map((l) => l.source)]

      for (const neighbor of neighbors) {
        if (neighbor === toUuid) {
          return [...path, neighbor]
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({ uuid: neighbor, path: [...path, neighbor] })
        }
      }
    }

    return [] // No path found
  }

  /**
   * Get orphan nodes (nodes with no links)
   */
  static async getOrphanNodes(filters?: GraphFilters): Promise<GraphNode[]> {
    if (!DatabaseService.isReady()) {
      return []
    }

    const promiser = DatabaseService.getPromiser()

    try {
      let query = `
        SELECT n.uuid, n.title
        FROM graph_nodes n
        LEFT JOIN graph_edges e1 ON n.uuid = e1.source_uuid
        LEFT JOIN graph_edges e2 ON n.uuid = e2.target_uuid
        WHERE e1.source_uuid IS NULL AND e2.target_uuid IS NULL
      `

      const conditions: string[] = []

      if (filters) {
        if (filters.excludeUuids && filters.excludeUuids.length > 0) {
          const excluded = filters.excludeUuids.map((id) => `'${this.escapeSql(id)}'`).join(', ')
          conditions.push(`n.uuid NOT IN (${excluded})`)
        }

        if (filters.titlePattern) {
          conditions.push(`n.title LIKE '%${this.escapeSql(filters.titlePattern)}%'`)
        }
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ')
      }

      const response = await promiser('exec', {
        sql: query,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []

      return rows.map((row: any) => ({
        uuid: row.uuid ?? row[0],
        title: row.title ?? row[1],
        linkCount: 0,
        hashtags: [],
      }))
    } catch (error) {
      console.error('Error getting orphan nodes:', error)
      return []
    }
  }

  /**
   * Get hub nodes (highly connected nodes)
   */
  static async getHubNodes(
    minConnections: number = 5,
    filters?: GraphFilters,
  ): Promise<GraphNode[]> {
    if (!DatabaseService.isReady()) {
      return []
    }

    const promiser = DatabaseService.getPromiser()

    try {
      let query = `
        SELECT n.uuid, n.title,
               (SELECT COUNT(*) FROM graph_edges WHERE source_uuid = n.uuid) +
               (SELECT COUNT(*) FROM graph_edges WHERE target_uuid = n.uuid) as link_count
        FROM graph_nodes n
        HAVING link_count >= ${minConnections}
      `

      const conditions: string[] = []

      if (filters) {
        if (filters.excludeUuids && filters.excludeUuids.length > 0) {
          const excluded = filters.excludeUuids.map((id) => `'${this.escapeSql(id)}'`).join(', ')
          conditions.push(`n.uuid NOT IN (${excluded})`)
        }

        if (filters.titlePattern) {
          conditions.push(`n.title LIKE '%${this.escapeSql(filters.titlePattern)}%'`)
        }
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ')
      }

      query += ' ORDER BY link_count DESC'

      const response = await promiser('exec', {
        sql: query,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []

      // Get hashtags for each node
      const nodes: GraphNode[] = []
      for (const row of rows) {
        const uuid = row.uuid ?? row[0]
        const hashtagsResponse = await promiser('exec', {
          sql: `SELECT hashtag FROM graph_note_hashtags WHERE note_uuid = '${this.escapeSql(uuid)}'`,
          returnValue: 'resultRows',
        })

        const hashtagRows = hashtagsResponse.result?.resultRows ?? hashtagsResponse.resultRows ?? []
        const hashtags = hashtagRows.map((h: any) => h.hashtag ?? h[0])

        nodes.push({
          uuid,
          title: row.title ?? row[1],
          linkCount: row.link_count ?? row[2],
          hashtags,
        })
      }

      return nodes
    } catch (error) {
      console.error('Error getting hub nodes:', error)
      return []
    }
  }

  /**
   * Escape single quotes for SQL
   */
  private static escapeSql(str: string): string {
    return str.replace(/'/g, "''")
  }
}
