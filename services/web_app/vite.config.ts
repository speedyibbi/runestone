import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { config } from '@runestone/config'

export default defineConfig(({ mode }) => {
  return {
    define: {
      __APP_CONFIG__: JSON.stringify(config.web_app),
    },
    plugins: [
      vue(),
      vueDevTools(),
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
          target: `${config.global.environment === 'development' ? 'http' : 'https'}://${config.server.host}:${config.server.port}`,
          changeOrigin: true,
        },
      },
    },
  };
});
