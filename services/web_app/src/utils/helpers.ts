/**
 * Convert Uint8Array or ArrayBuffer to a proper ArrayBuffer
 * Ensures we have a proper ArrayBuffer (not SharedArrayBuffer)
 */
export function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof Uint8Array) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  }
  return data
}

/**
 * Convert Uint8Array or ArrayBuffer to base64 string (URL-safe)
 * Uses URL-safe base64 encoding (replaces + with -, / with _, removes =)
 * to ensure compatibility with file system paths and URLs
 */
export function toBase64(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data
  const base64 = btoa(String.fromCharCode(...bytes))
  // Convert to URL-safe base64: replace + with -, / with _, remove =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Convert base64 string to Uint8Array (handles URL-safe base64)
 * Converts URL-safe base64 back to standard base64 before decoding
 */
export function fromBase64(base64: string): Uint8Array {
  // Convert URL-safe base64 back to standard base64
  let standardBase64 = base64.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  while (standardBase64.length % 4) {
    standardBase64 += '='
  }
  const binary = atob(standardBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return toBase64(new Uint8Array(buffer))
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = fromBase64(base64)
  return toArrayBuffer(bytes)
}

/**
 * Username storage utilities using localStorage
 */
const STORAGE_KEY = __APP_CONFIG__.localStorage.key
const EXPIRATION_DAYS = __APP_CONFIG__.localStorage.expiration

/**
 * Save username to localStorage
 */
export function saveUsername(username: string): void {
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + EXPIRATION_DAYS)

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, expirationDate }))
}

/**
 * Get username from localStorage
 * Returns null if username doesn't exist or has expired
 */
export function getSavedUsername(): string | null {
  const { username, expirationDate } = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')

  if (!username) {
    return null
  }

  if (new Date(expirationDate) < new Date()) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }

  return username
}
