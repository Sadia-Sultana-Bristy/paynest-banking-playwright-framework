'use strict';

/**
 * Generic reader for the app's data tables. Turns rows into plain objects
 * keyed by column header so tests can assert on data, not on DOM structure:
 *
 *   const rows = await table.rows();
 *   expect(rows[0]).toMatchObject({ Description: 'Opening deposit' });
 */
class DataTable {
  /** @param {import('@playwright/test').Locator} root the <table> element */
  constructor(root) {
    this.root = root;
    this.bodyRows = root.locator('tbody tr');
  }

  async headers() {
    return (await this.root.locator('thead th').allInnerTexts()).map((h) => h.trim());
  }

  async rows() {
    return this.root.evaluate((table) => {
      const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      return [...table.querySelectorAll('tbody tr')]
        .filter((tr) => !tr.hidden)
        .map((tr) =>
          Object.fromEntries([...tr.querySelectorAll('td')].map((td, i) => [headers[i], td.textContent.trim()])),
        );
    });
  }

  /** Row locator that contains the given text in any cell. */
  rowContaining(text) {
    return this.bodyRows.filter({ hasText: text });
  }

  async column(header) {
    return (await this.rows()).map((row) => row[header]);
  }
}

module.exports = { DataTable };
