/// <reference types="vitest/config" />
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const brandDir = fileURLToPath(new URL('../../shared/brand', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@brand': brandDir } },
  // dev-сервер по умолчанию не отдаёт файлы вне папки проекта
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), brandDir] } },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
