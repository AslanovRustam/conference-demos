/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// shared Clickable brand kit; Vite copies what we use into dist/, so the build stays offline-ready.
// normalizePath: on Windows the alias does not resolve with backslashes
const brandDir = normalizePath(fileURLToPath(new URL('../../shared/brand', import.meta.url)))

export default defineConfig({
  // relative asset paths so dist/ works from any URL (lobby iframe, LAN, subfolder)
  base: './',
  plugins: [
    react(),
    // offline: the service worker caches the whole build (textures included) on the first visit; it is registered
    // by hand in main.tsx (production only, never inside the lobby)
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Clickable Rocket',
        short_name: 'Rocket',
        description: 'Crash rocket demo by Clickable',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,svg,png,jpg,ogg,mp3,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 64 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: { alias: { '@brand': brandDir } },
  // the dev server does not serve files outside the project unless allowed.
  // own port: sibling demos default to 5173 on the same machine
  server: { port: 5183, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
  // 4173 is the lobby's, 4181 slot-3d's, 4183 plinko-3d's
  preview: { port: 4185, strictPort: true },
  // single-page demo with three.js and textures: one big bundle loads fine offline
  build: { chunkSizeWarningLimit: 4000 },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
