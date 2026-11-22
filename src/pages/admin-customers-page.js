'use strict';

const { BasePage } = require('./base-page');
const { DataTable } = require('../components/data-table');

class AdminCustomersPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/admin';
    this.title = this.heading('Customer administration');
    this.accessDenied = this.heading('Access denied');
    this.searchInput = page.getByLabel('Search customers');
    this.table = new DataTable(page.getByTestId('customers-table'));
  }

  row(username) {
    return this.page.locator(`[data-testid="customer-row"][data-username="${username}"]`);
  }

  status(username) {
    return this.row(username).getByTestId('customer-status');
  }

  async lock(username) {
    await this.page.getByRole('button', { name: `Lock ${username}`, exact: true }).click();
  }

  async unlock(username) {
    await this.page.getByRole('button', { name: `Unlock ${username}`, exact: true }).click();
  }

  async search(text) {
    await this.searchInput.fill(text);
  }
}

module.exports = { AdminCustomersPage };
