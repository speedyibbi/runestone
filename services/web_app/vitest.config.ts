import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Standalone test config (does not reuse vite.config.ts, which imports the
// workspace-only @runestone/config and the full app plugin chain). Kernel logic
// and the Pinia context store need no DOM, so the node environment suffices.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
})
