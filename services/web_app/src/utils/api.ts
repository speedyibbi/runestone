interface RequestConfig {
  endpoint: string;
  headers?: Record<string, string>;
  urlParams?: Record<string, string>;
  querystring?: Record<string, string>;
  body?: any;
}

const buildUrl = (endpoint: string, urlParams?: Record<string, string>, querystring?: Record<string, string>): string => {
  let url = endpoint;
  
  if (urlParams) {
    Object.entries(urlParams).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    });
  }
  
  if (querystring) {
    const searchParams = new URLSearchParams();
    Object.entries(querystring).forEach(([key, value]) => {
      searchParams.append(key, value);
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return url;
};

const buildHeaders = (headers?: Record<string, string>): HeadersInit => {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  return headers ? { ...defaultHeaders, ...headers } : defaultHeaders;
};

const buildRequest = (config: RequestConfig, method: string): Request => {
  const url = buildUrl(config.endpoint, config.urlParams, config.querystring);
  const headers = buildHeaders(config.headers);
  
  return new Request(url, {
    method,
    headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
  });
};

export const get = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'GET');
  return await fetch(request);
};

export const post = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'POST');
  return await fetch(request);
};

export const put = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'PUT');
  return await fetch(request);
};

export const patch = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'PATCH');
  return await fetch(request);
};

export const del = async (config: RequestConfig): Promise<Response> => {
  const request = buildRequest(config, 'DELETE');
  return await fetch(request);
};
