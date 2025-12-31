// @ts-ignore - sqlite3Worker1Promiser may not be in type definitions
import { sqlite3Worker1Promiser } from '@sqlite.org/sqlite-wasm'

/**
 * SQLite Worker1 promiser instance
 * Type for the promiser function returned by sqlite3Worker1Promiser
 */
type Promiser = (command: string, args?: any) => Promise<any>
let promiser: Promiser | null = null
let promiserReady = false

/**
 * Initialize SQLite WASM worker
 * Must be called before creating any database instances
 */
export async function initializeSQLite(): Promise<void> {
  if (promiserReady && promiser) {
    return
  }

  try {
    promiser = await new Promise<Promiser>((resolve, reject) => {
      // @ts-ignore - sqlite3Worker1Promiser may not be in type definitions
      const _promiser = sqlite3Worker1Promiser({
        onready: () => {
          resolve(_promiser)
        },
      })
      // Handle initialization errors
      setTimeout(() => {
        if (!promiserReady) {
          reject(new Error('SQLite worker initialization timeout'))
        }
      }, 30000)
    })
    promiserReady = true
  } catch (error) {
    throw new Error(
      `Failed to initialize SQLite WASM: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Get the SQLite promiser instance
 * Throws if not initialized
 */
export function getPromiser(): Promiser {
  if (!promiserReady || !promiser) {
    throw new Error('SQLite WASM not initialized. Call initializeSQLite() first.')
  }
  return promiser
}

/**
 * Open a database in the worker
 * Creates a new empty database, or restores from bytes if provided
 */
export async function openDatabase(existingBytes?: Uint8Array): Promise<string> {
  const promiser = getPromiser()

  // Open database, optionally restoring from bytes
  const openArgs: { filename: string; byteArray?: Uint8Array } = { filename: ':memory:' }
  if (existingBytes && existingBytes.length > 0) {
    openArgs.byteArray = existingBytes
  }

  const openResponse = await promiser('open', openArgs)
  const dbId = openResponse.dbId ?? openResponse.result?.dbId
  
  if (typeof dbId !== 'string') {
    throw new Error(`Failed to open database: invalid dbId in response: ${JSON.stringify(openResponse)}`)
  }

  return dbId
}

/**
 * Close a database in the worker
 */
export async function closeDatabase(dbId: string): Promise<void> {
  const promiser = getPromiser()

  try {
    // Close the database
    await promiser('close', { dbId })
  } catch (error) {
    console.warn('Error closing database:', error)
    throw error
  }
}


/**
 * Export database bytes from the worker
 */
export async function exportDatabase(dbId: string): Promise<Uint8Array> {
  const promiser = getPromiser()

  const exportResponse = await promiser('export', { dbId })
  
  const result = exportResponse.result ?? exportResponse
  
  if (!result) {
    throw new Error(`Failed to export database: invalid result format: ${JSON.stringify(exportResponse)}`)
  }
  
  if (result.byteArray && result.byteArray instanceof Uint8Array) {
    return result.byteArray
  }
  
  // Fallback: try to find binary data in other properties
  if (result && typeof result === 'object') {
    if (result.data && (result.data instanceof Uint8Array || result.data instanceof ArrayBuffer || ArrayBuffer.isView(result.data))) {
      const data = result.data
      return data instanceof Uint8Array ? data : new Uint8Array(data)
    } else if (result.contents && (result.contents instanceof Uint8Array || result.contents instanceof ArrayBuffer || ArrayBuffer.isView(result.contents))) {
      const contents = result.contents
      return contents instanceof Uint8Array ? contents : new Uint8Array(contents)
    } else if (result.buffer && (result.buffer instanceof Uint8Array || result.buffer instanceof ArrayBuffer || ArrayBuffer.isView(result.buffer))) {
      const buffer = result.buffer
      return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    } else if (ArrayBuffer.isView(result)) {
      return new Uint8Array(result.buffer, result.byteOffset, result.byteLength)
    } else if (Array.isArray(result)) {
      return new Uint8Array(result)
    }
  }
  
  // Handle direct Uint8Array or ArrayBuffer
  if (result instanceof Uint8Array) {
    return result
  } else if (result instanceof ArrayBuffer) {
    return new Uint8Array(result)
  }
  
  throw new Error(`Failed to export database: unsupported result format: ${JSON.stringify(Object.keys(result || {}))}`)
}

/**
 * Check if SQLite is ready
 */
export function isSQLiteReady(): boolean {
  return promiserReady && promiser !== null
}
