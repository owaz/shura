import { defineConfig, devices } from '@playwright/test';

// Auth0 callbacks and the saved local storage state are bound to localhost.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3006';
const storageState = process.env.E2E_STORAGE_STATE;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  // Auth0 refresh-token rotation makes a shared saved state unsafe to use in
  // concurrent browser contexts. Synthetic authenticated coverage is small.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: { baseURL, storageState: storageState || undefined, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1',
    port: 3006,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet-chromium', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
