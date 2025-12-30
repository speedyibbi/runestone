import sqlite3InitModule from '@sqlite.org/sqlite-wasm'

/**
 * SQLite WASM module instance
 */
let sqlite3: any = null
let sqlite3Ready = false

/**
 * Initialize SQLite WASM module
 * Must be called before creating any database instances
 */
export async function initializeSQLite(): Promise<void> {
  if (sqlite3Ready && sqlite3) {
    return
  }

  try {
    sqlite3 = await sqlite3InitModule({
      print: console.log,
      printErr: console.error,
    })
    sqlite3Ready = true
  } catch (error) {
    throw new Error(
      `Failed to initialize SQLite WASM: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Get the SQLite module instance
 * Throws if not initialized
 */
export function getSQLiteModule(): any {
  if (!sqlite3Ready || !sqlite3) {
    throw new Error('SQLite WASM not initialized. Call initializeSQLite() first.')
  }
  return sqlite3
}

/**
 * Create a new SQLite database instance
 */
export function createDatabase(filename: string = ':memory:'): any {
  const sqlite3 = getSQLiteModule()
  return new sqlite3.oo1.DB(filename, 'c')
}

/**
 * Check if SQLite is ready
 */
export function isSQLiteReady(): boolean {
  return sqlite3Ready && sqlite3 !== null
}
