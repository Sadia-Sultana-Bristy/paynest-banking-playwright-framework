/* PayNest Online Banking – single-page front end for the demo system under test. */
(() => {
  'use strict';

  const root = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const state = { user: null, challengeId: null, flash: null };

  // ---------- utilities ----------
  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (cents) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const signed = (t) => `${t.type === 'DEBIT' ? '-' : '+'}${money(t.amount)}`;

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong');
      Object.assign(err, { status: res.status, field: data.field });
      throw err;
    }
    return data;
  }

  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 4000);
  }

  function go(hash, flash) {
    if (flash) state.flash = flash;
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function takeFlash() {
    const f = state.flash;
    state.flash = null;
    return f
      ? `<div class="alert ${f.type}" role="${f.type === 'error' ? 'alert' : 'status'}" data-testid="flash">${esc(f.text)}</div>`
      : '';
  }

  function setFieldError(form, field, message) {
    const input = form.querySelector(`[name="${field}"]`);
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (slot) {
      slot.textContent = message || '';
      slot.hidden = !message;
    }
  }

  function clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach((s) => ((s.textContent = ''), (s.hidden = true)));
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.setAttribute('aria-invalid', 'false'));
    const summary = form.querySelector('[data-testid="form-error"]');
    if (summary) summary.hidden = true;
  }

  function formError(form, message) {
    const summary = form.querySelector('[data-testid="form-error"]');
    summary.textContent = message;
    summary.hidden = false;
  }

  /** Marks the current route as fully rendered (the test framework waits on this). */
  function ready() {
    root.setAttribute('data-route', location.hash || '#/login');
    root.setAttribute('aria-busy', 'false');
  }

  const errorSlot = (field) =>
    `<div class="field-error" id="${field}-error" data-error-for="${field}" data-testid="error-${field}" role="alert" hidden></div>`;

  // ---------- layout ----------
  function shell(active, content) {
    const links = [
      ['dashboard', 'Dashboard'],
      ['transfer', 'Transfer'],
      ['payees', 'Payees'],
      ['transactions', 'Transactions'],
      ...(state.user.role === 'admin' ? [['admin', 'Admin']] : []),
    ];
    root.innerHTML = `
      <header class="topbar">
        <span class="brand">PayNest</span>
        <nav aria-label="Main">
          ${links
            .map(([r, label]) => `<a href="#/${r}" ${r === active ? 'aria-current="page"' : ''}>${label}</a>`)
            .join('')}
        </nav>
        <div class="user-menu">
          <span data-testid="signed-in-user">${esc(state.user.firstName)} ${esc(state.user.lastName)}</span>
          <button class="secondary" id="sign-out">Sign out</button>
        </div>
      </header>
      <main id="main">${takeFlash()}${content}</main>`;
    document.getElementById('sign-out').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      state.user = null;
      go('#/login', { type: 'info', text: 'You have signed out.' });
    });
    ready();
  }

  // ---------- pages: auth ----------
  function loginPage() {
    root.innerHTML = `
      <main id="main" class="auth">
        <div class="card">
          <h1>Sign in to PayNest</h1>
          ${takeFlash()}
          <form id="login-form" novalidate>
            <div class="alert error" role="alert" data-testid="form-error" hidden></div>
            <label for="username">Username</label>
            <input id="username" name="username" autocomplete="username" />
            ${errorSlot('username')}
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" />
            ${errorSlot('password')}
            <div class="actions"><button type="submit">Sign in</button></div>
          </form>
        </div>
      </main>`;
    ready();
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const username = form.username.value.trim();
      const password = form.password.value;
      let ok = true;
      if (!username) (setFieldError(form, 'username', 'Enter your username'), (ok = false));
      if (!password) (setFieldError(form, 'password', 'Enter your password'), (ok = false));
      if (!ok) return;
      try {
        const { challengeId } = await api('/api/auth/login', { method: 'POST', body: { username, password } });
        state.challengeId = challengeId;
        go('#/mfa');
      } catch (err) {
        formError(form, err.message);
      }
    });
  }

  function mfaPage() {
    if (!state.challengeId) return go('#/login');
    root.innerHTML = `
      <main id="main" class="auth">
        <div class="card">
          <h1>Verify it's you</h1>
          <p class="muted">Enter the 6-digit code from your authenticator app.</p>
          <form id="mfa-form" novalidate>
            <div class="alert error" role="alert" data-testid="form-error" hidden></div>
            <label for="code">Verification code</label>
            <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" />
            ${errorSlot('code')}
            <div class="actions">
              <button type="submit">Verify</button>
              <a class="button secondary" href="#/login">Back to sign in</a>
            </div>
          </form>
        </div>
      </main>`;
    ready();
    const form = document.getElementById('mfa-form');
    form.code.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      try {
        const { user } = await api('/api/auth/mfa', {
          method: 'POST',
          body: { challengeId: state.challengeId, code: form.code.value.trim() },
        });
        state.user = user;
        state.challengeId = null;
        go(user.role === 'admin' ? '#/admin' : '#/dashboard');
      } catch (err) {
        if (err.field === 'code' && err.status === 422) setFieldError(form, 'code', err.message);
        else formError(form, err.message);
      }
    });
  }

  // ---------- pages: dashboard ----------
  async function dashboardPage() {
    const [accounts, limits, txns] = await Promise.all([
      api('/api/accounts'),
      api('/api/limits'),
      api('/api/transactions'),
    ]);
    const usedPct = Math.min(100, Math.round((limits.usedToday / limits.dailyLimit) * 100));
    shell(
      'dashboard',
      `<h1>Welcome back, ${esc(state.user.firstName)}</h1>
      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Your accounts</h2>
        <div class="grid">
          ${accounts
            .map(
              (a) => `<article class="card account-card" data-testid="account-card" data-account-id="${a.id}">
                <div data-testid="account-name"><strong>${esc(a.name)}</strong></div>
                <div class="muted" data-testid="account-number">${esc(a.maskedNumber)}</div>
                <div class="balance" data-testid="account-balance">${money(a.balance)}</div>
              </article>`,
            )
            .join('') || '<p>You have no open accounts.</p>'}
        </div>
      </section>
      <section class="card" aria-labelledby="limit-heading" data-testid="daily-limit">
        <h2 id="limit-heading">Daily transfer limit</h2>
        <div><span data-testid="limit-remaining">${money(limits.remaining)}</span> remaining of ${money(limits.dailyLimit)}</div>
        <div class="limit-bar" aria-hidden="true"><span style="width:${usedPct}%"></span></div>
      </section>
      <section class="card" aria-labelledby="recent-heading">
        <h2 id="recent-heading">Recent activity</h2>
        ${txnTable(txns.slice(0, 5), 'recent-transactions')}
        <div class="actions"><a class="button secondary" href="#/transactions">View all transactions</a></div>
      </section>`,
    );
  }

  function txnTable(rows, testId) {
    if (!rows.length) return `<p data-testid="${testId}-empty">No transactions match your filters</p>`;
    return `<table data-testid="${testId}">
      <thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Reference</th><th class="amount">Amount</th><th class="amount">Balance</th></tr></thead>
      <tbody>${rows
        .map(
          (t) => `<tr data-testid="transaction-row">
            <td>${esc(t.date)}</td><td>${esc(t.description)}</td><td>${esc(t.accountName)}</td>
            <td>${esc(t.reference || '—')}</td>
            <td class="amount ${t.type === 'CREDIT' ? 'credit' : ''}">${signed(t)}</td>
            <td class="amount">${money(t.balanceAfter)}</td></tr>`,
        )
        .join('')}</tbody></table>`;
  }

  // ---------- pages: transfer ----------
  async function transferPage() {
    const [accounts, payees] = await Promise.all([api('/api/accounts'), api('/api/payees')]);
    const accOption = (a) => `<option value="${a.id}">${esc(a.name)} (${esc(a.maskedNumber)}) – ${money(a.balance)}</option>`;
    let draft = null;

    const renderForm = () => {
      shell(
        'transfer',
        `<h1>Move money</h1>
        <div class="card">
          <form id="transfer-form" novalidate>
            <div class="alert error" role="alert" data-testid="form-error" hidden></div>
            <label for="fromAccountId">From account</label>
            <select id="fromAccountId" name="fromAccountId">${accounts.map(accOption).join('')}</select>
            ${errorSlot('fromAccountId')}
            <fieldset>
              <legend>Send to</legend>
              <label class="radio"><input type="radio" name="destination" value="own" checked /> One of my accounts</label>
              <label class="radio"><input type="radio" name="destination" value="payee" ${payees.length ? '' : 'disabled'} /> A saved payee</label>
            </fieldset>
            <div data-destination="own">
              <label for="toAccountId">To account</label>
              <select id="toAccountId" name="toAccountId">${accounts.map(accOption).join('')}</select>
              ${errorSlot('toAccountId')}
            </div>
            <div data-destination="payee" hidden>
              <label for="payeeId">Payee</label>
              <select id="payeeId" name="payeeId">${payees
                .map((p) => `<option value="${p.id}">${esc(p.nickname)} – ${esc(p.bankName)} ${esc(p.maskedAccount)}</option>`)
                .join('')}</select>
              ${errorSlot('payeeId')}
            </div>
            <label for="amount">Amount (USD)</label>
            <input id="amount" name="amount" inputmode="decimal" placeholder="0.00" aria-describedby="amount-error" />
            ${errorSlot('amount')}
            <label for="memo">Memo (optional)</label>
            <input id="memo" name="memo" maxlength="80" />
            ${errorSlot('memo')}
            <div class="actions"><button type="submit">Review transfer</button></div>
          </form>
        </div>`,
      );
      const form = document.getElementById('transfer-form');
      if (accounts[1]) form.toAccountId.value = accounts[1].id;
      if (draft) {
        form.fromAccountId.value = draft.fromAccountId;
        form.amount.value = draft.amountText;
        form.memo.value = draft.memo;
        if (draft.payeeId) {
          form.destination.value = 'payee';
          form.payeeId.value = draft.payeeId;
        } else form.toAccountId.value = draft.toAccountId;
      }
      const syncDestination = () => {
        const mode = form.querySelector('input[name="destination"]:checked').value;
        form.querySelectorAll('[data-destination]').forEach((el) => (el.hidden = el.dataset.destination !== mode));
      };
      form.querySelectorAll('input[name="destination"]').forEach((r) => r.addEventListener('change', syncDestination));
      syncDestination();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(form);
        const amountText = form.amount.value.trim().replace(/[$,]/g, '');
        let amountError = null;
        if (!amountText) amountError = 'Enter an amount';
        else if (!/^-?\d+(\.\d+)?$/.test(amountText)) amountError = 'Enter a valid amount, for example 125.50';
        else if (/\.\d{3,}$/.test(amountText)) amountError = 'Amount can have at most 2 decimal places';
        else if (Number(amountText) <= 0) amountError = 'Enter an amount greater than $0.00';
        if (amountError) return setFieldError(form, 'amount', amountError);

        const toPayee = form.querySelector('input[name="destination"]:checked').value === 'payee';
        const body = {
          fromAccountId: form.fromAccountId.value,
          toAccountId: toPayee ? undefined : form.toAccountId.value,
          payeeId: toPayee ? form.payeeId.value : undefined,
          amount: Math.round(Number(amountText) * 100),
          memo: form.memo.value.trim(),
        };
        try {
          await api('/api/transfers', { method: 'POST', body: { ...body, dryRun: true } });
          draft = { ...body, amountText: form.amount.value.trim() };
          renderReview();
        } catch (err) {
          if (err.field && form.querySelector(`[data-error-for="${err.field}"]`)) setFieldError(form, err.field, err.message);
          else formError(form, err.message);
        }
      });
    };

    const describeTo = () => {
      if (draft.payeeId) {
        const p = payees.find((x) => x.id === draft.payeeId);
        return `${p.nickname} – ${p.bankName} ${p.maskedAccount}`;
      }
      const a = accounts.find((x) => x.id === draft.toAccountId);
      return `${a.name} (${a.maskedNumber})`;
    };

    const renderReview = () => {
      const from = accounts.find((x) => x.id === draft.fromAccountId);
      shell(
        'transfer',
        `<h1>Move money</h1>
        <section class="card" aria-labelledby="review-heading" data-testid="transfer-review">
          <h2 id="review-heading">Review your transfer</h2>
          ${draft.amount >= 100000 ? '<div class="alert warning" role="note" data-testid="large-transfer-warning">Large transfer: please double-check the recipient before you confirm.</div>' : ''}
          <dl class="summary">
            <dt>From</dt><dd data-testid="review-from">${esc(from.name)} (${esc(from.maskedNumber)})</dd>
            <dt>To</dt><dd data-testid="review-to">${esc(describeTo())}</dd>
            <dt>Amount</dt><dd data-testid="review-amount">${money(draft.amount)}</dd>
            <dt>Memo</dt><dd data-testid="review-memo">${esc(draft.memo || '—')}</dd>
          </dl>
          <div class="alert error" role="alert" data-testid="form-error" hidden></div>
          <div class="actions">
            <button id="confirm-transfer">Confirm transfer</button>
            <button class="secondary" id="edit-transfer">Edit</button>
          </div>
        </section>`,
      );
      document.getElementById('edit-transfer').addEventListener('click', renderForm);
      document.getElementById('confirm-transfer').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try {
          const result = await api('/api/transfers', { method: 'POST', body: draft });
          renderDone(result);
        } catch (err) {
          const box = document.querySelector('[data-testid="form-error"]');
          box.textContent = err.message;
          box.hidden = false;
          e.target.disabled = false;
        }
      });
    };

    const renderDone = (result) => {
      shell(
        'transfer',
        `<h1>Move money</h1>
        <section class="card" aria-labelledby="done-heading" data-testid="transfer-success">
          <h2 id="done-heading">Transfer complete</h2>
          <p>${money(result.amount)} was sent to ${esc(describeTo())}.</p>
          <p>Reference: <strong data-testid="transfer-reference">${esc(result.reference)}</strong></p>
          <div class="actions">
            <button id="another-transfer">Make another transfer</button>
            <a class="button secondary" href="#/transactions">View transactions</a>
          </div>
        </section>`,
      );
      document.getElementById('another-transfer').addEventListener('click', () => render());
    };

    renderForm();
  }

  // ---------- pages: payees ----------
  async function payeesPage() {
    const [payees, banks] = await Promise.all([api('/api/payees'), api('/api/banks')]);
    shell(
      'payees',
      `<h1>Payees</h1>
      <section class="card" aria-labelledby="saved-heading">
        <h2 id="saved-heading">Saved payees</h2>
        ${
          payees.length
            ? `<table data-testid="payees-table"><thead><tr><th>Nickname</th><th>Bank</th><th>Account</th><th><span class="muted">Actions</span></th></tr></thead>
              <tbody>${payees
                .map(
                  (p) => `<tr data-testid="payee-row"><td>${esc(p.nickname)}</td><td>${esc(p.bankName)}</td><td>${esc(p.maskedAccount)}</td>
                  <td><button class="link" data-remove="${p.id}" data-name="${esc(p.nickname)}" aria-label="Remove ${esc(p.nickname)}">Remove</button></td></tr>`,
                )
                .join('')}</tbody></table>`
            : `<p data-testid="payees-empty">You haven't added any payees yet.</p>`
        }
      </section>
      <section class="card" aria-labelledby="add-heading">
        <h2 id="add-heading">Add a payee</h2>
        <form id="payee-form" novalidate>
          <div class="alert error" role="alert" data-testid="form-error" hidden></div>
          <label for="nickname">Nickname</label>
          <input id="nickname" name="nickname" />
          ${errorSlot('nickname')}
          <label for="accountNumber">Account number</label>
          <input id="accountNumber" name="accountNumber" inputmode="numeric" />
          ${errorSlot('accountNumber')}
          <label for="bankCode">Bank</label>
          <select id="bankCode" name="bankCode"><option value="">Select a bank</option>${banks
            .map((b) => `<option value="${b.code}">${esc(b.name)}</option>`)
            .join('')}</select>
          ${errorSlot('bankCode')}
          <div class="actions"><button type="submit">Save payee</button></div>
        </form>
      </section>`,
    );
    const form = document.getElementById('payee-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const body = {
        nickname: form.nickname.value,
        accountNumber: form.accountNumber.value,
        bankCode: form.bankCode.value,
      };
      try {
        const payee = await api('/api/payees', { method: 'POST', body });
        toast(`Payee ${payee.nickname} added`);
        render();
      } catch (err) {
        if (err.field && form.querySelector(`[data-error-for="${err.field}"]`)) setFieldError(form, err.field, err.message);
        else formError(form, err.message);
      }
    });
    root.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => confirmRemove(btn.dataset.remove, btn.dataset.name)),
    );
  }

  function confirmRemove(id, name) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">Remove payee?</h2>
        <p>${esc(name)} will be removed from your saved payees.</p>
        <div class="actions">
          <button class="danger" data-action="confirm">Remove</button>
          <button class="secondary" data-action="cancel">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-action="cancel"]').focus();
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('[data-action="confirm"]').addEventListener('click', async () => {
      await api(`/api/payees/${id}`, { method: 'DELETE' });
      backdrop.remove();
      toast('Payee removed');
      render();
    });
  }

  // ---------- pages: transactions ----------
  async function transactionsPage() {
    const accounts = await api('/api/accounts');
    shell(
      'transactions',
      `<h1>Transactions</h1>
      <section class="card">
        <form class="filters" id="filters" role="search" aria-label="Filter transactions">
          <div><label for="filter-account">Account</label>
            <select id="filter-account" name="accountId"><option value="">All accounts</option>${accounts
              .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
              .join('')}</select></div>
          <div><label for="filter-type">Type</label>
            <select id="filter-type" name="type"><option value="ALL">All types</option><option value="CREDIT">Money in</option><option value="DEBIT">Money out</option></select></div>
          <div><label for="filter-q">Search</label>
            <input id="filter-q" name="q" type="search" placeholder="Description or reference" /></div>
          <div><a class="button secondary" id="export" href="/api/transactions/export" download>Export CSV</a></div>
        </form>
      </section>
      <section class="card" aria-live="polite">
        <p class="muted" data-testid="results-count"></p>
        <div id="results"></div>
      </section>`,
    );
    const form = document.getElementById('filters');
    let timer;
    const load = async () => {
      const params = new URLSearchParams(new FormData(form));
      document.getElementById('export').href = `/api/transactions/export?${params}`;
      const rows = await api(`/api/transactions?${params}`);
      document.querySelector('[data-testid="results-count"]').textContent =
        `${rows.length} transaction${rows.length === 1 ? '' : 's'}`;
      document.getElementById('results').innerHTML = txnTable(rows, 'transactions-table');
    };
    form.addEventListener('change', load);
    form.q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    await load();
  }

  // ---------- pages: admin ----------
  async function adminPage() {
    if (state.user.role !== 'admin') return forbiddenPage();
    const customers = await api('/api/admin/customers');
    shell(
      'admin',
      `<h1>Customer administration</h1>
      <section class="card">
        <label for="customer-search">Search customers</label>
        <input id="customer-search" type="search" placeholder="Name or username" />
      </section>
      <section class="card">
        <table data-testid="customers-table">
          <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Accounts</th><th><span class="muted">Action</span></th></tr></thead>
          <tbody>${customers
            .map(
              (c) => `<tr data-testid="customer-row" data-username="${esc(c.username)}">
                <td>${esc(c.firstName)} ${esc(c.lastName)}</td><td>${esc(c.username)}</td>
                <td><span class="badge ${c.status}" data-testid="customer-status">${c.status === 'LOCKED' ? 'Locked' : 'Active'}</span></td>
                <td>${c.accounts}</td>
                <td><button class="${c.status === 'LOCKED' ? '' : 'danger'}" data-id="${c.id}" data-action="${c.status === 'LOCKED' ? 'unlock' : 'lock'}"
                  aria-label="${c.status === 'LOCKED' ? 'Unlock' : 'Lock'} ${esc(c.username)}">${c.status === 'LOCKED' ? 'Unlock' : 'Lock'}</button></td></tr>`,
            )
            .join('')}</tbody>
        </table>
      </section>`,
    );
    document.getElementById('customer-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      root.querySelectorAll('[data-testid="customer-row"]').forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(q);
      });
    });
    root.querySelectorAll('button[data-action]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const updated = await api(`/api/admin/customers/${btn.dataset.id}/${btn.dataset.action}`, { method: 'POST' });
        toast(`${updated.username} ${btn.dataset.action === 'lock' ? 'locked' : 'unlocked'}`);
        render();
      }),
    );
  }

  function forbiddenPage() {
    shell(
      '',
      `<h1>Access denied</h1><div class="card"><p>You do not have access to this page.</p>
       <a class="button secondary" href="#/dashboard">Back to dashboard</a></div>`,
    );
  }

  // ---------- router ----------
  const protectedRoutes = {
    '#/dashboard': dashboardPage,
    '#/transfer': transferPage,
    '#/payees': payeesPage,
    '#/transactions': transactionsPage,
    '#/admin': adminPage,
  };

  async function render() {
    root.setAttribute('aria-busy', 'true');
    root.removeAttribute('data-route');
    const hash = location.hash || '#/login';
    try {
      if (hash === '#/login') return loginPage();
      if (hash === '#/mfa') return mfaPage();
      const page = protectedRoutes[hash];
      if (!page) return go('#/dashboard');
      if (!state.user) {
        try {
          state.user = await api('/api/me');
        } catch {
          return go('#/login', { type: 'error', text: 'Please sign in to continue' });
        }
      }
      await page();
    } catch (err) {
      if (err.status === 401 || err.status === 423) {
        state.user = null;
        return go('#/login', { type: 'error', text: 'Please sign in to continue' });
      }
      root.innerHTML = `<main id="main"><div class="alert error" role="alert">${esc(err.message)}</div></main>`;
      ready();
    }
  }

  window.addEventListener('hashchange', render);
  render();
})();
