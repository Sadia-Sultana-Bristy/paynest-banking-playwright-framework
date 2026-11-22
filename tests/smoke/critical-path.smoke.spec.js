'use strict';

/**
 * Smoke suite: the minimum set of checks that proves a build is usable.
 * Runs on every push across all browsers and on a mobile viewport.
 * Target: under 1 minute, no data-heavy scenarios.
 */
const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { formatUSD } = require('../../src/utils/money');

test.describe('Smoke: critical path', { tag: ['@smoke', '@critical'] }, () => {
  test('customer signs in with password and MFA and lands on the dashboard', { tag: '@auth' }, async ({
    customer,
    loginPage,
    mfaPage,
    dashboardPage,
    navBar,
  }) => {
    await loginPage.open();
    await loginPage.signIn(customer.username, customer.password);

    await expect(mfaPage.title).toBeVisible();
    await mfaPage.verifyWithSecret(customer.mfaSecret);

    await expect(dashboardPage.welcome).toHaveText(`Welcome back, ${customer.firstName}`);
    await expect(navBar.signedInUser).toHaveText(`${customer.firstName} ${customer.lastName}`);
  });

  test('dashboard shows every account with its balance', { tag: '@accounts' }, async ({
    signedInCustomer,
    dashboardPage,
  }) => {
    await dashboardPage.open();

    await expect(dashboardPage.accountCards).toHaveCount(signedInCustomer.accounts.length);
    for (const account of signedInCustomer.accounts) {
      await expect(dashboardPage.balanceLocator(account.name)).toShowMoney(account.balance);
    }
    await expect(dashboardPage.limitRemaining).toHaveText(formatUSD(500_000));
  });

  test('main navigation reaches every customer page', { tag: '@navigation' }, async ({
    signedInCustomer,
    dashboardPage,
    navBar,
    page,
  }) => {
    await dashboardPage.open();
    const destinations = [
      ['Transfer', 'Move money'],
      ['Payees', 'Payees'],
      ['Transactions', 'Transactions'],
      ['Dashboard', `Welcome back, ${signedInCustomer.firstName}`],
    ];
    for (const [link, heading] of destinations) {
      await test.step(`open ${link}`, async () => {
        await navBar.goTo(link);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
        await expect(navBar.link(link)).toHaveAttribute('aria-current', 'page');
      });
    }
  });

  test('customer can transfer money between their own accounts', { tag: '@transfers' }, async ({
    signedInCustomer,
    transferPage,
    bankApi,
  }) => {
    const [checking, savings] = signedInCustomer.accounts;
    await transferPage.open();
    const reference = await transferPage.send({
      from: checking.name,
      to: savings.name,
      amount: '25.00',
    });

    expect(reference).toMatch(/^TRF-\d{6}$/);
    // verify the ledger behind the UI, not just the confirmation screen
    expect(await bankApi.balanceOf(checking.id)).toBe(checking.balance - 25_00);
    expect(await bankApi.balanceOf(savings.id)).toBe(savings.balance + 25_00);
  });
});
