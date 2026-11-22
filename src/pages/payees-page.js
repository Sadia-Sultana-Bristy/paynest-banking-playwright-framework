'use strict';

const { BasePage } = require('./base-page');
const { DataTable } = require('../components/data-table');
const { ConfirmDialog } = require('../components/confirm-dialog');

const BANK_NAMES = { PNB01: 'PayNest Bank', CTU02: 'City Union Bank', HBS03: 'Harbour Savings' };

class PayeesPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/payees';
    this.title = this.heading('Payees');
    this.table = new DataTable(page.getByTestId('payees-table'));
    this.emptyState = page.getByTestId('payees-empty');
    this.saveButton = page.getByRole('button', { name: 'Save payee' });
    this.dialog = new ConfirmDialog(page);
  }

  /** @param {{nickname?: string, accountNumber?: string, bankCode?: string}} payee */
  async addPayee({ nickname, accountNumber, bankCode }) {
    await this.fillForm({
      Nickname: nickname,
      'Account number': accountNumber,
      Bank: bankCode ? { option: BANK_NAMES[bankCode] || bankCode } : undefined,
    });
    await this.saveButton.click();
  }

  row(nickname) {
    return this.table.rowContaining(nickname);
  }

  async startRemoving(nickname) {
    await this.page.getByRole('button', { name: `Remove ${nickname}` }).click();
  }
}

module.exports = { PayeesPage, BANK_NAMES };
