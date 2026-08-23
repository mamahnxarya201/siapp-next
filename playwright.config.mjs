import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Prefer a real installed Chrome (documented in BILL_OF_MANIFEST); fall back to
// Playwright's bundled chromium when no system Chrome exists.
const SYSTEM_CHROME_CANDIDATES = [
  '/opt/google/chrome/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const channel = SYSTEM_CHROME_CANDIDATES.some(existsSync) ? 'chrome' : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: join(tmpdir(), 'pmis-vanilla-gantt-test-results'),
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.GANTT_TEST_BASE_URL ?? 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(channel ? { channel } : {}),
      },
    },
  ],
});
