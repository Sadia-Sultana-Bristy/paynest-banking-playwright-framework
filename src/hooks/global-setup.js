'use strict';

/**
 * Runs once before any worker starts.
 *  1. Confirms the application under test is reachable and healthy, so a
 *     broken environment fails fast with one clear error instead of 100
 *     confusing test failures.
 *  2. Confirms the test-support API accepts our key.
 *  3. Writes run metadata that the reports and CI summary can reference.
 */
const fs = require('fs');
const path = require('path');
const { request } = require('@playwright/test');
const config = require('../../config');
const { withRetry } = require('../utils/retry');
const { createLogger } = require('../utils/logger');

const log = createLogger('global-setup', 'info');

module.exports = async function globalSetup() {
  const api = await request.newContext({ baseURL: config.baseURL });
  try {
    const health = await withRetry(
      async () => {
        const res = await api.get('/api/health');
        if (!res.ok()) throw new Error(`Health check returned ${res.status()}`);
        return res.json();
      },
      { retries: 5, delayMs: 500, label: 'health check' },
    );

    const probe = await api.delete('/api/test-support/customers/usr_probe', {
      headers: { 'x-test-support-key': config.testSupportKey },
    });
    if (probe.status() === 403) {
      throw new Error('TEST_SUPPORT_KEY was rejected by the application. Check the key for this environment.');
    }

    const metadata = {
      environment: config.env,
      baseURL: config.baseURL,
      service: health.service,
      startedAt: new Date().toISOString(),
      ci: config.isCI,
      commit: process.env.GITHUB_SHA || null,
      branch: process.env.GITHUB_REF_NAME || null,
      runUrl: process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
    };
    const outDir = path.resolve(__dirname, '../../reports');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'run-metadata.json'), JSON.stringify(metadata, null, 2));
    log.info(`Environment "${config.env}" is healthy at ${config.baseURL}`);
  } finally {
    await api.dispose();
  }
};
