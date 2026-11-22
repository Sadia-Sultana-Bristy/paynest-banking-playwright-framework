'use strict';

const { expect } = require('@playwright/test');

/** Global notification shown after create / update / delete actions. */
class Toast {
  constructor(page) {
    this.root = page.getByTestId('toast');
  }

  async expectMessage(message) {
    await expect(this.root).toBeVisible();
    await expect(this.root).toHaveText(message);
  }
}

module.exports = { Toast };
