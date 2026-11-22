'use strict';

/**
 * End-to-end journey across two roles in two separate browser contexts:
 * a customer locks themselves out, an operations admin unlocks them, and
 * the customer signs in successfully.
 */
const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { BankApi } = require('../../src/api/bank-api');
const { LoginPage } = require('../../src/pages/login-page');
const { MfaPage } = require('../../src/pages/mfa-page');
const { DashboardPage } = require('../../src/pages/dashboard-page');
const { AdminCustomersPage } = require('../../src/pages/admin-customers-page');

test.describe('E2E: account lockout and recovery', { tag: ['@e2e', '@security'] }, () => {
  test('admin unlocks a customer who locked themselves out', async ({ browser, customer, testSupport, appConfig }) => {
    const admin = await testSupport.createAdmin();
    const customerContext = await browser.newContext({ baseURL: appConfig.baseURL });
    const adminContext = await browser.newContext({ baseURL: appConfig.baseURL });

    try {
      const customerPage = await customerContext.newPage();
      const loginPage = new LoginPage(customerPage);

      await test.step('customer locks the account with wrong passwords', async () => {
        await loginPage.open();
        for (let i = 1; i <= appConfig.rules.maxFailedLogins; i++) {
          await loginPage.signIn(customer.username, `Wrong#${i}`);
          await expect(loginPage.formError).toBeVisible();
        }
        await expect(loginPage.formError).toContainText('locked');
      });

      await test.step('admin unlocks the customer', async () => {
        const adminPage = await adminContext.newPage();
        await new BankApi(adminPage.request).signIn(admin);
        const customers = new AdminCustomersPage(adminPage);
        await customers.open();
        await customers.search(customer.username);
        await expect(customers.status(customer.username)).toHaveText('Locked');
        await customers.unlock(customer.username);
        await expect(customers.status(customer.username)).toHaveText('Active');
      });

      await test.step('customer signs in with the correct password', async () => {
        await loginPage.signIn(customer.username, customer.password);
        await new MfaPage(customerPage).verifyWithSecret(customer.mfaSecret);
        await expect(new DashboardPage(customerPage).welcome).toHaveText(`Welcome back, ${customer.firstName}`);
      });
    } finally {
      await customerContext.close();
      await adminContext.close();
    }
  });
});
