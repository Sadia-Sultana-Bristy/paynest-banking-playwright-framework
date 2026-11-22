'use strict';

const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { formatUSD } = require('../../src/utils/money');
const { uniqueMemo, buildPayee } = require('../../src/utils/data-factory');
const validationCases = require('../data/transfer-validation.json');

test.describe('Transfers', { tag: ['@regression', '@transfers'] }, () => {
  test.beforeEach(async ({ signedInCustomer, transferPage }) => {
    await transferPage.open();
  });

  test('internal transfer moves money between accounts and is shown on the dashboard', { tag: '@critical' }, async ({
    signedInCustomer,
    transferPage,
    dashboardPage,
  }) => {
    const [checking, savings] = signedInCustomer.accounts;
    const memo = uniqueMemo('Savings');

    await transferPage.submitForReview({ from: checking.name, to: savings.name, amount: '150.75', memo });

    await test.step('review screen repeats the details back', async () => {
      await expect(transferPage.reviewFrom).toContainText(checking.name);
      await expect(transferPage.reviewTo).toContainText(savings.name);
      await expect(transferPage.reviewAmount).toShowMoney(150_75);
      await expect(transferPage.reviewMemo).toHaveText(memo);
      await expect(transferPage.largeTransferWarning).toBeHidden();
    });

    await transferPage.confirmButton.click();
    await expect(transferPage.success).toContainText(`${formatUSD(150_75)} was sent to ${savings.name}`);

    await test.step('balances and daily limit update on the dashboard', async () => {
      await dashboardPage.open();
      await expect(dashboardPage.balanceLocator(checking.name)).toShowMoney(checking.balance - 150_75);
      await expect(dashboardPage.balanceLocator(savings.name)).toShowMoney(savings.balance + 150_75);
      await expect(dashboardPage.limitRemaining).toHaveText(formatUSD(500_000 - 150_75));
    });
  });

  // ---------- data-driven validation ----------
  for (const data of validationCases) {
    test(`validation: ${data.case}`, async ({ transferPage }) => {
      await transferPage.submitForReview({ from: 'Everyday Checking', to: 'High-Yield Savings', amount: data.amount });

      await expect(transferPage.fieldError(data.field)).toHaveText(data.message);
      await expect(transferPage.amountInput).toHaveAttribute('aria-invalid', 'true');
      await expect(transferPage.review).toBeHidden();
    });
  }

  test('cannot transfer to the same account it comes from', async ({ transferPage }) => {
    await transferPage.submitForReview({ from: 'Everyday Checking', to: 'Everyday Checking', amount: '10' });
    await expect(transferPage.fieldError('toAccountId')).toHaveText('Choose a different account to transfer to');
  });

  test.describe('daily limit', () => {
    // A customer with more money than the daily limit, so the limit (not the balance) is what blocks.
    test.use({
      customerProfile: {
        accounts: [
          { type: 'CHECKING', name: 'Everyday Checking', balance: 900_000 },
          { type: 'SAVINGS', name: 'High-Yield Savings', balance: 0 },
        ],
      },
    });

    test('a transfer above the remaining daily limit is blocked', { tag: '@limits' }, async ({ transferPage, bankApi, signedInCustomer }) => {
      const [checking, savings] = signedInCustomer.accounts;
      await bankApi.transfer({ fromAccountId: checking.id, toAccountId: savings.id, amount: 4_000_00 }); // arrange via API

      await transferPage.open();
      await transferPage.submitForReview({ from: checking.name, to: savings.name, amount: '1000.01' });
      await expect(transferPage.fieldError('amount')).toHaveText(
        'This transfer exceeds your daily limit. Remaining today: $1,000.00',
      );
    });

    test('a transfer for exactly the remaining limit is allowed', { tag: ['@limits', '@boundary'] }, async ({
      transferPage,
      bankApi,
      signedInCustomer,
    }) => {
      const [checking, savings] = signedInCustomer.accounts;
      await bankApi.transfer({ fromAccountId: checking.id, toAccountId: savings.id, amount: 4_000_00 });

      await transferPage.open();
      await transferPage.send({ from: checking.name, to: savings.name, amount: '1000.00' });
      expect((await bankApi.limits()).remaining).toBe(0);
    });
  });

  test('transfers of $1,000 or more show a large-transfer warning on review', { tag: '@boundary' }, async ({ transferPage }) => {
    await transferPage.submitForReview({ from: 'Everyday Checking', to: 'High-Yield Savings', amount: '1000.00' });
    await expect(transferPage.largeTransferWarning).toBeVisible();

    await transferPage.editButton.click();
    await transferPage.amountInput.fill('999.99');
    await transferPage.reviewButton.click();
    await expect(transferPage.largeTransferWarning).toBeHidden();
  });

  test('editing from the review screen keeps the entered values', async ({ transferPage }) => {
    const memo = uniqueMemo('Edit');
    await transferPage.submitForReview({ from: 'Everyday Checking', to: 'High-Yield Savings', amount: '42.10', memo });
    await transferPage.editButton.click();

    await expect(transferPage.amountInput).toHaveValue('42.10');
    await expect(transferPage.memoInput).toHaveValue(memo);
  });

  test.describe('to a saved payee', () => {
    const payee = buildPayee({ nickname: 'Landlord' });
    test.use({ customerProfile: { payees: [payee] } });

    test('payee transfer debits the source account only', async ({ transferPage, signedInCustomer, bankApi }) => {
      const [checking, savings] = signedInCustomer.accounts;
      await transferPage.open();
      await transferPage.send({ from: checking.name, payee: 'Landlord', amount: '800.00', memo: 'November rent' });

      expect(await bankApi.balanceOf(checking.id)).toBe(checking.balance - 800_00);
      expect(await bankApi.balanceOf(savings.id)).toBe(savings.balance);
    });
  });
});
