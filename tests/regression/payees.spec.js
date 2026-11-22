'use strict';

const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { buildPayee } = require('../../src/utils/data-factory');
const { BANK_NAMES } = require('../../src/pages/payees-page');
const validationCases = require('../data/payee-validation.json');

test.describe('Payees', { tag: ['@regression', '@payees'] }, () => {
  // Requesting signedInCustomer creates the customer and signs the browser in.
  test.beforeEach(async ({ signedInCustomer, payeesPage }) => {
    await payeesPage.open();
  });

  test('a new customer sees an empty payee list', async ({ payeesPage }) => {
    await expect(payeesPage.emptyState).toHaveText("You haven't added any payees yet.");
  });

  test('customer adds a payee and sees it with a masked account number', { tag: '@critical' }, async ({
    payeesPage,
    bankApi,
  }) => {
    const payee = buildPayee({ bankCode: 'HBS03' });
    await payeesPage.addPayee(payee);

    await payeesPage.expectToast(`Payee ${payee.nickname} added`);
    const rows = await payeesPage.table.rows();
    expect(rows).toEqual([
      expect.objectContaining({
        Nickname: payee.nickname,
        Bank: BANK_NAMES.HBS03,
        Account: `•••• ${payee.accountNumber.slice(-4)}`,
      }),
    ]);
    // the full account number must never be rendered
    await expect(payeesPage.page.getByText(payee.accountNumber)).toHaveCount(0);
    expect(await bankApi.payees()).toHaveLength(1);
  });

  for (const data of validationCases) {
    test(`validation: ${data.case}`, async ({ payeesPage }) => {
      await payeesPage.addPayee(data.payee);
      await expect(payeesPage.fieldError(data.field)).toHaveText(data.message);
      await expect(payeesPage.emptyState).toBeVisible();
    });
  }

  test('the same payee cannot be added twice', async ({ payeesPage }) => {
    const payee = buildPayee();
    await payeesPage.addPayee(payee);
    await payeesPage.expectToast(`Payee ${payee.nickname} added`);

    await payeesPage.addPayee({ ...payee, nickname: `${payee.nickname} copy` });
    await expect(payeesPage.fieldError('accountNumber')).toHaveText('This payee already exists');
    await expect(payeesPage.table.bodyRows).toHaveCount(1);
  });

  test.describe('removing a payee', () => {
    const existing = buildPayee({ nickname: 'Old Gym' });
    test.use({ customerProfile: { payees: [existing] } });

    test.beforeEach(async ({ payeesPage }) => {
      await payeesPage.startRemoving(existing.nickname);
      await expect(payeesPage.dialog.title).toHaveText('Remove payee?');
    });

    test('cancel keeps the payee', async ({ payeesPage }) => {
      await payeesPage.dialog.cancel();
      await expect(payeesPage.dialog.root).toBeHidden();
      await expect(payeesPage.row(existing.nickname)).toBeVisible();
    });

    test('confirm removes the payee', async ({ payeesPage, bankApi }) => {
      await payeesPage.dialog.confirm('Remove');
      await payeesPage.expectToast('Payee removed');
      await expect(payeesPage.emptyState).toBeVisible();
      expect(await bankApi.payees()).toEqual([]);
    });
  });
});
