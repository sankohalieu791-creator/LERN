import { defineConfig, devices } from '@playwright/test'

// Real browser checks against the live production site. Not a CI suite
// (no local dev server to spin up here) -- run manually with
// `npx playwright test` whenever a production audit is needed.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'https://lernapp.uk',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // A Chromium-engine mobile viewport, not devices['iPhone 13'] --
    // that preset forces WebKit, a separate browser binary this
    // environment doesn't have installed.
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})
