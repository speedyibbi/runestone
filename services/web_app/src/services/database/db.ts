// @ts-ignore - sqlite3Worker1Promiser may not be in type definitions
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm'

/**
 * SQLite Worker1 promiser instance
 * Type for the promiser function returned by sqlite3Worker1Promiser
 */
type Promiser = (command: string, args?: any) => Promise<any>

/**
 * DatabaseService manages SQLite WASM initialization and database lifecycle
 * Maintains a single active database internally - dbId is not exposed to external code
 */
export default class DatabaseService {
  private static promiser: Promiser | null = null
  private static promiserReady = false
  private static dbId: string | null = null

  /**
   * Initialize SQLite WASM worker
   */
  private static async initialize(): Promise<void> {
    if (this.promiserReady && this.promiser) {
      return
    }

    try {
      let resolved = false
      this.promiser = await new Promise<Promiser>((resolve, reject) => {
        // @ts-ignore - sqlite3Worker1Promiser may not be in type definitions
        const _promiser = sqlite3Worker1Promiser({
          onready: () => {
            resolved = true
            resolve(_promiser)
          },
        })
        // Handle initialization errors
        setTimeout(() => {
          if (!resolved) {
            reject(new Error('SQLite worker initialization timeout'))
          }
        }, 30000)
      })
      this.promiserReady = true
    } catch (error) {
      throw new Error(
        `Failed to initialize SQLite WASM: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Open a new in-memory database
   * Initializes SQLite WASM if not already initialized
   * Stores dbId internally for use by getPromiser()
   */
  static async openDatabase(): Promise<void> {
    // Initialize SQLite WASM if needed (lazy initialization)
    await this.initialize()

    if (!this.promiser) {
      throw new Error('SQLite WASM not initialized')
    }

    // Close existing database if one is open
    if (this.dbId) {
      try {
        await this.promiser('close', { dbId: this.dbId })
      } catch (error) {
        console.warn('Error closing existing database:', error)
      }
    }

    // Open new in-memory database
    const openArgs: { filename: string } = { filename: ':memory:' }
    const openResponse = await this.promiser('open', openArgs)
    const dbId = openResponse.dbId ?? openResponse.result?.dbId

    if (typeof dbId !== 'string') {
      throw new Error(
        `Failed to open database: invalid dbId in response: ${JSON.stringify(openResponse)}`,
      )
    }

    this.dbId = dbId
  }

  /**
   * Close the active database
   * Clears internal dbId
   */
  static async closeDatabase(): Promise<void> {
    if (!this.dbId || !this.promiser) {
      return
    }

    try {
      await this.promiser('close', { dbId: this.dbId })
      this.dbId = null
    } catch (error) {
      console.warn('Error closing database:', error)
      this.dbId = null
      throw error
    }
  }

  /**
   * Get the SQLite promiser instance
   * Automatically uses the internal dbId when executing queries
   * Throws if not initialized or database is not open
   */
  static getPromiser(): Promiser {
    if (!this.promiserReady || !this.promiser) {
      throw new Error('SQLite WASM not initialized. Call openDatabase() first.')
    }

    if (!this.dbId) {
      throw new Error('Database is not open. Call openDatabase() first.')
    }

    // Return a wrapper that automatically includes dbId in exec commands
    return (command: string, args?: any) => {
      if (command === 'exec' && args) {
        // Always add dbId to exec commands
        return this.promiser!(command, { ...args, dbId: this.dbId })
      }
      return this.promiser!(command, args)
    }
  }

  /**
   * Check if SQLite is initialized and database is open
   */
  static isReady(): boolean {
    return this.promiserReady && this.promiser !== null && this.dbId !== null
  }
}
