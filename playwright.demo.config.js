// @ts-check
'use strict';

/**
 * Demo recording config, used by `npm run demo` (scripts/record-demo.js).
 *
 * Runs the main end-to-end journey once in Chromium, slowed down and with
 * video always on, so the result can be published as a README demo.
 * It reuses the main config (app server, global setup, timeouts) and only
 * changes what is needed for a watchable recording.
 */
const { defineConfig, devices } = require('@playwright/test');
const base = require('./playwright.config');

module.exports = defineConfig({
  ...base,
  outputDir: './demo-results',
  reporter: [['list']],
  retries: 0,
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  grep: /pay a new payee/,
  projects: [
    {
      name: 'demo-chromium',
      testIgnore: /tests[\\/]api[\\/]/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        video: { mode: 'on', size: { width: 1280, height: 800 } },
        trace: 'off',
        screenshot: 'off',
        launchOptions: { slowMo: 450 }, // slow enough to follow each step
      },
    },
  ],
});
