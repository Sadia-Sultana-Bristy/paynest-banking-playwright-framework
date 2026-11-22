'use strict';

const { BasePage } = require('./base-page');
const { generateTotp } = require('../utils/totp');

class MfaPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/mfa';
    this.title = this.heading("Verify it's you");
    this.codeInput = page.getByLabel('Verification code');
    this.verifyButton = page.getByRole('button', { name: 'Verify' });
  }

  async submitCode(code) {
    await this.codeInput.fill(code);
    await this.verifyButton.click();
  }

  /** Generates the current TOTP from the customer's secret, like an authenticator app. */
  async verifyWithSecret(mfaSecret) {
    await this.submitCode(generateTotp(mfaSecret));
  }
}

module.exports = { MfaPage };
