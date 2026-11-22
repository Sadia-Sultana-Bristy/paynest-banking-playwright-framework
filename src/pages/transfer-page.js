'use strict';

const { BasePage } = require('./base-page');

/**
 * "Move money" flow: form -> review -> confirmation.
 * One page object covers all three steps because they share a route.
 */
class TransferPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/transfer';
    this.title = this.heading('Move money');
    this.fromSelect = page.getByLabel('From account');
    this.toAccountSelect = page.getByLabel('To account');
    this.payeeSelect = page.getByLabel('Payee', { exact: true });
    this.ownAccountRadio = page.getByRole('radio', { name: 'One of my accounts' });
    this.payeeRadio = page.getByRole('radio', { name: 'A saved payee' });
    this.amountInput = page.getByLabel('Amount (USD)');
    this.memoInput = page.getByLabel('Memo (optional)');
    this.reviewButton = page.getByRole('button', { name: 'Review transfer' });

    // review step
    this.review = page.getByTestId('transfer-review');
    this.reviewFrom = page.getByTestId('review-from');
    this.reviewTo = page.getByTestId('review-to');
    this.reviewAmount = page.getByTestId('review-amount');
    this.reviewMemo = page.getByTestId('review-memo');
    this.largeTransferWarning = page.getByTestId('large-transfer-warning');
    this.confirmButton = page.getByRole('button', { name: 'Confirm transfer' });
    this.editButton = page.getByRole('button', { name: 'Edit' });

    // confirmation step
    this.success = page.getByTestId('transfer-success');
    this.reference = page.getByTestId('transfer-reference');
    this.anotherTransferButton = page.getByRole('button', { name: 'Make another transfer' });
  }

  /**
   * Fills the transfer form.
   * @param {{from?: string, to?: string, payee?: string, amount: string, memo?: string}} transfer
   *   `from`, `to` and `payee` are partial option labels (account or payee names).
   */
  async fill({ from, to, payee, amount, memo }) {
    if (from) await this.selectOptionContaining(this.fromSelect, from);
    if (payee) {
      await this.payeeRadio.check();
      await this.selectOptionContaining(this.payeeSelect, payee);
    } else {
      await this.ownAccountRadio.check();
      if (to) await this.selectOptionContaining(this.toAccountSelect, to);
    }
    await this.amountInput.fill(amount);
    if (memo !== undefined) await this.memoInput.fill(memo);
  }

  async submitForReview(transfer) {
    await this.fill(transfer);
    await this.reviewButton.click();
  }

  /** Completes the whole flow and returns the transfer reference number. */
  async send(transfer) {
    await this.submitForReview(transfer);
    await this.confirmButton.click();
    await this.success.waitFor();
    return (await this.reference.innerText()).trim();
  }
}

module.exports = { TransferPage };
