'use strict';

/**
 * In-memory data store and business rules for the PayNest demo bank.
 * All money is held in integer cents to avoid floating point errors.
 */
const crypto = require('crypto');

const DAILY_TRANSFER_LIMIT_CENTS = 500000; // $5,000.00
const MAX_FAILED_LOGINS = 3;
const BANKS = {
  PNB01: 'PayNest Bank',
  CTU02: 'City Union Bank',
  HBS03: 'Harbour Savings',
};

class ValidationError extends Error {
  constructor(message, field, status = 422) {
    super(message);
    this.field = field;
    this.status = status;
  }
}

const id = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const formatUSD = (cents) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

class Store {
  constructor() {
    this.users = new Map();
    this.accounts = new Map();
    this.payees = new Map();
    this.transactions = [];
    this.sessions = new Map();
    this.challenges = new Map();
    this.accountSeq = 40000000;
    this.refSeq = 100000;
  }

  // ---------- users ----------
  createUser({ username, password, firstName, lastName, role = 'customer', mfaSecret, accounts = [], payees = [] }) {
    if ([...this.users.values()].some((u) => u.username === username)) {
      throw new ValidationError('Username already exists', 'username', 409);
    }
    const user = {
      id: id('usr'),
      username,
      password,
      firstName,
      lastName,
      role,
      mfaSecret: mfaSecret || crypto.randomBytes(10).toString('hex'),
      status: 'ACTIVE',
      failedLogins: 0,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    accounts.forEach((acc) => this.openAccount(user.id, acc));
    payees.forEach((p) => this.addPayee(user.id, p));
    return user;
  }

  deleteUser(userId) {
    for (const [accId, acc] of this.accounts) if (acc.userId === userId) this.accounts.delete(accId);
    for (const [pId, p] of this.payees) if (p.userId === userId) this.payees.delete(pId);
    this.transactions = this.transactions.filter((t) => t.userId !== userId);
    for (const [sid, s] of this.sessions) if (s.userId === userId) this.sessions.delete(sid);
    return this.users.delete(userId);
  }

  publicUser(user) {
    const { password, mfaSecret, ...rest } = user;
    return rest;
  }

  // ---------- auth ----------
  login(username, password) {
    const user = [...this.users.values()].find((u) => u.username === username);
    if (user && user.status === 'LOCKED') {
      throw new ValidationError(
        `Your account is locked after ${MAX_FAILED_LOGINS} failed sign-in attempts. Contact support to unlock it.`,
        'username',
        423,
      );
    }
    if (!user || user.password !== password) {
      if (user) {
        user.failedLogins += 1;
        if (user.failedLogins >= MAX_FAILED_LOGINS) {
          user.status = 'LOCKED';
          throw new ValidationError(
            `Your account is locked after ${MAX_FAILED_LOGINS} failed sign-in attempts. Contact support to unlock it.`,
            'username',
            423,
          );
        }
      }
      throw new ValidationError('Invalid username or password', 'password', 401);
    }
    const challengeId = id('mfa');
    this.challenges.set(challengeId, { userId: user.id, createdAt: Date.now() });
    return { challengeId };
  }

  verifyMfa(challengeId, code, verifyFn) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || Date.now() - challenge.createdAt > 5 * 60000) {
      throw new ValidationError('Your verification session expired. Sign in again.', 'code', 401);
    }
    const user = this.users.get(challenge.userId);
    if (!/^\d{6}$/.test(String(code || ''))) {
      throw new ValidationError('Enter the 6-digit code from your authenticator app', 'code', 422);
    }
    if (!verifyFn(user.mfaSecret, code)) {
      throw new ValidationError('That code is incorrect or has expired', 'code', 401);
    }
    this.challenges.delete(challengeId);
    user.failedLogins = 0;
    const sessionId = crypto.randomBytes(18).toString('hex');
    this.sessions.set(sessionId, { userId: user.id, createdAt: Date.now() });
    return { sessionId, user };
  }

  userForSession(sessionId) {
    const session = sessionId && this.sessions.get(sessionId);
    return session ? this.users.get(session.userId) : null;
  }

  // ---------- accounts ----------
  openAccount(userId, { type = 'CHECKING', name, balance = 0 }) {
    this.accountSeq += 1;
    const account = {
      id: id('acc'),
      userId,
      type,
      name: name || (type === 'SAVINGS' ? 'High-Yield Savings' : 'Everyday Checking'),
      number: String(this.accountSeq) + String(Math.floor(Math.random() * 9000) + 1000),
      balance: Math.round(balance),
    };
    this.accounts.set(account.id, account);
    if (account.balance > 0) {
      this.record(userId, account.id, {
        type: 'CREDIT',
        amount: account.balance,
        description: 'Opening deposit',
        date: daysAgo(30),
      });
    }
    return account;
  }

  accountsFor(userId) {
    return [...this.accounts.values()]
      .filter((a) => a.userId === userId)
      .map((a) => ({ ...a, maskedNumber: `•••• ${a.number.slice(-4)}` }));
  }

  // ---------- payees ----------
  addPayee(userId, { nickname, accountNumber, bankCode }) {
    nickname = String(nickname || '').trim();
    accountNumber = String(accountNumber || '').trim();
    if (!nickname) throw new ValidationError('Enter a nickname for this payee', 'nickname');
    if (nickname.length > 40) throw new ValidationError('Nickname must be 40 characters or fewer', 'nickname');
    if (!/^\d{8,12}$/.test(accountNumber)) {
      throw new ValidationError('Account number must be 8 to 12 digits', 'accountNumber');
    }
    if (!BANKS[bankCode]) throw new ValidationError('Choose the payee’s bank', 'bankCode');
    const duplicate = [...this.payees.values()].some(
      (p) => p.userId === userId && p.accountNumber === accountNumber && p.bankCode === bankCode,
    );
    if (duplicate) throw new ValidationError('This payee already exists', 'accountNumber', 409);
    const payee = { id: id('pay'), userId, nickname, accountNumber, bankCode, bankName: BANKS[bankCode] };
    this.payees.set(payee.id, payee);
    return payee;
  }

  payeesFor(userId) {
    return [...this.payees.values()]
      .filter((p) => p.userId === userId)
      .map((p) => ({ ...p, maskedAccount: `•••• ${p.accountNumber.slice(-4)}` }));
  }

  removePayee(userId, payeeId) {
    const payee = this.payees.get(payeeId);
    if (!payee || payee.userId !== userId) throw new ValidationError('Payee not found', 'payeeId', 404);
    this.payees.delete(payeeId);
  }

  // ---------- transfers ----------
  usedToday(userId) {
    return this.transactions
      .filter((t) => t.userId === userId && t.kind === 'TRANSFER_OUT' && t.date === today())
      .reduce((sum, t) => sum + t.amount, 0);
  }

  limits(userId) {
    const used = this.usedToday(userId);
    return { dailyLimit: DAILY_TRANSFER_LIMIT_CENTS, usedToday: used, remaining: DAILY_TRANSFER_LIMIT_CENTS - used };
  }

  transfer(userId, { fromAccountId, toAccountId, payeeId, amount, memo = '', dryRun = false }) {
    const from = this.accounts.get(fromAccountId);
    if (!from || from.userId !== userId) throw new ValidationError('Choose an account to transfer from', 'fromAccountId');

    let to = null;
    let payee = null;
    if (payeeId) {
      payee = this.payees.get(payeeId);
      if (!payee || payee.userId !== userId) throw new ValidationError('Choose a payee', 'payeeId');
    } else {
      to = this.accounts.get(toAccountId);
      if (!to || to.userId !== userId) throw new ValidationError('Choose an account to transfer to', 'toAccountId');
      if (to.id === from.id) throw new ValidationError('Choose a different account to transfer to', 'toAccountId');
    }

    const cents = Number(amount);
    if (!Number.isInteger(cents) || cents <= 0) {
      throw new ValidationError('Enter an amount greater than $0.00', 'amount');
    }
    if (String(memo).length > 60) throw new ValidationError('Memo must be 60 characters or fewer', 'memo');
    if (cents > from.balance) {
      throw new ValidationError(`Insufficient funds in ${from.name}. Available: ${formatUSD(from.balance)}`, 'amount');
    }
    const { remaining } = this.limits(userId);
    if (cents > remaining) {
      throw new ValidationError(
        `This transfer exceeds your daily limit. Remaining today: ${formatUSD(remaining)}`,
        'amount',
      );
    }
    if (dryRun) return { valid: true };

    this.refSeq += 1;
    const reference = `TRF-${this.refSeq}`;
    const toLabel = payee ? `${payee.nickname} (${payee.bankName})` : to.name;
    from.balance -= cents;
    this.record(userId, from.id, {
      type: 'DEBIT',
      kind: 'TRANSFER_OUT',
      amount: cents,
      description: memo ? `Transfer to ${toLabel} – ${memo}` : `Transfer to ${toLabel}`,
      reference,
    });
    if (to) {
      to.balance += cents;
      this.record(userId, to.id, {
        type: 'CREDIT',
        kind: 'TRANSFER_IN',
        amount: cents,
        description: memo ? `Transfer from ${from.name} – ${memo}` : `Transfer from ${from.name}`,
        reference,
      });
    }
    return { reference, amount: cents, fromAccountId: from.id, toAccountId: to?.id, payeeId: payee?.id, status: 'COMPLETED' };
  }

  // ---------- transactions ----------
  record(userId, accountId, { type, kind = type, amount, description, reference = null, date = today() }) {
    const account = this.accounts.get(accountId);
    this.transactions.unshift({
      id: id('txn'),
      userId,
      accountId,
      accountName: account.name,
      type,
      kind,
      amount,
      description,
      reference,
      date,
      balanceAfter: account.balance,
      seq: this.transactions.length,
    });
  }

  transactionsFor(userId, { accountId, type, q } = {}) {
    const query = String(q || '').toLowerCase();
    return this.transactions
      .filter((t) => t.userId === userId)
      .filter((t) => !accountId || t.accountId === accountId)
      .filter((t) => !type || type === 'ALL' || t.type === type)
      .filter((t) => !query || t.description.toLowerCase().includes(query) || (t.reference || '').toLowerCase().includes(query))
      .sort((a, b) => (a.date === b.date ? b.seq - a.seq : b.date.localeCompare(a.date)));
  }

  // ---------- admin ----------
  customers() {
    return [...this.users.values()]
      .filter((u) => u.role === 'customer')
      .map((u) => ({ ...this.publicUser(u), accounts: this.accountsFor(u.id).length }));
  }

  setStatus(userId, status) {
    const user = this.users.get(userId);
    if (!user || user.role !== 'customer') throw new ValidationError('Customer not found', 'id', 404);
    user.status = status;
    if (status === 'ACTIVE') user.failedLogins = 0;
    if (status === 'LOCKED') for (const [sid, s] of this.sessions) if (s.userId === userId) this.sessions.delete(sid);
    return this.publicUser(user);
  }
}

module.exports = { Store, ValidationError, BANKS, DAILY_TRANSFER_LIMIT_CENTS, daysAgo };
