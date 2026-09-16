import { defineConfig, devices } from '@playwright/test';

/**
 * Internal Operations Service Hub — how the end-to-end test runs.
 *
 * The point of this test is that nothing is faked, so Playwright starts
 * both real processes before it opens a browser:
 *
 *   the backend   (localhost:3000)  the rules, the auth, the database
 *   the frontend  (localhost:5173)  the screen
 *
 * reuseExistingServer means that if you already have `npm run dev` going,
 * the test uses it instead of fighting you for the ports.
 */
export default defineConfig({
  testDir: './e2e',
  // One browser. Chromium is enough to prove the flow, and every extra
  // browser is another download before class.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:backend',
      url: 'http://localhost:3000/requests',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
