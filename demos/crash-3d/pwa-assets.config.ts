import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// npm run icons: the pwa icons, the apple touch icon and the favicon from public/icon.svg
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
})
