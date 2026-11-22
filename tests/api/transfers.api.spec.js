'use strict';

/**
 * API layer: business rules checked directly against the REST API.
 * Faster and more precise than UI tests for rule combinations, and they
 * prove the server enforces rules the UI also validates client-side.
 */
const { test, expect } = require('../../src/fixtures/api.fixtures');

test.describe('Transfers API', { tag: ['@api', '@regression', '@transfers'] }, () => {
  test('a completed transfer returns a reference and moves the exact amount', async ({ signedInApi, customer }) => {
    const [checking, savings] = customer.accounts;
    const result = await signedInApi.transfer({ fromAccountId: checking.id, toAccountId: savings.id, amount: 10_01 });

    expect(result).toMatchObject({ status: 'COMPLETED', amount: 10_01, reference: expect.stringMatching(/^TRF-\d{6}$/) });
    expect(await signedInApi.balanceOf(checking.id)).toBe(checking.balance - 10_01);
    expect(await signedInApi.balanceOf(savings.id)).toBe(savings.balance + 10_01);
  });

  test('a dry run validates without moving money', async ({ signedInApi, customer }) => {
    const [checking, savings] = customer.accounts;
    const result = await signedInApi.transfer({ fromAccountId: checking.id, toAccountId: savings.id, amount: 500_00, dryRun: true });

    expect(result).toEqual({ valid: true });
    expect(await signedInApi.balanceOf(checking.id)).toBe(checking.balance);
    expect((await signedInApi.limits()).usedToday).toBe(0);
  });

  const invalid = [
    { case: 'zero amount', body: { amount: 0 }, error: 'Enter an amount greater than $0.00' },
    { case: 'fractional cents', body: { amount: 10.5 }, error: 'Enter an amount greater than $0.00' },
    { case: 'amount as a string', body: { amount: 'abc' }, error: 'Enter an amount greater than $0.00' },
    { case: 'same source and destination', body: { sameAccount: true, amount: 100 }, error: 'Choose a different account to transfer to' },
    { case: 'memo over 60 characters', body: { amount: 100, memo: 'x'.repeat(61) }, error: 'Memo must be 60 characters or fewer' },
  ];
  for (const data of invalid) {
    test(`rejects ${data.case} with 422`, async ({ signedInApi, customer }) => {
      const [checking, savings] = customer.accounts;
      const { sameAccount, ...rest } = data.body;
      const response = await signedInApi.raw('POST', '/api/transfers', {
        data: { fromAccountId: checking.id, toAccountId: sameAccount ? checking.id : savings.id, ...rest },
      });
      expect(response.status()).toBe(422);
      expect(await response.json()).toMatchObject({ error: data.error });
    });
  }

  test("cannot move money out of another customer's account", { tag: '@security' }, async ({
    signedInApi,
    customer,
    testSupport,
  }) => {
    const victim = await testSupport.createCustomer();
    const response = await signedInApi.raw('POST', '/api/transfers', {
      data: { fromAccountId: victim.accounts[0].id, toAccountId: customer.accounts[0].id, amount: 100 },
    });
    expect(response.status()).toBe(422);
    expect(await response.json()).toMatchObject({ field: 'fromAccountId' });
  });

  test('requests without a session are rejected with 401', { tag: '@security' }, async ({ bankApi }) => {
    for (const path of ['/api/accounts', '/api/transactions', '/api/payees', '/api/limits']) {
      const response = await bankApi.raw('GET', path);
      expect(response.status(), path).toBe(401);
    }
  });
});
