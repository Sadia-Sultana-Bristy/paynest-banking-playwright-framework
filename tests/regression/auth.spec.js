'use strict';

const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { invalidTotp } = require('../../src/utils/totp');
const loginCases = require('../data/login-negative.json');

test.describe('Authentication', { tag: ['@regression', '@auth'] }, () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.open();
  });

  // ---------- data-driven negative sign-in ----------
  for (const data of loginCases) {
    test(`sign-in is rejected: ${data.case}`, async ({ customer, loginPage, mfaPage }) => {
      const username = data.username === '{{customer}}' ? customer.username : data.username;
      await loginPage.signIn(username, data.password);

      if (data.expect.formError) {
        await expect(loginPage.formError).toHaveText(data.expect.formError);
      } else {
        await expect(loginPage.fieldError(data.expect.field)).toHaveText(data.expect.message);
        await expect(loginPage.page.getByLabel(data.expect.field === 'username' ? 'Username' : 'Password')).toHaveAttribute(
          'aria-invalid',
          'true',
        );
      }
      await expect(mfaPage.title).toBeHidden();
    });
  }

  test('an incorrect MFA code is rejected and the customer stays on the MFA step', async ({
    customer,
    loginPage,
    mfaPage,
    dashboardPage,
  }) => {
    await loginPage.signIn(customer.username, customer.password);
    await mfaPage.submitCode(invalidTotp(customer.mfaSecret));

    await expect(mfaPage.formError).toHaveText('That code is incorrect or has expired');
    await expect(mfaPage.title).toBeVisible();
    await expect(dashboardPage.welcome).toBeHidden();
  });

  test('an MFA code that is not 6 digits shows a field error', async ({ customer, loginPage, mfaPage }) => {
    await loginPage.signIn(customer.username, customer.password);
    await mfaPage.submitCode('12ab');
    await expect(mfaPage.fieldError('code')).toHaveText('Enter the 6-digit code from your authenticator app');
  });

  test('account locks after 3 failed attempts and stays locked for the right password', { tag: '@security' }, async ({
    customer,
    loginPage,
    appConfig,
  }) => {
    const { maxFailedLogins } = appConfig.rules;
    for (let attempt = 1; attempt < maxFailedLogins; attempt++) {
      await loginPage.signIn(customer.username, `Wrong#${attempt}`);
      await expect(loginPage.formError).toHaveText('Invalid username or password');
    }

    await loginPage.signIn(customer.username, 'Wrong#final');
    await expect(loginPage.formError).toContainText(`locked after ${maxFailedLogins} failed sign-in attempts`);

    await loginPage.signIn(customer.username, customer.password);
    await expect(loginPage.formError).toContainText('Your account is locked');
  });

  test('protected pages redirect to sign-in when there is no session', { tag: '@security' }, async ({
    page,
    loginPage,
  }) => {
    for (const route of ['/#/dashboard', '/#/transfer', '/#/payees', '/#/transactions', '/#/admin']) {
      await test.step(route, async () => {
        await page.goto(route);
        await expect(loginPage.title).toBeVisible();
        await expect(loginPage.notice).toHaveText('Please sign in to continue');
      });
    }
  });

  test('signing out ends the session', async ({ signedInCustomer, dashboardPage, navBar, loginPage, page }) => {
    await dashboardPage.open();
    await navBar.signOut();

    await expect(loginPage.notice).toHaveText('You have signed out.');
    await page.goto('/#/dashboard');
    await expect(loginPage.title).toBeVisible();
    expect(signedInCustomer.username).toBeTruthy();
  });

  test('a customer cannot open the admin area', { tag: ['@security', '@admin'] }, async ({
    signedInCustomer,
    adminPage,
    navBar,
    bankApi,
  }) => {
    await adminPage.open();
    await expect(adminPage.accessDenied).toBeVisible();
    await expect(navBar.link('Admin')).toHaveCount(0);

    // the API enforces the same rule, not just the UI
    const response = await bankApi.raw('GET', '/api/admin/customers');
    expect(response.status()).toBe(403);
    expect(signedInCustomer.role).toBe('customer');
  });
});
