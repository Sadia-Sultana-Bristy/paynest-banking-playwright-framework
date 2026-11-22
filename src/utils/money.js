'use strict';

/**
 * Money helpers. The framework works in integer cents everywhere and only
 * converts to display strings at the UI boundary, exactly like the product.
 */

const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 123456 -> "$1,234.56" */
const formatUSD = (cents) => formatter.format(cents / 100);

/** "$1,234.56" | "-$64.20" | "+$3,250.00" -> integer cents */
function parseUSD(text) {
  const cleaned = String(text).replace(/[^0-9.-]/g, '');
  if (!cleaned || Number.isNaN(Number(cleaned))) throw new Error(`Cannot parse money value from "${text}"`);
  return Math.round(Number(cleaned) * 100);
}

/** 1234.5 -> 123450 */
const dollarsToCents = (dollars) => Math.round(Number(dollars) * 100);

/** 123450 -> "1234.50" (the format a user types into an amount field) */
const centsToInput = (cents) => (cents / 100).toFixed(2);

module.exports = { formatUSD, parseUSD, dollarsToCents, centsToInput };
