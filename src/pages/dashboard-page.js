'use strict';

const { BasePage } = require('./base-page');
const { DataTable } = require('../components/data-table');
const { parseUSD } = require('../utils/money');

class DashboardPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/dashboard';
    this.welcome = page.getByRole('heading', { level: 1, name: /^Welcome back/ });
    this.accountCards = page.getByTestId('account-card');
    this.limitRemaining = page.getByTestId('limit-remaining');
    this.recentActivity = new DataTable(page.getByTestId('recent-transactions'));
  }

  accountCard(accountName) {
    return this.accountCards.filter({ has: this.page.getByTestId('account-name').getByText(accountName, { exact: true }) });
  }

  balanceLocator(accountName) {
    return this.accountCard(accountName).getByTestId('account-balance');
  }

  /** Balance shown on the card, in cents. */
  async balanceOf(accountName) {
    return parseUSD(await this.balanceLocator(accountName).innerText());
  }

  async remainingLimit() {
    return parseUSD(await this.limitRemaining.innerText());
  }
}

module.exports = { DashboardPage };
