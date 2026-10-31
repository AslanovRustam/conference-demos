import { defineConfig } from '@playwright/test'

// real chrome on this machine's discrete gpu (ANGLE/D3D11): swiftshader renders this scene at a frame every few
// seconds, too slow to play a round. one worker: the scenes share the gpu
const gpu = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--force_high_performance_gpu']
const BASE = 'http://127.0.0.1:4185'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: BASE, channel: 'chrome', launchOptions: { args: gpu } },
  // the production build, as the stand runs it (4185: the lobby owns 4173)
  webServer: { command: 'npm run build && npm run preview', url: BASE, reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: 'chromium', grepInvert: /@touch/, use: { viewport: { width: 1920, height: 1080 } } },
    // an iphone 13 sized touch screen, in chromium
    {
      name: 'mobile',
      grep: /@touch/,
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
  ],
})
