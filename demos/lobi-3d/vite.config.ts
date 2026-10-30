/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, searchForWorkspaceRoot } from 'vite'

// shared Clickable brand kit; Vite copies what we use into dist/, so the build stays offline-ready.
// normalizePath: on Windows the alias does not resolve with backslashes
const brandDir = normalizePath(fileURLToPath(new URL('../../shared/brand', import.meta.url)))

export default defineConfig({
  // relative asset paths so dist/ works from any URL (Vercel root, local preview, subfolder)
  base: './',
  plugins: [react()],
  resolve: { alias: { '@brand': brandDir } },
  // the dev server does not serve files outside the project unless allowed
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
