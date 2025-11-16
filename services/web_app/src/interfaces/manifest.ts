/**
 * Manifest entry for a blob
 */
export interface ManifestEntry {
  uuid: string
  type: 'note' | 'image'
  title: string
  version: number
  last_updated: string // ISO 8601 timestamp
  hash: string // sha256-<hash>
  size: number // bytes
}

/**
 * Manifest structure (decrypted form)
 */
export interface Manifest {
  manifest_version: number
  last_updated: string // ISO 8601 timestamp
  notebook_id: string
  notebook_title: string
  entries: ManifestEntry[]
}
