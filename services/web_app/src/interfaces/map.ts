/**
 * Map entry for a notebook
 */
export interface MapEntry {
  uuid: string
  title: string
}

/**
 * Map structure (decrypted form of map.json.enc)
 */
export interface Map {
  version: number
  last_updated: string // ISO 8601 timestamp
  entries: MapEntry[]
}
