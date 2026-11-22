'use strict';

/**
 * UI fixtures: page objects, authenticated sessions and diagnostics.
 * Built on top of the API fixtures so UI tests can arrange data through the
 * API and spend browser time only on the behaviour under test.
 *
 * Usage in a spec:
 *   const { test, expect } = require('../../src/fixtures/ui.fixtures');
 *   test('...', async ({ signedInCustomer, transferPage }) => { ... });
 */
const { test: apiTest, expect } = require('./api.fixtures');
const { BankApi } = require('../api/bank-api');
const { LoginPage } = require('../pages/login-page');
const { MfaPage } = require('../pages/mfa-page');
const { DashboardPage } = require('../pages/dashboard-page');
const { TransferPage } = require('../pages/transfer-page');
const { PayeesPage } = require('../pages/payees-page');
const { TransactionsPage } = require('../pages/transactions-page');
const { AdminCustomersPage } = require('../pages/admin-customers-page');
const { NavBar } = require('../components/nav-bar');

const test = apiTest.extend({
  // ---------- page objects ----------
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  mfaPage: async ({ page }, use) => use(new MfaPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  transferPage: async ({ page }, use) => use(new TransferPage(page)),
  payeesPage: async ({ page }, use) => use(new PayeesPage(page)),
  transactionsPage: async ({ page }, use) => use(new TransactionsPage(page)),
  adminPage: async ({ page }, use) => use(new AdminCustomersPage(page)),
  navBar: async ({ page }, use) => use(new NavBar(page)),

  /**
   * Overrides the API fixture so API calls share the browser's cookie jar.
   * Signing in through this client therefore signs the page in as well.
   */
  bankApi: async ({ page }, use) => {
    await use(new BankApi(page.request));
  },

  /**
   * Customer signed in via the API (password + TOTP) in ~50ms instead of
   * driving the login UI. Login itself is covered by dedicated auth tests.
   */
  signedInCustomer: async ({ bankApi, customer }, use) => {
    await bankApi.signIn(customer);
    await use(customer);
  },

  /** An operations admin, signed in. */
  signedInAdmin: async ({ bankApi, testSupport }, use) => {
    const admin = await testSupport.createAdmin({ firstName: 'Ops', lastName: 'Admin' });
    await bankApi.signIn(admin);
    await use(admin);
  },

  /**
   * Auto fixture (runs for every UI test): collects browser console errors,
   * uncaught page errors and failed API calls, and attaches them to the
   * report when a test fails. Pairs with the screenshot/video/trace settings
   * in playwright.config.js to make CI failures debuggable without a rerun.
   */
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const consoleErrors = [];
      const failedRequests = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`);
      });
      page.on('pageerror', (error) => consoleErrors.push(`[pageerror] ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 500) failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      });

      if (testInfo.retry > 0) {
        testInfo.annotations.push({ type: 'retry', description: `Attempt ${testInfo.retry + 1} of ${testInfo.project.retries + 1}` });
      }

      await use();

      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('page-url.txt', { body: page.url(), contentType: 'text/plain' });
        if (consoleErrors.length) {
          await testInfo.attach('browser-console-errors.txt', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
        }
        if (failedRequests.length) {
          await testInfo.attach('failed-requests.txt', { body: failedRequests.join('\n'), contentType: 'text/plain' });
        }
      }
    },
    { auto: true },
  ],
});

module.exports = { test, expect };
