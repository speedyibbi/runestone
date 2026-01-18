import DatabaseService from '@/services/database/db'

/**
 * Index schema definition for FTS5 tables
 */
export interface IndexSchema<T = Record<string, any>> {
  name: string
  columns: (keyof T)[]
  primaryKey: keyof T
  tokenizer?: string // defaults to 'unicode61'
}

/**
 * Index callback type
 */
export type IndexCallbackType = 'add' | 'update' | 'remove'

/**
 * Default index table data structure
 */
export interface DefaultBlobData {
  id: string // unique identifier (uuid)
  type: string // 'note', 'image', etc.
  title: string // title/name
  content: string // searchable content
  metadata?: string // optional JSON string for additional fields
}

/**
 * Default table name
 */
const DEFAULT_TABLE_NAME = 'blob_index'

/**
 * Default table schema
 */
const DEFAULT_SCHEMA: IndexSchema<DefaultBlobData> = {
  name: DEFAULT_TABLE_NAME,
  columns: ['id', 'type', 'title', 'content', 'metadata'],
  primaryKey: 'id',
  tokenizer: 'unicode61',
}

/**
 * IndexerService manages FTS5 index creation and operations
 * Supports both a default index table and custom registered indexes
 */
export default class IndexerService {
  private static indexes = new Map<string, IndexSchema>()
  private static indexCallbacks = new Map<string, Array<(data?: any) => void>>()
  private static defaultTableRegistered = false

  /**
   * Get the default index table name
   */
  static getDefaultTableName(): string {
    return DEFAULT_TABLE_NAME
  }

  /**
   * Register an index schema
   */
  static registerIndex<T = Record<string, any>>(schema: IndexSchema<T>): void {
    this.indexes.set(schema.name, schema as IndexSchema)
  }

  /**
   * Register an index callback for the default index table
   */
  static registerIndexCallback<T>(type: IndexCallbackType, callback: (data: T) => void): void
  /**
   * Register an index callback for a specific index
   */
  static registerIndexCallback<T>(
    indexName: string,
    type: IndexCallbackType,
    callback: (data: T) => void,
  ): void
  static registerIndexCallback<T>(
    indexNameOrType: string | IndexCallbackType,
    typeOrCallback: IndexCallbackType | ((data: T) => void),
    callback?: (data: T) => void,
  ): void {
    let indexName: string
    let type: IndexCallbackType
    let cb: (data: T) => void

    if (callback === undefined) {
      // First overload: (type, callback)
      indexName = DEFAULT_TABLE_NAME
      type = indexNameOrType as IndexCallbackType
      cb = typeOrCallback as (data: T) => void
    } else {
      // Second overload: (indexName, type, callback)
      indexName = indexNameOrType as string
      type = typeOrCallback as IndexCallbackType
      cb = callback
    }

    const callbacks = this.indexCallbacks.get(JSON.stringify({ indexName, type })) || []
    callbacks.push(cb)
    this.indexCallbacks.set(JSON.stringify({ indexName, type }), callbacks)
  }

  /**
   * Ensure default index table is registered
   */
  private static ensureDefaultTableRegistered(): void {
    if (!this.defaultTableRegistered) {
      this.indexes.set(DEFAULT_TABLE_NAME, DEFAULT_SCHEMA as IndexSchema)
      this.defaultTableRegistered = true
    }
  }

  /**
   * Create all registered FTS5 tables (including default if not explicitly registered)
   */
  static async createIndexes(): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    // Ensure default table is registered
    this.ensureDefaultTableRegistered()

    const promiser = DatabaseService.getPromiser()

