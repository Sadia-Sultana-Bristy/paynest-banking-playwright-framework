// @ts-check
'use strict';

const { defineConfig, devices } = require('@playwright/test');
const config = require('./config');

/**
 * Reporters
 *  - Local: list in the terminal + HTML, JUnit and JSON files + tag summary.
 *  - CI:    each shard writes a "blob" report; the merge job in GitHub
 *           Actions combines all shards and browsers into one HTML/JUnit/JSON
 *           report (see merge.config.js). The github reporter adds inline
 *           failure annotations to the pull request.
 */
const localReporters = [
  ['list'],
  ['html', { outputFolder: 'reports/html', open: 'never' }],
  ['junit', { outputFile: 'reports/junit/results.xml' }],
  ['json', { outputFile: 'reports/json/results.json' }],
  ['./src/reporters/tag-summary-reporter.js', { title: `PayNest tests (${config.env})` }],
];
const ciReporters = [
  ['blob', { fileName: `report-${process.env.BLOB_NAME || 'run'}.zip` }],
  ['github'],
  ['list'],
  ['./src/reporters/tag-summary-reporter.js', { title: `Shard ${process.env.BLOB_NAME || ''}` }],
];

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: config.timeouts.test,
  expect: { timeout: config.timeouts.expect },

  // ---------- execution strategy ----------
  fullyParallel: true, // tests in the same file run in parallel too: every test owns its data
  workers: config.workers,
  forbidOnly: config.isCI, // a stray test.only must never reach main
  retries: config.retries, // 0 locally (see failures immediately), 2 in CI
  // Flag flaky tests in the HTML report and keep slow tests visible.
  reportSlowTests: { max: 5, threshold: 15_000 },

  reporter: config.isCI ? ciReporters : localReporters,

  globalSetup: require.resolve('./src/hooks/global-setup.js'),

  metadata: { environment: config.env, baseURL: config.baseURL },

  use: {
    baseURL: config.baseURL,
    testIdAttribute: 'data-testid',
    headless: config.headless,
    actionTimeout: config.timeouts.action,
    navigationTimeout: config.timeouts.navigation,
    locale: 'en-US',
    timezoneId: 'UTC',

    // ---------- failure evidence ----------
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Locally keep a trace for every failure; in CI record one on the first
    // retry, which captures the flaky/failing run without slowing green runs.
    trace: config.isCI ? 'on-first-retry' : 'retain-on-failure',
  },

  // ---------- projects: browsers + test layers ----------
  projects: [
    {
      // API tests use only request fixtures, so no browser is launched.
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'chromium',
      testIgnore: /tests[\\/]api[\\/]/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
    {
      name: 'firefox',
      testIgnore: /tests[\\/]api[\\/]/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 900 } },
    },
    {
      name: 'webkit',
      testIgnore: /tests[\\/]api[\\/]/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1366, height: 900 } },
    },
    {
      // Responsive check: only the smoke suite runs on a mobile viewport.
      name: 'mobile-chrome',
      testIgnore: /tests[\\/]api[\\/]/,
      grep: /@smoke/,
      use: { ...devices['Pixel 7'] },
    },
  ],

  // ---------- application under test ----------
  webServer: config.startServer
    ? {
        command: 'node app/server.js',
        url: `${config.baseURL}/api/health`,
        reuseExistingServer: !config.isCI,
        timeout: 30_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: { PORT: String(config.port), TEST_SUPPORT_KEY: config.testSupportKey },
      }
    : undefined,
});
