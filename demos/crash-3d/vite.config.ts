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
  // the dev server does not serve files outside the project unless allowed.
  // own port: sibling demos default to 5173 on the same machine
  server: { port: 5183, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
  // single-page demo with three.js and textures: one big bundle loads fine offline
  build: { chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
