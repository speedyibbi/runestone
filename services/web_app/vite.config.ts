import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import type { Plugin } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '@runestone/config'

// Plugin to copy sqlite3.js to assets directory
// Vite doesn't bundle files referenced via importScripts(), so we need to copy it to the assets directory
function copySqlitePlugin(): Plugin {
  return {
    name: 'copy-sqlite',
    generateBundle() {
      const webAppDir = fileURLToPath(new URL('.', import.meta.url))
      const rootDir = path.resolve(webAppDir, '../..')
      
      const sqliteSource = fs.existsSync(path.join(rootDir, 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.js'))
        ? path.join(rootDir, 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.js')
        : path.join(webAppDir, 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.js')
      
      if (fs.existsSync(sqliteSource)) {
        this.emitFile({
          type: 'asset',
          fileName: 'assets/sqlite3.js',
          source: fs.readFileSync(sqliteSource),
        })
      } else {
        console.warn('sqlite3.js not found. Tried:', sqliteSource)
      }
    },
  }
}

// Plugin to set correct MIME type for WASM files and handle node_modules access
function wasmMimeTypePlugin(): Plugin {
  return {
    name: 'wasm-mime-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        // Handle both direct .wasm requests and /@fs/ paths
        if (url.endsWith('.wasm') || url.includes('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm')
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Access-Control-Allow-Origin', '*')
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  return {
    define: {
      __APP_CONFIG__: JSON.stringify({ global: config.global, ...config.web_app }),
    },
    plugins: [
      vue(),
      vueDevTools(),
      wasmMimeTypePlugin(),
      copySqlitePlugin(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      port: config.web_app.port ?? 5173,
      proxy: {
        '/api': {
          target: `${config.global.environment.mode === 'development' ? 'http' : 'https'}://${config.server.host}:${config.server.port}`,
          changeOrigin: true,
        },
      },
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      fs: {
        // Allow access to files in the project and node_modules
        allow: [
          // Allow project root
          fileURLToPath(new URL('.', import.meta.url)),
          // Allow node_modules (needed for SQLite WASM)
          path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'node_modules'),
          // Allow parent directories (for monorepo)
          '..',
        ],
        // Strict mode disabled to allow access to node_modules
        strict: false,
      },
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm'],
    },
    assetsInclude: ['**/*.wasm'],
  };
});
