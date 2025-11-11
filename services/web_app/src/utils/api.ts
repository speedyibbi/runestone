/**
 * Configuration for HTTP requests
 */
interface RequestConfig {
  endpoint: string
  headers?: Record<string, string>
  urlParams?: Record<string, string>
  querystring?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
}

/**
 * Build URL with path parameters and query string
 */
const buildUrl = (
  endpoint: string,
  urlParams?: Record<string, string>,
  querystring?: Record<string, string>,
): string => {
  let url = endpoint

  // Replace path parameters
  if (urlParams) {
    Object.entries(urlParams).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value))
    })
  }

  // Add query string parameters
  if (querystring) {
    const searchParams = new URLSearchParams()
    Object.entries(querystring).forEach(([key, value]) => {
      searchParams.append(key, value)
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  return url
}

/**
 * Build Request object with configured method, headers, and body
 */
const buildRequest = (config: RequestConfig, method: string): Request => {
  const url = buildUrl(config.endpoint, config.urlParams, config.querystring)
  const headers = { ...config.headers }

  // Check if body is already a BodyInit type (File, Blob, FormData, etc.)
  // If so, use it directly; otherwise JSON.stringify it
  const isBodyInit =
    config.body instanceof File ||
    config.body instanceof Blob ||
    config.body instanceof ArrayBuffer ||
    config.body instanceof FormData ||
    config.body instanceof URLSearchParams ||
    config.body instanceof ReadableStream ||
    typeof config.body === 'string'

  const body = config.body ? (isBodyInit ? config.body : JSON.stringify(config.body)) : undefined

  // Auto-set Content-Type for JSON body (not for File, Blob, FormData, etc.)
  if (body && !isBodyInit && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const requestInit: RequestInit = { method, headers }

  if (body) {
    requestInit.body = body
  }

  if (config.signal) {
    requestInit.signal = config.signal
  }

  return new Request(url, requestInit)
}

/**
 * Perform GET request
 */
export const get = async (config: Omit<RequestConfig, 'body'>): Promise<Response> => {
  const request = buildRequest(config, 'GET')
  return await fetch(request)
}

/**
 * Perform POST request
 */
export const post = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'POST')
  return await fetch(request)
}

/**
 * Perform PUT request
 */
export const put = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'PUT')
  return await fetch(request)
}

/**
 * Perform PATCH request
 */
export const patch = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'PATCH')
  return await fetch(request)
}

/**
 * Perform DELETE request
 */
export const del = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'DELETE')
  return await fetch(request)
}
