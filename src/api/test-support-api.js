'use strict';

const { BaseApiClient } = require('./base-api-client');
const { buildCustomer } = require('../utils/data-factory');

/**
 * Test-support endpoints that exist only in non-production environments.
 * Each test creates the exact customer it needs and deletes it afterwards,
 * which is what makes fully parallel execution safe.
 */
class TestSupportApi extends BaseApiClient {
  constructor(request, key) {
    super(request, { name: 'test-support', headers: { 'x-test-support-key': key } });
    this.created = [];
  }

  /**
   * @param {object} overrides see buildCustomer() in utils/data-factory.js
   * @returns {Promise<{id, username, password, mfaSecret, firstName, lastName, role, accounts, payees}>}
   */
  async createCustomer(overrides = {}) {
    const customer = await this.post('/api/test-support/customers', buildCustomer(overrides));
    this.created.push(customer.id);
    return customer;
  }

  createAdmin(overrides = {}) {
    return this.createCustomer({ role: 'admin', accounts: [], ...overrides });
  }

  deleteCustomer(id) {
    return this.delete(`/api/test-support/customers/${id}`);
  }

  /** Teardown: remove everything this client created. Safe to call twice. */
  async cleanup() {
    const ids = this.created.splice(0);
    await Promise.allSettled(ids.map((id) => this.deleteCustomer(id)));
  }
}

module.exports = { TestSupportApi };
