'use strict';

const { test, expect } = require('../../src/fixtures/ui.fixtures');

test.describe('Admin: customer management', { tag: ['@regression', '@admin'] }, () => {
  test.beforeEach(async ({ signedInAdmin, adminPage }) => {
    await adminPage.open();
  });

  test('admin lands on customer administration without the customer pages', async ({ adminPage, navBar }) => {
    await expect(adminPage.title).toBeVisible();
    await expect(navBar.link('Admin')).toHaveAttribute('aria-current', 'page');
  });

  test('search narrows the customer list', async ({ adminPage, testSupport }) => {
    const target = await testSupport.createCustomer({ firstName: 'Searchable' });
    await adminPage.open();

    await adminPage.search(target.username);
    await expect(adminPage.table.bodyRows.locator('visible=true')).toHaveCount(1);
    await expect(adminPage.row(target.username)).toBeVisible();
  });

  test('locking a customer is reflected in the list and blocks their API access', { tag: '@security' }, async ({
    adminPage,
    testSupport,
    playwright,
    appConfig,
  }) => {
    const target = await testSupport.createCustomer();
    await adminPage.open();

    await adminPage.lock(target.username);
    await adminPage.expectToast(`${target.username} locked`);
    await expect(adminPage.status(target.username)).toHaveText('Locked');

    // the locked customer can no longer sign in
    const request = await playwright.request.newContext({ baseURL: appConfig.baseURL });
    const response = await request.post('/api/auth/login', { data: { username: target.username, password: target.password } });
    expect(response.status()).toBe(423);
    await request.dispose();

    await adminPage.unlock(target.username);
    await expect(adminPage.status(target.username)).toHaveText('Active');
  });
});
