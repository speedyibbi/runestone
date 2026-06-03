import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { config } from '@runestone/config'

// Plugin to copy sqlite3.js and sqlite3.wasm to assets directory
// Vite doesn't bundle files referenced via importScripts(), so we need to copy them
// Also, Vite hashes WASM files but SQLite expects sqlite3.wasm (without hash)
function copySqlitePlugin(): Plugin {
  return {
    name: 'copy-sqlite',
    generateBundle(options, bundle) {
      const webAppDir = fileURLToPath(new URL('.', import.meta.url))
      const rootDir = path.resolve(webAppDir, '../..')
      
      // Helper function to copy a SQLite file
      const copySqliteFile = (fileName: string) => {
        const source = fs.existsSync(path.join(rootDir, `node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/${fileName}`))
          ? path.join(rootDir, `node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/${fileName}`)
          : path.join(webAppDir, `node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/${fileName}`)
        
        if (fs.existsSync(source)) {
          this.emitFile({
            type: 'asset',
            fileName: `assets/${fileName}`,
            source: fs.readFileSync(source),
          })
        } else {
          console.warn(`${fileName} not found. Tried:`, source)
        }
      }
      
      // Copy sqlite3.js
      copySqliteFile('sqlite3.js')
      
      // Copy sqlite3-opfs-async-proxy.js (needed for OPFS support)
      copySqliteFile('sqlite3-opfs-async-proxy.js')
      
      // Find the hashed WASM file in the bundle and copy it as sqlite3.wasm
      const wasmFiles = Object.keys(bundle).filter(key => 
        key.startsWith('assets/') && key.endsWith('.wasm') && key.includes('sqlite3')
      )
      
      if (wasmFiles.length > 0) {
        const wasmFile = bundle[wasmFiles[0]]
        if (wasmFile && wasmFile.type === 'asset') {
          this.emitFile({
            type: 'asset',
            fileName: 'assets/sqlite3.wasm',
            source: wasmFile.source,
          })
        }
      } else {
        // Fallback: try to find WASM file in node_modules
        const wasmSource = fs.existsSync(path.join(rootDir, 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm'))
          ? path.join(rootDir, 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm')
          : path.join(webAppDir, 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm')
        
        if (fs.existsSync(wasmSource)) {
          this.emitFile({
            type: 'asset',
            fileName: 'assets/sqlite3.wasm',
            source: fs.readFileSync(wasmSource),
          })
        }
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
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo.png', 'assets/*.wasm', 'assets/*.js'],
        manifest: {
          name: 'Runestone',
          short_name: 'Runestone',
          description: 'Privacy-first knowledgebase',
          theme_color: '#4f535b',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/favicon.ico',
              sizes: '48x48',
              type: 'image/x-icon',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}'],
        },
        devOptions: {
          enabled: false, // Disable PWA in dev mode
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces
      port: config.web_app.port ?? 5173,
      proxy: {
        '/api': {
          target: `${config.global.environment.mode === 'dev' ? 'http' : 'https'}://${config.server.host}:${config.server.port}`,
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
