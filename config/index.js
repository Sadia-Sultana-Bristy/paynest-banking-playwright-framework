'use strict';

/**
 * Single source of truth for runtime configuration.
 *
 * Resolution order (highest wins):
 *   1. Process environment variables (CI secrets, command line)
 *   2. .env file in the project root (local developer overrides)
 *   3. The profile in config/environments.js selected by TEST_ENV
 *
 * The resulting object is validated and frozen so tests cannot mutate it.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });
const environments = require('./environments');

const envName = (process.env.TEST_ENV || 'local').toLowerCase();
const profile = environments[envName];
if (!profile) {
  throw new Error(`Unknown TEST_ENV "${envName}". Valid values: ${Object.keys(environments).join(', ')}`);
}

const toInt = (value, fallback) => (value === undefined || value === '' ? fallback : Number.parseInt(value, 10));
const toBool = (value, fallback) => (value === undefined || value === '' ? fallback : /^(1|true|yes)$/i.test(value));
const isCI = toBool(process.env.CI, false);

const config = {
  env: profile.name,
  isCI,
  baseURL: process.env.BASE_URL || profile.baseURL,
  testSupportKey: process.env.TEST_SUPPORT_KEY || profile.testSupportKey,
  startServer: toBool(process.env.START_SERVER, profile.startServer),
  port: toInt(process.env.PORT, Number(new URL(process.env.BASE_URL || profile.baseURL).port) || 3000),

  // execution
  retries: toInt(process.env.RETRIES, isCI ? 2 : 0),
  // a number ("4") or a percentage of CPU cores ("50%")
  workers: /^\d+$/.test(process.env.WORKERS || '') ? Number(process.env.WORKERS) : process.env.WORKERS || (isCI ? '50%' : undefined),
  headless: toBool(process.env.HEADLESS, true),

  // timeouts (ms)
  timeouts: {
    test: toInt(process.env.TEST_TIMEOUT, 30_000),
    expect: toInt(process.env.EXPECT_TIMEOUT, 5_000),
    action: toInt(process.env.ACTION_TIMEOUT, 10_000),
    navigation: toInt(process.env.NAVIGATION_TIMEOUT, 15_000),
  },

  // business rules the tests assert against (mirrors the product spec)
  rules: {
    dailyTransferLimitCents: 500_000,
    maxFailedLogins: 3,
    largeTransferThresholdCents: 100_000,
  },

  logLevel: process.env.LOG_LEVEL || (isCI ? 'info' : 'warn'),
};

// ---- validation: fail fast with a clear message instead of confusing test errors
const problems = [];
try {
  new URL(config.baseURL);
} catch {
  problems.push(`BASE_URL "${config.baseURL}" is not a valid URL`);
}
if (!config.testSupportKey) {
  problems.push(`TEST_SUPPORT_KEY is required for TEST_ENV=${config.env} (tests create their own data through it)`);
}
if (Number.isNaN(config.retries) || config.retries < 0) problems.push('RETRIES must be a non-negative integer');
if (problems.length) {
  throw new Error(`Invalid test configuration:\n  - ${problems.join('\n  - ')}`);
}

module.exports = Object.freeze(config);
