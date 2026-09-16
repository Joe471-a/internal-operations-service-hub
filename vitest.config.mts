import { defineConfig } from 'vitest/config';

/**
 * Internal Operations Service Hub — how the fast tests run.
 *
 * These tests are the ones that need no browser and no running server. They
 * live next to the backend code they are about, so a file and its test sit
 * side by side. The end-to-end test is a different tool and will be
 * configured separately in playwright.config.ts once the frontend exists.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/src/**/*.test.ts'],
    // The integration test copies a file and talks to SQLite; give it room
    // and keep the suites from writing to the same test database at once.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
