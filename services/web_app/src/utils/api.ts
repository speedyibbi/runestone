interface RequestConfig {
  endpoint: string
  headers?: Record<string, string>
  urlParams?: Record<string, string>
  querystring?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
}

const buildUrl = (
  endpoint: string,
  urlParams?: Record<string, string>,
  querystring?: Record<string, string>,
): string => {
  let url = endpoint

  if (urlParams) {
    Object.entries(urlParams).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value))
    })
  }

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

const buildRequest = (config: RequestConfig, method: string): Request => {
  const url = buildUrl(config.endpoint, config.urlParams, config.querystring)
  const headers = { ...config.headers }
  const body = config.body ? JSON.stringify(config.body) : undefined

  if (body && !headers['Content-Type']) {
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

export const get = async (config: Omit<RequestConfig, 'body'>): Promise<Response> => {
  const request = buildRequest(config, 'GET')
  return await fetch(request)
}

export const post = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'POST')
  return await fetch(request)
}

export const put = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'PUT')
  return await fetch(request)
}

export const patch = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'PATCH')
  return await fetch(request)
}

export const del = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'DELETE')
  return await fetch(request)
}