    try {
      // Create all registered indexes
      for (const schema of this.indexes.values()) {
        const tokenizer = schema.tokenizer ?? 'unicode61'
        const columns = schema.columns.join(', ')

        await promiser('exec', {
          sql: `
            CREATE VIRTUAL TABLE IF NOT EXISTS ${schema.name} USING fts5(
              ${columns},
              tokenize = '${tokenizer}'
            );
          `,
        })
      }
    } catch (error) {
      console.error('Error creating FTS5 tables:', error)
      throw error
    }
  }

  /**
   * Escape single quotes for SQL
   */
  private static escapeSql(str: string): string {
    return str.replace(/'/g, "''")
  }

  /**
   * Get rowid for a primary key value in an index
   */
  private static async getRowid(
    indexName: string,
    primaryKey: string,
    primaryKeyValue: string,
  ): Promise<number | null> {
    const promiser = DatabaseService.getPromiser()
    const schema = this.indexes.get(indexName)

    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const escapedValue = this.escapeSql(primaryKeyValue)

    const response = await promiser('exec', {
      sql: `SELECT rowid FROM ${indexName} WHERE ${primaryKey} = '${escapedValue}'`,
      returnValue: 'resultRows',
    })

    const result = response.result?.resultRows?.[0] ?? response.resultRows?.[0]
    if (result) {
      return result.rowid ?? result[0] ?? null
    }

    return null
  }

  /**
   * Add or update a blob in the default index table (upsert behavior)
   */
  static async addBlob(data: DefaultBlobData): Promise<void>
  /**
   * Add or update a blob in a specified index (upsert behavior)
   */
  static async addBlob<T>(indexName: string, data: T): Promise<void>
  static async addBlob<T>(indexNameOrData: string | DefaultBlobData, data?: T): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    // Ensure default table is registered
    this.ensureDefaultTableRegistered()

    let indexName: string
    let blobData: any

    if (typeof indexNameOrData === 'string') {
      // Explicit table name provided
      indexName = indexNameOrData
      blobData = data
    } else {
      // Default table
      indexName = DEFAULT_TABLE_NAME
      blobData = indexNameOrData
    }

    const schema = this.indexes.get(indexName)
    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const promiser = DatabaseService.getPromiser()
    let isUpdate = false

    try {
      // Get primary key value
      const primaryKeyValue = String(blobData[schema.primaryKey])
      const escapedPrimaryKey = this.escapeSql(primaryKeyValue)

      // Check if record exists
      const rowid = await this.getRowid(indexName, schema.primaryKey, escapedPrimaryKey)

      // Build column values
      const columns: string[] = []
      const values: string[] = []

      for (const column of schema.columns) {
        const value = blobData[column]
        if (value !== undefined && value !== null) {
          columns.push(column)
          values.push(`'${this.escapeSql(String(value))}'`)
        }
      }

      const columnsStr = columns.join(', ')
      const valuesStr = values.join(', ')

      if (rowid !== null) {
        // Update existing record
        const setClause = columns.map((col, idx) => `${col} = ${values[idx]}`).join(', ')
        await promiser('exec', {
          sql: `UPDATE ${indexName} SET ${setClause} WHERE rowid = ${rowid}`,
        })
        isUpdate = true
      } else {
        // Insert new record
        await promiser('exec', {
          sql: `INSERT INTO ${indexName}(${columnsStr}) VALUES (${valuesStr})`,
        })
      }
    } catch (error) {
      console.error(`Error adding blob to index ${indexName}:`, error, { data: blobData })
      throw error
    }

    // Call all registered callbacks
    try {
      const callbacks = this.indexCallbacks.get(
        JSON.stringify({ indexName, type: isUpdate ? 'update' : 'add' }),
      )
      if (callbacks) {
        for (const callback of callbacks) {
          callback(blobData)
        }
      }
    } catch (error) {
      console.error(`Error calling callbacks for index ${indexName}:`, error)
      throw error
    }
  }

  /**
   * Remove a blob from the default index table
   */
  static async removeBlob(id: string): Promise<void>
  /**
   * Remove a blob from a specified index
   */
  static async removeBlob(indexName: string, id: string): Promise<void>
  static async removeBlob(indexNameOrId: string, id?: string): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    // Ensure default table is registered
    this.ensureDefaultTableRegistered()

    let indexName: string
    let primaryKeyValue: string

    if (id === undefined) {
      // Default table
      indexName = DEFAULT_TABLE_NAME
      primaryKeyValue = indexNameOrId
    } else {
      // Explicit table name
      indexName = indexNameOrId
      primaryKeyValue = id
    }

    const schema = this.indexes.get(indexName)
    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const promiser = DatabaseService.getPromiser()

    try {
      const rowid = await this.getRowid(indexName, schema.primaryKey, primaryKeyValue)

      if (rowid !== null) {
        await promiser('exec', {
          sql: `DELETE FROM ${indexName} WHERE rowid = ${rowid}`,
        })
      }
    } catch (error) {
      console.error(`Error removing blob from index ${indexName}:`, error, { id: primaryKeyValue })
      throw error
    }

    // Call all registered callbacks
    try {
      const callbacks = this.indexCallbacks.get(JSON.stringify({ indexName, type: 'remove' }))
      if (callbacks) {
        for (const callback of callbacks) {
          callback(primaryKeyValue)
        }
      }
    } catch (error) {
      console.error(`Error calling callbacks for index ${indexName}:`, error)
      throw error
    }
  }

  /**
   * Batch add or update blobs in the default index table (upsert behavior)
   */
  static async addBlobs(blobs: DefaultBlobData[]): Promise<void>
  /**
   * Batch add or update blobs in a specified index (upsert behavior)
   */
  static async addBlobs<T>(indexName: string, blobs: T[]): Promise<void>
  static async addBlobs<T>(
    indexNameOrBlobs: string | DefaultBlobData[],
    blobs?: T[],
  ): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    // Ensure default table is registered
    this.ensureDefaultTableRegistered()

    let indexName: string
    let blobArray: any[]

    if (typeof indexNameOrBlobs === 'string') {
      // Explicit table name provided
      indexName = indexNameOrBlobs
      blobArray = blobs || []
    } else {
      // Default table
      indexName = DEFAULT_TABLE_NAME
      blobArray = indexNameOrBlobs
    }

    if (blobArray.length === 0) {
      return
    }

    const schema = this.indexes.get(indexName)
    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const promiser = DatabaseService.getPromiser()
    let toInsert: any[] = []
    let toUpdate: Array<{ rowid: number; data: any }> = []

    try {
      // Start transaction for bulk operation
      await promiser('exec', { sql: 'BEGIN TRANSACTION;' })

      try {
        // Get all primary key values
        const primaryKeyValues = blobArray.map((blob) =>
          this.escapeSql(String(blob[schema.primaryKey])),
        )

        // Query existing rowids in bulk
        const escapedKeys = primaryKeyValues.map((key) => `'${key}'`).join(', ')
        const existingResponse = await promiser('exec', {
          sql: `SELECT rowid, ${schema.primaryKey} FROM ${indexName} WHERE ${schema.primaryKey} IN (${escapedKeys})`,
          returnValue: 'resultRows',
        })

        const existingRows =
          existingResponse.result?.resultRows ?? existingResponse.resultRows ?? []
        const existingMap = new Map<string, number>()
        for (const row of existingRows) {
          const key = row[schema.primaryKey] ?? row[1]
          const rowid = row.rowid ?? row[0]
          existingMap.set(String(key), rowid)
        }

        // Separate into inserts and updates
        toInsert = []
        toUpdate = []

        for (const blob of blobArray) {
          const primaryKeyValue = String(blob[schema.primaryKey])
          const rowid = existingMap.get(primaryKeyValue)

          if (rowid !== undefined) {
            toUpdate.push({ rowid, data: blob })
          } else {
            toInsert.push(blob)
          }
        }

        // Bulk insert new records
        if (toInsert.length > 0) {
          const columns: string[] = []
          const valueRows: string[] = []

          // Build column list from first blob (all should have same structure)
          for (const column of schema.columns) {
            if (toInsert.some((blob) => blob[column] !== undefined && blob[column] !== null)) {
              columns.push(column)
            }
          }

          // Build value rows
          for (const blob of toInsert) {
            const values = columns.map((col) => {
              const value = blob[col]
              return value !== undefined && value !== null
                ? `'${this.escapeSql(String(value))}'`
                : "''"
            })
            valueRows.push(`(${values.join(', ')})`)
          }

          if (columns.length > 0 && valueRows.length > 0) {
            const columnsStr = columns.join(', ')
            const valuesStr = valueRows.join(', ')
            await promiser('exec', {
              sql: `INSERT INTO ${indexName}(${columnsStr}) VALUES ${valuesStr}`,
            })
          }
        }

        // Update existing records (FTS5 requires rowid, so we do these individually)
        for (const { rowid, data } of toUpdate) {
          const columns: string[] = []
          const values: string[] = []

          for (const column of schema.columns) {
            const value = data[column]
            if (value !== undefined && value !== null) {
              columns.push(column)
              values.push(`'${this.escapeSql(String(value))}'`)
            }
          }

          if (columns.length > 0) {
            const setClause = columns.map((col, idx) => `${col} = ${values[idx]}`).join(', ')
            await promiser('exec', {
              sql: `UPDATE ${indexName} SET ${setClause} WHERE rowid = ${rowid}`,
            })
          }
        }

        // Commit transaction
        await promiser('exec', { sql: 'COMMIT;' })
      } catch (error) {
        // Rollback on error
        await promiser('exec', { sql: 'ROLLBACK;' })
        throw error
      }
    } catch (error) {
      console.error(`Error batch adding blobs to index ${indexName}:`, error)
      throw error
    }

    // Call all registered add callbacks
    try {
      const callbacks = this.indexCallbacks.get(JSON.stringify({ indexName, type: 'add' }))
      if (callbacks) {
        for (const callback of callbacks) {
          callback(toInsert)
        }
      }
    } catch (error) {
      console.error(`Error calling callbacks for index ${indexName}:`, error)
      throw error
    }

    // Call all registered update callbacks
    try {
      const callbacks = this.indexCallbacks.get(JSON.stringify({ indexName, type: 'update' }))
      if (callbacks) {
        for (const callback of callbacks) {
          callback(toUpdate.map(({ data }) => data))
        }
      }
    } catch (error) {
      console.error(`Error calling callbacks for index ${indexName}:`, error)
      throw error
    }
  }

  /**
   * Batch remove blobs from the default index table
   */
  static async removeBlobs(ids: string[]): Promise<void>
  /**
   * Batch remove blobs from a specified index
   */
  static async removeBlobs(indexName: string, ids: string[]): Promise<void>
  static async removeBlobs(indexNameOrIds: string | string[], ids?: string[]): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    // Ensure default table is registered
    this.ensureDefaultTableRegistered()

    let indexName: string
    let idArray: string[]

    if (ids === undefined) {
      // Default table
      indexName = DEFAULT_TABLE_NAME
      idArray = indexNameOrIds as string[]
    } else {
      // Explicit table name
      indexName = indexNameOrIds as string
      idArray = ids
    }

    if (idArray.length === 0) {
      return
    }

    const schema = this.indexes.get(indexName)
    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const promiser = DatabaseService.getPromiser()

    try {
      // Start transaction for bulk operation
      await promiser('exec', { sql: 'BEGIN TRANSACTION;' })

      try {
        // Get all rowids for the primary keys in bulk
        const escapedKeys = idArray.map((id) => `'${this.escapeSql(id)}'`).join(', ')
        const existingResponse = await promiser('exec', {
          sql: `SELECT rowid FROM ${indexName} WHERE ${schema.primaryKey} IN (${escapedKeys})`,
          returnValue: 'resultRows',
        })

        const existingRows =
          existingResponse.result?.resultRows ?? existingResponse.resultRows ?? []
        const rowids = existingRows
          .map((row: any) => row.rowid ?? row[0])
          .filter((rowid: any): rowid is number => rowid !== undefined && rowid !== null)

        // Bulk delete using IN clause
        if (rowids.length > 0) {
          const rowidList = rowids.join(', ')
          await promiser('exec', {
            sql: `DELETE FROM ${indexName} WHERE rowid IN (${rowidList})`,
          })
        }

        // Commit transaction
        await promiser('exec', { sql: 'COMMIT;' })
      } catch (error) {
        // Rollback on error
        await promiser('exec', { sql: 'ROLLBACK;' })
        throw error
      }
    } catch (error) {
      console.error(`Error batch removing blobs from index ${indexName}:`, error)
      throw error
    }

    // Call all registered callbacks
    try {
      const callbacks = this.indexCallbacks.get(JSON.stringify({ indexName, type: 'remove' }))
      if (callbacks) {
        for (const callback of callbacks) {
          callback(idArray)
        }
      }
    } catch (error) {
      console.error(`Error calling callbacks for index ${indexName}:`, error)
      throw error
    }
  }

  /**
   * Clear a specific index (defaults to index)
   */
  static async clear(indexName: string = DEFAULT_TABLE_NAME): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    const schema = this.indexes.get(indexName)
    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const promiser = DatabaseService.getPromiser()

    try {
      await promiser('exec', {
        sql: `DELETE FROM ${indexName};`,
      })
    } catch (error) {
      console.error(`Error clearing index ${indexName}:`, error)
      throw error
    }
  }

  /**
   * Clear all registered indexes
   */
  static async clearAll(): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    for (const schema of this.indexes.values()) {
      await this.clear(schema.name)
    }
  }

  /**
   * Optimize FTS5 segments for a specific index (defaults to index)
   */
  static async optimize(indexName: string = DEFAULT_TABLE_NAME): Promise<void> {
    if (!DatabaseService.isReady()) {
      return
    }

    const schema = this.indexes.get(indexName)
    if (!schema) {
      throw new Error(`Index ${indexName} not found`)
    }

    const promiser = DatabaseService.getPromiser()

    try {
      // FTS5 optimize command
      await promiser('exec', {
        sql: `INSERT INTO ${indexName}(${indexName}) VALUES('optimize');`,
      })
    } catch (error) {
      console.error(`Error optimizing index ${indexName}:`, error)
      throw error
    }
  }
}
