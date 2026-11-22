'use strict';

const { BasePage } = require('./base-page');
const { DataTable } = require('../components/data-table');

const TYPE_LABELS = { ALL: 'All types', CREDIT: 'Money in', DEBIT: 'Money out' };

class TransactionsPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/transactions';
    this.title = this.heading('Transactions');
    this.accountFilter = page.getByLabel('Account', { exact: true });
    this.typeFilter = page.getByLabel('Type', { exact: true });
    this.searchInput = page.getByLabel('Search', { exact: true });
    this.exportLink = page.getByRole('link', { name: 'Export CSV' });
    this.resultsCount = page.getByTestId('results-count');
    this.table = new DataTable(page.getByTestId('transactions-table'));
    this.emptyState = page.getByTestId('transactions-table-empty');
  }

  /** @param {{account?: string, type?: 'ALL'|'CREDIT'|'DEBIT', search?: string}} filters */
  async filter({ account, type, search }) {
    if (account) await this.accountFilter.selectOption({ label: account });
    if (type) await this.typeFilter.selectOption({ label: TYPE_LABELS[type] });
    if (search !== undefined) await this.searchInput.fill(search);
  }

  /** Clicks Export CSV and returns the downloaded file's name and text. */
  async exportCsv() {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.exportLink.click()]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { fileName: download.suggestedFilename(), content: Buffer.concat(chunks).toString('utf8'), download };
  }
}

module.exports = { TransactionsPage };
