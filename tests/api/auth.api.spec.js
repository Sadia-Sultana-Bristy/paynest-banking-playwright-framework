'use strict';

const { test, expect } = require('../../src/fixtures/api.fixtures');
const { generateTotp, invalidTotp } = require('../../src/utils/totp');

test.describe('Auth API', { tag: ['@api', '@auth'] }, () => {
  test('health endpoint reports the service as UP', { tag: '@smoke' }, async ({ bankApi }) => {
    expect(await bankApi.health()).toMatchObject({ status: 'UP', service: 'paynest-api' });
  });

  test('password alone does not create a session; MFA does', { tag: ['@smoke', '@security'] }, async ({ bankApi, customer }) => {
    const { challengeId } = await bankApi.post('/api/auth/login', { username: customer.username, password: customer.password });
    expect(challengeId).toBeTruthy();
    expect((await bankApi.raw('GET', '/api/me')).status()).toBe(401);

    await bankApi.post('/api/auth/mfa', { challengeId, code: generateTotp(customer.mfaSecret) });
    expect(await bankApi.me()).toMatchObject({ username: customer.username, role: 'customer' });
  });

  test('the session response never exposes secrets', { tag: '@security' }, async ({ signedInApi }) => {
    const me = await signedInApi.me();
    expect(me).not.toHaveProperty('password');
    expect(me).not.toHaveProperty('mfaSecret');
  });

  test('an MFA challenge cannot be reused after success', { tag: '@security' }, async ({ bankApi, customer }) => {
    const { challengeId } = await bankApi.post('/api/auth/login', { username: customer.username, password: customer.password });
    await bankApi.post('/api/auth/mfa', { challengeId, code: generateTotp(customer.mfaSecret) });

    const replay = await bankApi.raw('POST', '/api/auth/mfa', { data: { challengeId, code: generateTotp(customer.mfaSecret) } });
    expect(replay.status()).toBe(401);
  });

  test('a wrong MFA code is rejected with 401', async ({ bankApi, customer }) => {
    const { challengeId } = await bankApi.post('/api/auth/login', { username: customer.username, password: customer.password });
    const response = await bankApi.raw('POST', '/api/auth/mfa', { data: { challengeId, code: invalidTotp(customer.mfaSecret) } });
    expect(response.status()).toBe(401);
  });
});
