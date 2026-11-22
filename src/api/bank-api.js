'use strict';

const { BaseApiClient } = require('./base-api-client');
const { generateTotp } = require('../utils/totp');

/**
 * Customer-facing PayNest API. Used for fast test setup (arrange) and for
 * verifying state behind the UI (assert), never as a replacement for the
 * user journey a test is meant to cover.
 *
 * When constructed with `page.request`, the session cookie is shared with
 * the browser context, so `signIn()` authenticates the page without
 * driving the login UI.
 */
class BankApi extends BaseApiClient {
  constructor(request) {
    super(request, { name: 'bank-api' });
  }

  health() {
    return this.get('/api/health');
  }

  /** Full sign-in (password + TOTP), sets the pn_session cookie on this request context. */
  async signIn({ username, password, mfaSecret }) {
    const { challengeId } = await this.post('/api/auth/login', { username, password });
    return this.post('/api/auth/mfa', { challengeId, code: generateTotp(mfaSecret) });
  }

  signOut() {
    return this.post('/api/auth/logout');
  }

  me() {
    return this.get('/api/me');
  }

  accounts() {
    return this.get('/api/accounts');
  }

  async balanceOf(accountId) {
    const account = (await this.accounts()).find((a) => a.id === accountId);
    if (!account) throw new Error(`Account ${accountId} not found for the signed-in customer`);
    return account.balance;
  }

  limits() {
    return this.get('/api/limits');
  }

  transactions(filters = {}) {
    return this.get('/api/transactions', filters);
  }

  payees() {
    return this.get('/api/payees');
  }

  addPayee(payee) {
    return this.post('/api/payees', payee);
  }

  transfer(transfer) {
    return this.post('/api/transfers', transfer);
  }

  // admin
  customers() {
    return this.get('/api/admin/customers');
  }

  lockCustomer(id) {
    return this.post(`/api/admin/customers/${id}/lock`);
  }

  unlockCustomer(id) {
    return this.post(`/api/admin/customers/${id}/unlock`);
  }
}

module.exports = { BankApi };
