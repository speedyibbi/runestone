/// <reference types="vite/client" />

/**
 * App configuration injected by Vite at build time
 */
declare const __APP_CONFIG__: {
  global: import('@runestone/config').Config['global']
} & import('@runestone/config').Config['web_app']
