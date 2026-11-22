'use strict';

/**
 * Retry with exponential backoff for infrastructure-level calls (API setup,
 * health checks). This is deliberately NOT used to hide product failures:
 * assertions use Playwright's auto-waiting and expect.poll instead.
 */
const { createLogger } = require('./logger');

const log = createLogger('retry');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, { retries = 3, delayMs = 250, factor = 2, shouldRetry = () => true, label = 'operation' } = {}) {
  let attempt = 0;
  let wait = delayMs;
  while (true) {
    try {
      return await fn(attempt);
    } catch (error) {
      attempt += 1;
      if (attempt > retries || !shouldRetry(error)) throw error;
      log.warn(`${label} failed (attempt ${attempt}/${retries}), retrying in ${wait}ms`, { error: error.message });
      await sleep(wait);
      wait *= factor;
    }
  }
}

module.exports = { withRetry, sleep };
