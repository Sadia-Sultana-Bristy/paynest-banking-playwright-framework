'use strict';

/**
 * End-to-end journey: a customer signs in through the real login + MFA UI,
 * adds a payee, pays them, finds the payment in their history and downloads
 * a statement. Every step goes through the UI; the API is used only to check
 * the ledger at the end.
 */
const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { buildPayee, uniqueMemo } = require('../../src/utils/data-factory');
const { formatUSD } = require('../../src/utils/money');

test.describe('E2E: pay a new payee', { tag: ['@e2e', '@critical'] }, () => {
  test('customer adds a payee, pays them and sees it on their statement', async ({
    customer,
    loginPage,
    mfaPage,
    dashboardPage,
    navBar,
    payeesPage,
    transferPage,
    transactionsPage,
    bankApi,
  }) => {
    const [checking] = customer.accounts;
    const payee = buildPayee({ nickname: 'Daycare Sunbeam', bankCode: 'CTU02' });
    const memo = uniqueMemo('Dec fees');
    const amountCents = 1_250_00;
    let reference;

    await test.step('sign in with password and MFA', async () => {
      await loginPage.open();
      await loginPage.signIn(customer.username, customer.password);
      await mfaPage.verifyWithSecret(customer.mfaSecret);
      await expect(dashboardPage.welcome).toBeVisible();
    });

    await test.step('add the payee', async () => {
      await navBar.goTo('Payees');
      await payeesPage.waitForReady();
      await payeesPage.addPayee(payee);
      await payeesPage.expectToast(`Payee ${payee.nickname} added`);
    });

    await test.step('pay the payee (large transfer, so a warning is shown on review)', async () => {
      await navBar.goTo('Transfer');
      await transferPage.waitForReady();
      await transferPage.submitForReview({ from: checking.name, payee: payee.nickname, amount: '1,250.00', memo });
      await expect(transferPage.largeTransferWarning).toBeVisible();
      await expect(transferPage.reviewTo).toContainText(`${payee.nickname} – City Union Bank •••• ${payee.accountNumber.slice(-4)}`);
      await transferPage.confirmButton.click();
      reference = (await transferPage.reference.innerText()).trim();
      expect(reference).toMatch(/^TRF-\d+$/);
    });

    await test.step('dashboard reflects the new balance and daily limit', async () => {
      await navBar.goTo('Dashboard');
      await dashboardPage.waitForReady();
      await expect(dashboardPage.balanceLocator(checking.name)).toShowMoney(checking.balance - amountCents);
      await expect(dashboardPage.limitRemaining).toHaveText(formatUSD(500_000 - amountCents));
      await expect(dashboardPage.recentActivity.rowContaining(reference)).toBeVisible();
    });

    await test.step('payment is in the history and in the exported statement', async () => {
      await navBar.goTo('Transactions');
      await transactionsPage.waitForReady();
      await transactionsPage.filter({ search: reference });
      await expect(transactionsPage.resultsCount).toHaveText('1 transaction');
      const [row] = await transactionsPage.table.rows();
      expect(row).toMatchObject({
        Description: `Transfer to ${payee.nickname} (City Union Bank) – ${memo}`,
        Amount: `-${formatUSD(amountCents)}`,
        Reference: reference,
      });

      const { content } = await transactionsPage.exportCsv();
      expect(content).toContain(reference);
    });

    await test.step('ledger agrees with the UI', async () => {
      expect(await bankApi.balanceOf(checking.id)).toBe(checking.balance - amountCents);
    });
  });
});
