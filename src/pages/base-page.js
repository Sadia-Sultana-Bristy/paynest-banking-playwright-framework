'use strict';

const { expect } = require('@playwright/test');
const { Toast } = require('../components/toast');

/**
 * Base class for every page object.
 *
 * Holds the behaviour all screens share (navigation, readiness, form
 * helpers, field errors, toasts) so page objects only describe what is
 * unique to their screen. These helpers are the framework's "custom
 * commands": small, intention-revealing steps reused across the suite.
 */
class BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.toast = new Toast(page);
    this.formError = page.getByTestId('form-error');
    /** Route of this page, e.g. '/#/dashboard'. Subclasses override. */
    this.path = '/';
  }

  /** Hash route of this page, e.g. '#/dashboard'. */
  get route() {
    return this.path.slice(this.path.indexOf('#'));
  }

  /**
   * Navigates to the page and waits until the SPA has rendered it with fresh
   * data. Navigating to the URL the browser is already on would be a no-op
   * for a hash route, so in that case the page is reloaded instead.
   */
  async open() {
    if (this.page.url().endsWith(this.route)) await this.page.reload();
    else await this.page.goto(this.path);
    await this.waitForReady();
    return this;
  }

  /**
   * The SPA stamps data-route on #app and clears aria-busy once the route's
   * data is loaded and rendered. Waiting on both avoids racing a previous
   * screen that was also "ready".
   */
  async waitForReady(route = this.route) {
    const app = this.page.locator('#app');
    await expect(app).toHaveAttribute('data-route', route);
    await expect(app).toHaveAttribute('aria-busy', 'false');
  }

  heading(name) {
    return this.page.getByRole('heading', { level: 1, name });
  }

  /** Inline validation message rendered under a form field. */
  fieldError(field) {
    return this.page.getByTestId(`error-${field}`);
  }

  /**
   * Fills a form by accessible label. Values may be strings (text inputs) or
   * { option: 'partial label' } for selects whose labels contain dynamic data.
   *   await this.fillForm({ Nickname: 'Rent', Bank: { option: 'City Union' } })
   */
  async fillForm(fields) {
    for (const [label, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const control = this.page.getByLabel(label, { exact: true });
      if (value && typeof value === 'object' && 'option' in value) {
        await this.selectOptionContaining(control, value.option);
      } else {
        await control.fill(String(value));
      }
    }
  }

  /**
   * Selects the first <option> whose text contains `text`.
   * Needed because option labels include live data such as balances.
   */
  async selectOptionContaining(select, text) {
    const options = await select.locator('option').evaluateAll((nodes) =>
      nodes.map((o) => ({ value: o.value, label: o.textContent.trim() })),
    );
    const match = options.find((o) => o.label.includes(text));
    if (!match) {
      throw new Error(`No option containing "${text}". Available: ${options.map((o) => o.label).join(' | ')}`);
    }
    await select.selectOption(match.value);
  }

  async expectToast(message) {
    await this.toast.expectMessage(message);
  }
}

module.exports = { BasePage };
