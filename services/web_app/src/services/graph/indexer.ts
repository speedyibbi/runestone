import DatabaseService from '@/services/database/db'
import IndexerService, { type DefaultBlobData } from '@/services/database/indexer'
import LinkExtractorService, {
  type TitleToUuidResolver,
  type UuidToTitleResolver,
} from '@/services/graph/link-extractor'

/**
 * GraphIndexer manages graph relationships between notes
 * Uses SQLite WASM in-memory tables to store nodes, edges, and hashtags
 * Registers callbacks on IndexerService to automatically update graph
 * Uses the default indexer table to resolve note titles and UUIDs
 */
export default class GraphIndexerService {
  private static indexingInProgress = new Set<string>()
  private static pendingIndexOperations = new Map<string, { title: string; content: string }>()
  private static readonly DEFAULT_INDEXER_TABLE = 'blob_index'

  /**
   * Initialize graph tables and register callbacks
   */
  static async initialize(): Promise<void> {
    if (!DatabaseService.isReady()) {
      throw new Error('Database is not ready')
    }

    // Create graph tables
    await this.createGraphTables()

    // Register callbacks on the default indexer table (using overload without indexName)
    IndexerService.registerIndexCallback<DefaultBlobData>('add', async (data) => {
      // Handle both single ID and array of IDs (from batch operations)
      const ids = Array.isArray(data) ? data : [data]

      for (const id of ids) {
        if (id.type !== 'note') {
          continue // Only index notes
        }

        try {
          await this.indexNode(id.id, id.title, id.content)
        } catch (error) {
          console.error('Error indexing graph for added blob:', error)
        }
      }
    })

    IndexerService.registerIndexCallback<DefaultBlobData>('update', async (data) => {
      // Handle both single ID and array of IDs (from batch operations)
      const ids = Array.isArray(data) ? data : [data]

      for (const id of ids) {
        if (id.type !== 'note') {
          continue // Only index notes
        }

        try {
          await this.indexNode(id.id, id.title, id.content)
        } catch (error) {
          console.error('Error updating graph for updated blob:', error)
        }
      }
    })

    IndexerService.registerIndexCallback<string | string[]>('remove', async (idOrIds) => {
      // Handle both single ID and array of IDs (from batch operations)
      const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]

      for (const id of ids) {
        try {
          await this.removeNode(id)
        } catch (error) {
          console.error('Error removing graph node for removed blob:', error)
        }
      }
    })
  }

  /**
   * Resolve note title to UUID by querying the default indexer table
   */
  private static async resolveTitleToUuid(title: string): Promise<string | null> {
    if (!DatabaseService.isReady()) {
      return null
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const response = await promiser('exec', {
        sql: `
          SELECT id FROM ${this.DEFAULT_INDEXER_TABLE}
          WHERE type = 'note' AND title = '${this.escapeSql(title)}'
          LIMIT 1
        `,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []
      if (rows.length > 0) {
        const row = rows[0]
        return row.id ?? row[0] ?? null
      }

      return null
    } catch (error) {
      console.error(`Error resolving title to UUID for "${title}":`, error)
      return null
    }
  }

  /**
   * Resolve note UUID to title by querying the default indexer table
   */
  private static async resolveUuidToTitle(uuid: string): Promise<string | null> {
    if (!DatabaseService.isReady()) {
      return null
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const response = await promiser('exec', {
        sql: `
          SELECT title FROM ${this.DEFAULT_INDEXER_TABLE}
          WHERE type = 'note' AND id = '${this.escapeSql(uuid)}'
          LIMIT 1
        `,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []
      if (rows.length > 0) {
        const row = rows[0]
        return row.title ?? row[0] ?? null
      }

      return null
    } catch (error) {
      console.error(`Error resolving UUID to title for "${uuid}":`, error)
      return null
    }
  }

  /**
   * Create graph tables
   */
  private static async createGraphTables(): Promise<void> {
    const promiser = DatabaseService.getPromiser()

    try {
      // Create graph_nodes table
      await promiser('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS graph_nodes (
            uuid TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            last_indexed TEXT NOT NULL
          );
        `,
      })

      // Create graph_edges table
      await promiser('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS graph_edges (
            source_uuid TEXT NOT NULL,
            target_uuid TEXT NOT NULL,
            link_type TEXT NOT NULL,
            link_text TEXT NOT NULL,
            target_title TEXT,
            PRIMARY KEY (source_uuid, target_uuid, link_type, link_text)
          );
        `,
      })

      // Create index on target_uuid for efficient backlink queries
      await promiser('exec', {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_uuid);
        `,
      })

      // Create graph_hashtags table
      await promiser('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS graph_hashtags (
            hashtag TEXT PRIMARY KEY,
            count INTEGER NOT NULL DEFAULT 0
          );
        `,
      })

      // Create junction table for note-hashtag relationships
      await promiser('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS graph_note_hashtags (
            note_uuid TEXT NOT NULL,
            hashtag TEXT NOT NULL,
            PRIMARY KEY (note_uuid, hashtag)
          );
        `,
      })
    } catch (error) {
      console.error('Error creating graph tables:', error)
      throw error
    }
  }

  /**
   * Index a note node and extract all links/hashtags
   */
  static async indexNode(uuid: string, title: string, content: string): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    // If already indexing, queue this update
    if (this.indexingInProgress.has(uuid)) {
      this.pendingIndexOperations.set(uuid, { title, content })
      return
    }

    this.indexingInProgress.add(uuid)

    // Process indexing, and re-process if there are pending updates
    while (true) {
      // Get the latest data (may have been updated while we were processing)
      const latestData = this.pendingIndexOperations.get(uuid)
      if (latestData) {
        // Use the latest data
        title = latestData.title
        content = latestData.content
        this.pendingIndexOperations.delete(uuid)
      }

      const promiser = DatabaseService.getPromiser()
      const now = new Date().toISOString()

      try {
        // Remove existing edges
      await promiser('exec', {
        sql: `DELETE FROM graph_edges WHERE source_uuid = '${this.escapeSql(uuid)}';`,
      })

      // Remove hashtag relationships
      const hashtagResponse = await promiser('exec', {
        sql: `SELECT hashtag FROM graph_note_hashtags WHERE note_uuid = '${this.escapeSql(uuid)}'`,
        returnValue: 'resultRows',
      })

      const hashtagRows = hashtagResponse.result?.resultRows ?? hashtagResponse.resultRows ?? []

      for (const row of hashtagRows) {
        const hashtag = row.hashtag ?? row[0]
        if (hashtag) {
          // Decrement count
          const countResponse = await promiser('exec', {
            sql: `SELECT count FROM graph_hashtags WHERE hashtag = '${this.escapeSql(hashtag)}'`,
            returnValue: 'resultRows',
          })

          const countRows = countResponse.result?.resultRows ?? countResponse.resultRows ?? []
          const currentCount = countRows[0]?.count ?? countRows[0]?.[0] ?? 0

          if (currentCount > 1) {
            await promiser('exec', {
              sql: `
                UPDATE graph_hashtags SET count = ${currentCount - 1}
                WHERE hashtag = '${this.escapeSql(hashtag)}'
              `,
            })
          } else {
            // Remove hashtag if count reaches 0
            await promiser('exec', {
              sql: `DELETE FROM graph_hashtags WHERE hashtag = '${this.escapeSql(hashtag)}'`,
            })
          }
        }
      }

      await promiser('exec', {
        sql: `DELETE FROM graph_note_hashtags WHERE note_uuid = '${this.escapeSql(uuid)}';`,
      })

      // Upsert node
      await promiser('exec', {
        sql: `
          INSERT OR REPLACE INTO graph_nodes (uuid, title, last_indexed)
          VALUES ('${this.escapeSql(uuid)}', '${this.escapeSql(title)}', '${now}')
        `,
      })

      // Create resolver functions
      const resolveTitleToUuid: TitleToUuidResolver = (title: string) =>
        this.resolveTitleToUuid(title)
      const resolveUuidToTitle: UuidToTitleResolver = (uuid: string) =>
        this.resolveUuidToTitle(uuid)

      // Extract links and hashtags
      const { links, hashtags } = await LinkExtractorService.extract(
        uuid,
        content,
        resolveTitleToUuid,
        resolveUuidToTitle,
      )

      // Insert edges
      for (const link of links) {
        if (link.targetUuid) {
          // Only create edge if target UUID exists
          await promiser('exec', {
            sql: `
              INSERT OR REPLACE INTO graph_edges 
              (source_uuid, target_uuid, link_type, link_text, target_title)
              VALUES (
                '${this.escapeSql(link.sourceUuid)}',
                '${this.escapeSql(link.targetUuid)}',
                '${this.escapeSql(link.type)}',
                '${this.escapeSql(link.linkText)}',
                ${link.targetTitle ? `'${this.escapeSql(link.targetTitle)}'` : 'NULL'}
              )
            `,
          })
        }
      }

      // Update hashtags
      for (const tag of hashtags) {
        // Track note-hashtag relationship
        await promiser('exec', {
          sql: `
            INSERT OR REPLACE INTO graph_note_hashtags (note_uuid, hashtag)
            VALUES ('${this.escapeSql(uuid)}', '${this.escapeSql(tag.hashtag)}')
          `,
        })
      }

      // Update hashtag counts
      for (const tag of hashtags) {
        // Get current count
        const currentResponse = await promiser('exec', {
          sql: `SELECT count FROM graph_hashtags WHERE hashtag = '${this.escapeSql(tag.hashtag)}'`,
          returnValue: 'resultRows',
        })

        const currentRows = currentResponse.result?.resultRows ?? currentResponse.resultRows ?? []
        const currentCount = currentRows[0]?.count ?? currentRows[0]?.[0] ?? 0

        // Update count
        await promiser('exec', {
          sql: `
            INSERT OR REPLACE INTO graph_hashtags (hashtag, count)
            VALUES ('${this.escapeSql(tag.hashtag)}', ${currentCount + 1})
          `,
        })
      }
      } catch (error) {
        console.error(`Error indexing graph node ${uuid}:`, error)
        throw error
      }

      // Check if there's a newer pending update
      if (!this.pendingIndexOperations.has(uuid)) {
        break
      }
    }

    this.indexingInProgress.delete(uuid)
  }

  /**
   * Remove a node and all its edges
   */
  static async removeNode(uuid: string): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    if (this.indexingInProgress.has(uuid)) {
      return
    }

    this.indexingInProgress.add(uuid)

    const promiser = DatabaseService.getPromiser()

    try {
      // Remove edges where this node is source
      await promiser('exec', {
        sql: `DELETE FROM graph_edges WHERE source_uuid = '${this.escapeSql(uuid)}';`,
      })

      // Remove edges where this node is target
      await promiser('exec', {
        sql: `DELETE FROM graph_edges WHERE target_uuid = '${this.escapeSql(uuid)}';`,
      })

      // Remove hashtag relationships
      const hashtagResponse = await promiser('exec', {
        sql: `SELECT hashtag FROM graph_note_hashtags WHERE note_uuid = '${this.escapeSql(uuid)}'`,
        returnValue: 'resultRows',
      })

      const hashtagRows = hashtagResponse.result?.resultRows ?? hashtagResponse.resultRows ?? []

      for (const row of hashtagRows) {
        const hashtag = row.hashtag ?? row[0]
        if (hashtag) {
          // Decrement count
          const countResponse = await promiser('exec', {
            sql: `SELECT count FROM graph_hashtags WHERE hashtag = '${this.escapeSql(hashtag)}'`,
            returnValue: 'resultRows',
          })

          const countRows = countResponse.result?.resultRows ?? countResponse.resultRows ?? []
          const currentCount = countRows[0]?.count ?? countRows[0]?.[0] ?? 0

          if (currentCount > 1) {
            await promiser('exec', {
              sql: `
                UPDATE graph_hashtags SET count = ${currentCount - 1}
                WHERE hashtag = '${this.escapeSql(hashtag)}'
              `,
            })
          } else {
            // Remove hashtag if count reaches 0
            await promiser('exec', {
              sql: `DELETE FROM graph_hashtags WHERE hashtag = '${this.escapeSql(hashtag)}'`,
            })
          }
        }
      }

      await promiser('exec', {
        sql: `DELETE FROM graph_note_hashtags WHERE note_uuid = '${this.escapeSql(uuid)}';`,
      })

      // Remove node
      await promiser('exec', {
        sql: `DELETE FROM graph_nodes WHERE uuid = '${this.escapeSql(uuid)}';`,
      })
    } catch (error) {
      console.error(`Error removing graph node ${uuid}:`, error)
      throw error
    } finally {
      this.indexingInProgress.delete(uuid)
    }
  }

  /**
   * Get backlinks (edges pointing to this node)
   */
  static async getBacklinks(
    uuid: string,
  ): Promise<Array<{ source: string; linkType: string; linkText: string }>> {
    if (!DatabaseService.isReady()) {
      return []
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const response = await promiser('exec', {
        sql: `
          SELECT source_uuid, link_type, link_text
          FROM graph_edges
          WHERE target_uuid = '${this.escapeSql(uuid)}'
        `,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []
      return rows.map((row: any) => ({
        source: row.source_uuid ?? row[0],
        linkType: row.link_type ?? row[1],
        linkText: row.link_text ?? row[2],
      }))
    } catch (error) {
      console.error(`Error getting backlinks for ${uuid}:`, error)
      return []
    }
  }

  /**
   * Get outlinks (edges from this node)
   */
  static async getOutlinks(
    uuid: string,
  ): Promise<Array<{ target: string; linkType: string; linkText: string }>> {
    if (!DatabaseService.isReady()) {
      return []
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const response = await promiser('exec', {
        sql: `
          SELECT target_uuid, link_type, link_text
          FROM graph_edges
          WHERE source_uuid = '${this.escapeSql(uuid)}'
        `,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []
      return rows.map((row: any) => ({
        target: row.target_uuid ?? row[0],
        linkType: row.link_type ?? row[1],
        linkText: row.link_text ?? row[2],
      }))
    } catch (error) {
      console.error(`Error getting outlinks for ${uuid}:`, error)
      return []
    }
  }

  /**
   * Get all connected nodes (BFS traversal)
   */
  static async getConnectedNodes(uuid: string, depth: number = 1): Promise<string[]> {
    if (!DatabaseService.isReady()) {
      return []
    }

    const visited = new Set<string>([uuid])
    const queue: Array<{ uuid: string; depth: number }> = [{ uuid, depth: 0 }]
    const connected: string[] = []

    while (queue.length > 0) {
      const { uuid: currentUuid, depth: currentDepth } = queue.shift()!

      if (currentDepth >= depth) {
        continue
      }

      const outlinks = await this.getOutlinks(currentUuid)
      for (const link of outlinks) {
        if (!visited.has(link.target)) {
          visited.add(link.target)
          connected.push(link.target)
          queue.push({ uuid: link.target, depth: currentDepth + 1 })
        }
      }

      const backlinks = await this.getBacklinks(currentUuid)
      for (const link of backlinks) {
        if (!visited.has(link.source)) {
          visited.add(link.source)
          connected.push(link.source)
          queue.push({ uuid: link.source, depth: currentDepth + 1 })
        }
      }
    }

    return connected
  }

  /**
   * Get notes by hashtag
   */
  static async getNotesByHashtag(hashtag: string): Promise<string[]> {
    if (!DatabaseService.isReady()) {
      return []
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const response = await promiser('exec', {
        sql: `
          SELECT note_uuid
          FROM graph_note_hashtags
          WHERE hashtag = '${this.escapeSql(hashtag.toLowerCase())}'
        `,
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []
      return rows.map((row: any) => row.note_uuid ?? row[0])
    } catch (error) {
      console.error(`Error getting notes by hashtag ${hashtag}:`, error)
      return []
    }
  }

  /**
   * Get all hashtags with counts
   */
  static async getAllHashtags(): Promise<Map<string, number>> {
    if (!DatabaseService.isReady()) {
      return new Map()
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const response = await promiser('exec', {
        sql: 'SELECT hashtag, count FROM graph_hashtags ORDER BY count DESC',
        returnValue: 'resultRows',
      })

      const rows = response.result?.resultRows ?? response.resultRows ?? []
      const hashtags = new Map<string, number>()

      for (const row of rows) {
        const hashtag = row.hashtag ?? row[0]
        const count = row.count ?? row[1]
        if (hashtag) {
          hashtags.set(hashtag, count ?? 0)
        }
      }

      return hashtags
    } catch (error) {
      console.error('Error getting all hashtags:', error)
      return new Map()
    }
  }

  /**
   * Clear all graph data
   */
  static async clear(): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    const promiser = DatabaseService.getPromiser()

    try {
      await promiser('exec', { sql: 'DELETE FROM graph_edges;' })
      await promiser('exec', { sql: 'DELETE FROM graph_nodes;' })
      await promiser('exec', { sql: 'DELETE FROM graph_hashtags;' })
      await promiser('exec', { sql: 'DELETE FROM graph_note_hashtags;' })
    } catch (error) {
      console.error('Error clearing graph:', error)
      throw error
    }
  }

  /**
   * Escape single quotes for SQL
   */
  private static escapeSql(str: string): string {
    return str.replace(/'/g, "''")
  }
}
