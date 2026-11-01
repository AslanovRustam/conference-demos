/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, searchForWorkspaceRoot } from 'vite'

// shared Clickable brand kit; Vite copies what we use into dist/, so the build stays offline-ready.
// normalizePath: on Windows the alias does not resolve with backslashes
const brandDir = normalizePath(fileURLToPath(new URL('../../shared/brand', import.meta.url)))

export default defineConfig({
  // relative asset paths so dist/ works from any URL (lobby iframe, LAN, subfolder)
  base: './',
  plugins: [react()],
  resolve: { alias: { '@brand': brandDir } },
  // fixed ports so several demos can run side by side; the dev server also has to be allowed to read shared/
  server: { port: 5181, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
  preview: { port: 4181, strictPort: true },
  // a single-page demo: one ~520 kB gzip bundle loads faster offline than many small chunks
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
