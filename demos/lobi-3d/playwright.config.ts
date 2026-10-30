import { defineConfig, devices } from '@playwright/test'

const PORT = 5291

export default defineConfig({
  testDir: 'e2e',
  // software WebGL on a busy machine can take tens of seconds per 1080p test
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1920, height: 1080 },
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    { name: 'chromium', testIgnore: /real-games/, use: { viewport: { width: 1920, height: 1080 } } },
    {
      name: 'gpu',
      testMatch: /real-games/,
      use: { viewport: { width: 1920, height: 1080 }, launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] } },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // software WebGL on a busy machine can take tens of seconds per 1080p test
  timeout: 120_000,
  },
})
