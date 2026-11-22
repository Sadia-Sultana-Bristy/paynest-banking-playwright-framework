'use strict';

const { BasePage } = require('./base-page');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/login';
    this.title = this.heading('Sign in to PayNest');
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    /** Message carried over from a redirect, e.g. after sign-out or session expiry. */
    this.notice = page.getByTestId('flash');
  }

  async signIn(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}

module.exports = { LoginPage };
