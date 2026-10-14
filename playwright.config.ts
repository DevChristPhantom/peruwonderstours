import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 20_000, navigationTimeout: 30_000 },
  projects: [
    { name: 'public-desktop', testMatch: ['public.spec.ts', 'public-controls.spec.ts', 'payment.spec.ts'], use: { ...devices['Desktop Chrome'], baseURL: process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100' } },
    { name: 'public-mobile', testMatch: 'public-mobile.spec.ts', use: { ...devices['iPhone 13'], browserName: 'chromium', baseURL: process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3100' } },
    { name: 'admin', testMatch: ['admin.spec.ts', 'admin-finance.spec.ts'], use: { ...devices['Desktop Chrome'] } },
  ],
});
