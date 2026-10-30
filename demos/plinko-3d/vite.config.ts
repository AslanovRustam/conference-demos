/// <reference types="vitest/config" />
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const brandDir = fileURLToPath(new URL('../../shared/brand', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Офлайн: service worker кэширует всю сборку при первом открытии
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Clickable Plinko',
        short_name: 'Plinko',
        description: 'Plinko 3D by Clickable',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#06030f',
        theme_color: '#06030f',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: { alias: { '@brand': brandDir } },
  // dev-сервер по умолчанию не отдаёт файлы вне папки проекта
  // Свои порты: 4173/5173 заняты лобби, 5181/4181 у slot-3d, 5183 у crash-3d; у PWA на общем адресе путаются кэши
  server: { port: 5184, strictPort: true, fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
  preview: { port: 4183, strictPort: true },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
