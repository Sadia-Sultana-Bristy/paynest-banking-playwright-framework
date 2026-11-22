'use strict';

/**
 * API-level fixtures. No browser is launched for tests that only use these,
 * which keeps the API project fast.
 *
 * Fixture graph:
 *   appConfig ─┬─> testSupport ──> customer ──> signedInApi
 *              └─> bankApi (own cookie jar per test)
 */
const base = require('@playwright/test');
const appConfig = require('../../config');
const { TestSupportApi } = require('../api/test-support-api');
const { BankApi } = require('../api/bank-api');
const { expect } = require('../support/custom-matchers');

const test = base.test.extend({
  /**
   * Option: shape of the customer a test needs. Override per file or describe:
   *   test.use({ customerProfile: { accounts: [{ type: 'CHECKING', balance: 50_00 }] } })
   */
  customerProfile: [{}, { option: true }],

  // eslint-disable-next-line no-empty-pattern
  appConfig: async ({}, use) => {
    await use(appConfig);
  },

  /** Creates isolated test data and deletes it after the test, even on failure. */
  testSupport: async ({ playwright, appConfig }, use) => {
    const request = await playwright.request.newContext({ baseURL: appConfig.baseURL });
    const support = new TestSupportApi(request, appConfig.testSupportKey);
    await use(support);
    await support.cleanup();
    await request.dispose();
  },

  /** A brand-new customer (credentials, MFA secret, accounts) owned by this test only. */
  customer: async ({ testSupport, customerProfile }, use) => {
    await use(await testSupport.createCustomer(customerProfile));
  },

  /** Unauthenticated API client with its own cookie jar. */
  bankApi: async ({ playwright, appConfig }, use) => {
    const request = await playwright.request.newContext({ baseURL: appConfig.baseURL });
    await use(new BankApi(request));
    await request.dispose();
  },

  /** API client already signed in as `customer`. */
  signedInApi: async ({ bankApi, customer }, use) => {
    await bankApi.signIn(customer);
    await use(bankApi);
  },
});

module.exports = { test, expect };
