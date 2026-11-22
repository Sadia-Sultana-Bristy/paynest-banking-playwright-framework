'use strict';

/**
 * Seed data for manual exploration of the demo app.
 * Automated tests never rely on these records: every test creates its own
 * customer through the test-support API so tests stay isolated in parallel.
 *
 * Get a current MFA code for a seeded user with:  npm run mfa -- <mfaSecret>
 */
module.exports = function seed(store) {
  store.createUser({
    username: 'admin.ops',
    password: 'Admin#2026',
    firstName: 'Olivia',
    lastName: 'Park',
    role: 'admin',
    mfaSecret: 'paynest-admin-secret',
  });

  const demo = store.createUser({
    username: 'jane.doe',
    password: 'Demo#2026',
    firstName: 'Jane',
    lastName: 'Doe',
    mfaSecret: 'paynest-demo-secret',
    accounts: [
      { type: 'CHECKING', balance: 482550 },
      { type: 'SAVINGS', balance: 1250000 },
    ],
    payees: [{ nickname: 'Landlord', accountNumber: '1029384756', bankCode: 'CTU02' }],
  });

  const [checking] = store.accountsFor(demo.id);
  store.record(demo.id, checking.id, { type: 'DEBIT', amount: 6420, description: 'Card purchase – FreshMart Grocery' });
  store.record(demo.id, checking.id, { type: 'CREDIT', amount: 325000, description: 'Salary – Acme Corp' });
};
