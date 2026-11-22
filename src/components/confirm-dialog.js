'use strict';

/** Modal confirmation dialog used for destructive actions. */
class ConfirmDialog {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.root = page.getByRole('dialog');
    this.title = this.root.getByRole('heading');
  }

  async confirm(buttonName) {
    await this.root.getByRole('button', { name: buttonName }).click();
  }

  async cancel() {
    await this.root.getByRole('button', { name: 'Cancel' }).click();
  }
}

module.exports = { ConfirmDialog };
