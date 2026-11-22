'use strict';

const { expect: baseExpect } = require('@playwright/test');
const { formatUSD } = require('../utils/money');

/**
 * Domain-specific assertions. They read like the business rule being checked
 * and produce failure messages a reviewer can understand without the code.
 */
const expect = baseExpect.extend({
  /** await expect(dashboard.balanceLocator('Everyday Checking')).toShowMoney(2_400_00) */
  async toShowMoney(locator, expectedCents, options = {}) {
    const expected = formatUSD(expectedCents);
    let actual;
    let pass;
    try {
      await baseExpect(locator).toHaveText(expected, { timeout: options.timeout ?? this.timeout });
      pass = true;
    } catch {
      actual = await locator.innerText().catch(() => '<element not found>');
      pass = false;
    }
    return {
      pass,
      name: 'toShowMoney',
      expected,
      actual,
      message: () =>
        pass
          ? `${this.utils.matcherHint('toShowMoney', undefined, undefined, { isNot: this.isNot })}\n\nExpected element not to show ${expected}`
          : `${this.utils.matcherHint('toShowMoney')}\n\nExpected: ${this.utils.printExpected(expected)}\nReceived: ${this.utils.printReceived(actual)}`,
    };
  },

  /** expect(rows).toBeSortedBy('Date', 'desc') */
  toBeSortedBy(rows, key, order = 'asc') {
    const values = rows.map((r) => r[key]);
    const sorted = [...values].sort((a, b) => (order === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a))));
    const pass = values.every((v, i) => v === sorted[i]);
    return {
      pass,
      name: 'toBeSortedBy',
      message: () =>
        `Expected rows ${pass && this.isNot ? 'not ' : ''}to be sorted by "${key}" (${order}).\nReceived order: ${this.utils.printReceived(values)}`,
    };
  },

  /** expect(csvText).toBeCsvWithHeader(['Date', 'Amount']) */
  toBeCsvWithHeader(text, expectedHeader) {
    const header = String(text).split(/\r?\n/)[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
    const pass = JSON.stringify(header) === JSON.stringify(expectedHeader);
    return {
      pass,
      name: 'toBeCsvWithHeader',
      message: () => `Expected CSV header ${this.utils.printExpected(expectedHeader)}\nReceived ${this.utils.printReceived(header)}`,
    };
  },
});

module.exports = { expect };
