'use strict';

/**
 * Test data builders. Every value is unique per call so tests running in
 * parallel workers (and on parallel CI shards) never collide.
 *
 * Builders return plain objects and accept overrides, e.g.
 *   buildCustomer({ accounts: [{ type: 'CHECKING', balance: 10_00 }] })
 */
const crypto = require('crypto');

const FIRST_NAMES = ['Ava', 'Noah', 'Maya', 'Liam', 'Zara', 'Ethan', 'Nadia', 'Omar', 'Lena', 'Rafi'];
const LAST_NAMES = ['Rahman', 'Chen', 'Silva', 'Novak', 'Haddad', 'Okafor', 'Larsen', 'Iyer', 'Moreau', 'Kim'];

const pick = (list) => list[crypto.randomInt(list.length)];
const uid = () => `${process.env.TEST_WORKER_INDEX ?? 0}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const digits = (n) => Array.from({ length: n }, () => crypto.randomInt(10)).join('');

/** Default product setup: a funded checking account and a savings account. */
const DEFAULT_ACCOUNTS = [
  { type: 'CHECKING', name: 'Everyday Checking', balance: 250_000 }, // $2,500.00
  { type: 'SAVINGS', name: 'High-Yield Savings', balance: 1_000_000 }, // $10,000.00
];

function buildCustomer(overrides = {}) {
  const firstName = overrides.firstName || pick(FIRST_NAMES);
  const lastName = overrides.lastName || pick(LAST_NAMES);
  return {
    username: `qa.${firstName.toLowerCase()}.${uid()}`,
    password: `Pw#${crypto.randomBytes(4).toString('hex')}A1`,
    firstName,
    lastName,
    role: 'customer',
    accounts: DEFAULT_ACCOUNTS,
    payees: [],
    history: [],
    ...overrides,
  };
}

function buildPayee(overrides = {}) {
  return {
    nickname: `${pick(['Rent', 'Gym', 'Utilities', 'Tuition', 'Daycare'])} ${uid().slice(-5)}`,
    accountNumber: digits(10),
    bankCode: pick(['PNB01', 'CTU02', 'HBS03']),
    ...overrides,
  };
}

function uniqueMemo(prefix = 'QA') {
  return `${prefix}-${uid().slice(-8)}`;
}

module.exports = { buildCustomer, buildPayee, uniqueMemo, DEFAULT_ACCOUNTS };
