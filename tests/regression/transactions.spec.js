'use strict';

const { test, expect } = require('../../src/fixtures/ui.fixtures');
const { DEFAULT_ACCOUNTS } = require('../../src/utils/data-factory');

// A customer with a known, fixed history so filters have something to prove.
const HISTORY = [
  { accountIndex: 0, type: 'DEBIT', amount: 64_20, description: 'Card purchase – FreshMart Grocery', daysAgo: 3 },
  { accountIndex: 0, type: 'CREDIT', amount: 3_250_00, description: 'Salary – Acme Corp', daysAgo: 1 },
  { accountIndex: 1, type: 'CREDIT', amount: 12_50, description: 'Interest payment', daysAgo: 2 },
];
// + one "Opening deposit" per funded account, created by the app
const TOTAL_ROWS = HISTORY.length + DEFAULT_ACCOUNTS.length;

test.describe('Transactions', { tag: ['@regression', '@transactions'] }, () => {
  test.use({ customerProfile: { history: HISTORY } });

  test.beforeEach(async ({ signedInCustomer, transactionsPage }) => {
    await transactionsPage.open();
  });

  test('lists every transaction, newest first', async ({ transactionsPage }) => {
    await expect(transactionsPage.resultsCount).toHaveText(`${TOTAL_ROWS} transactions`);
    const rows = await transactionsPage.table.rows();
    expect(rows).toBeSortedBy('Date', 'desc');
    expect(rows[0]).toMatchObject({ Description: 'Salary – Acme Corp', Amount: '+$3,250.00' });
  });

  test('"Money out" shows only debits', async ({ transactionsPage }) => {
    await transactionsPage.filter({ type: 'DEBIT' });
    await expect(transactionsPage.resultsCount).toHaveText('1 transaction');
    expect(await transactionsPage.table.column('Amount')).toEqual(['-$64.20']);
  });

  test('filtering by account shows only that account', async ({ transactionsPage }) => {
    await transactionsPage.filter({ account: 'High-Yield Savings' });
    await expect(transactionsPage.resultsCount).toHaveText('2 transactions');
    const accounts = await transactionsPage.table.column('Account');
    expect(new Set(accounts)).toEqual(new Set(['High-Yield Savings']));
  });

  test('search matches the description', async ({ transactionsPage }) => {
    await transactionsPage.filter({ search: 'freshmart' });
    await expect(transactionsPage.resultsCount).toHaveText('1 transaction');
    await expect(transactionsPage.table.rowContaining('FreshMart Grocery')).toBeVisible();
  });

  test('a search with no matches shows the empty state', async ({ transactionsPage }) => {
    await transactionsPage.filter({ search: 'no-such-merchant' });
    await expect(transactionsPage.resultsCount).toHaveText('0 transactions');
    await expect(transactionsPage.emptyState).toHaveText('No transactions match your filters');
  });

  test('a completed transfer can be found by its reference', async ({ transactionsPage, bankApi, signedInCustomer }) => {
    const [checking, savings] = signedInCustomer.accounts;
    const { reference } = await bankApi.transfer({ fromAccountId: checking.id, toAccountId: savings.id, amount: 75_00 });

    await transactionsPage.open();
    await transactionsPage.filter({ search: reference });
    // one debit row on checking, one credit row on savings
    await expect(transactionsPage.resultsCount).toHaveText('2 transactions');
    expect((await transactionsPage.table.column('Amount')).sort()).toEqual(['+$75.00', '-$75.00']);
  });

  test('CSV export downloads the filtered statement', { tag: '@export' }, async ({ transactionsPage }) => {
    await transactionsPage.filter({ type: 'CREDIT' });
    await expect(transactionsPage.resultsCount).toHaveText('4 transactions');

    const { fileName, content } = await transactionsPage.exportCsv();

    expect(fileName).toMatch(/^paynest-statement-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content).toBeCsvWithHeader(['Date', 'Account', 'Description', 'Reference', 'Type', 'Amount', 'Balance']);
    const dataLines = content.trim().split('\n').slice(1);
    expect(dataLines).toHaveLength(4);
    expect(dataLines.every((line) => line.includes('"CREDIT"'))).toBe(true);
    expect(content).toContain('"Salary – Acme Corp"');
  });
});
