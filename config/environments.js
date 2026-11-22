'use strict';

/**
 * Environment profiles. Select one with TEST_ENV (default: local).
 * Any value can be overridden by an environment variable, see config/index.js.
 *
 * startServer: when true, Playwright boots the demo app itself (webServer).
 *              Set false for shared environments that are already running.
 */
module.exports = {
  local: {
    name: 'local',
    baseURL: 'http://localhost:3000',
    testSupportKey: 'local-test-key',
    startServer: true,
  },
  ci: {
    name: 'ci',
    baseURL: 'http://localhost:3000',
    testSupportKey: 'ci-test-key',
    startServer: true,
  },
  staging: {
    // Example of a deployed environment. The URL is a placeholder: point
    // BASE_URL at a real deployment and supply TEST_SUPPORT_KEY as a secret.
    name: 'staging',
    baseURL: 'https://staging.paynest.example',
    testSupportKey: undefined,
    startServer: false,
  },
};
