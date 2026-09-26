import { defineConfig } from '@playwright/test'
export default defineConfig({
 testDir: './tests', testMatch: 'visual.spec.ts', workers: 1,
 use: { baseURL: 'http://127.0.0.1:5174', headless: true, channel: 'chrome' },
 webServer: { command: 'npm run dev -- --mode visual', url: 'http://127.0.0.1:5174', reuseExistingServer: false },
 outputDir: 'test-results',
})
