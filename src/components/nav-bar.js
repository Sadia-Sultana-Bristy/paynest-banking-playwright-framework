'use strict';

/** Top navigation shown on every authenticated page. */
class NavBar {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.root = page.getByRole('navigation', { name: 'Main' });
    this.signedInUser = page.getByTestId('signed-in-user');
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
  }

  link(name) {
    return this.root.getByRole('link', { name, exact: true });
  }

  async goTo(name) {
    await this.link(name).click();
  }

  async signOut() {
    await this.signOutButton.click();
  }
}

module.exports = { NavBar };
