import { defineConfig, devices } from '@playwright/test'

// Les tests ouvrent directement dist-single/index.html via file:// (comme le jury).
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], locale: 'fr-CA' },
})
