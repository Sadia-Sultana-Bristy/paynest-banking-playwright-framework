'use strict';

/**
 * PayNest Online Banking — demo system under test.
 *
 * A dependency-free Node.js server that exposes a small REST API and serves a
 * single-page app. It exists so the automation framework has a realistic,
 * deterministic banking application to test. It is NOT production code.
 *
 *   node app/server.js            -> http://localhost:3000
 *   PORT=4000 node app/server.js  -> custom port
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Store, ValidationError, BANKS, daysAgo } = require('./lib/store');
const totp = require('./lib/totp');
const seed = require('./seed');

const PORT = Number(process.env.PORT || 3000);
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-key';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const store = new Store();
seed(store);

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  const isString = typeof body === 'string';
  res.writeHead(status, {
    'Content-Type': isString ? 'text/plain; charset=utf-8' : 'application/json',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isString ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new ValidationError('Request body must be valid JSON', 'body', 400));
      }
    });
  });
}

function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k),
  );
}

function currentUser(req) {
  return store.userForSession(cookies(req).pn_session);
}

function requireUser(req, role) {
  const user = currentUser(req);
  if (!user) throw new ValidationError('Please sign in to continue', 'session', 401);
  if (user.status === 'LOCKED') throw new ValidationError('Your account is locked', 'session', 423);
  if (role && user.role !== role) throw new ValidationError('You do not have access to this page', 'role', 403);
  return user;
}

function requireTestKey(req) {
  if (req.headers['x-test-support-key'] !== TEST_SUPPORT_KEY) {
    throw new ValidationError('Test support key missing or invalid', 'x-test-support-key', 403);
  }
}

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, html) =>
        e ? send(res, 404, 'Not found') : send(res, 200, html.toString(), { 'Content-Type': 'text/html' }),
      );
    }
    send(res, 200, data.toString(), { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  });
}

function toCsv(rows) {
  const header = ['Date', 'Account', 'Description', 'Reference', 'Type', 'Amount', 'Balance'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((t) =>
    [t.date, t.accountName, t.description, t.reference, t.type, ((t.type === 'DEBIT' ? -1 : 1) * t.amount / 100).toFixed(2), (t.balanceAfter / 100).toFixed(2)]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

// ---------- routes ----------
const routes = [
  ['GET', /^\/api\/health$/, () => ({ status: 'UP', service: 'paynest-api', time: new Date().toISOString() })],
  ['GET', /^\/api\/banks$/, () => Object.entries(BANKS).map(([code, name]) => ({ code, name }))],

  // auth
  ['POST', /^\/api\/auth\/login$/, async (req) => {
    const { username, password } = await readBody(req);
    return store.login(String(username || '').trim(), String(password || ''));
  }],
  ['POST', /^\/api\/auth\/mfa$/, async (req, res) => {
    const { challengeId, code } = await readBody(req);
    const { sessionId, user } = store.verifyMfa(challengeId, code, totp.verify);
    res.setHeader('Set-Cookie', `pn_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
    return { user: store.publicUser(user) };
  }],
  ['POST', /^\/api\/auth\/logout$/, (req, res) => {
    store.sessions.delete(cookies(req).pn_session);
    res.setHeader('Set-Cookie', 'pn_session=; Path=/; HttpOnly; Max-Age=0');
    return { signedOut: true };
  }],
  ['GET', /^\/api\/me$/, (req) => store.publicUser(requireUser(req))],

  // banking
  ['GET', /^\/api\/accounts$/, (req) => store.accountsFor(requireUser(req).id)],
  ['GET', /^\/api\/limits$/, (req) => store.limits(requireUser(req).id)],
  ['GET', /^\/api\/transactions$/, (req, res, m, query) =>
    store.transactionsFor(requireUser(req).id, Object.fromEntries(query))],
  ['GET', /^\/api\/transactions\/export$/, (req, res, m, query) => {
    const user = requireUser(req);
    const csv = toCsv(store.transactionsFor(user.id, Object.fromEntries(query)));
    send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="paynest-statement-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
  }],
  ['GET', /^\/api\/payees$/, (req) => store.payeesFor(requireUser(req).id)],
  ['POST', /^\/api\/payees$/, async (req, res) => {
    const user = requireUser(req);
    res.statusCode = 201;
    return store.addPayee(user.id, await readBody(req));
  }],
  ['DELETE', /^\/api\/payees\/([\w-]+)$/, (req, res, m) => {
    store.removePayee(requireUser(req).id, m[1]);
    return { deleted: true };
  }],
  ['POST', /^\/api\/transfers$/, async (req, res) => {
    const user = requireUser(req);
    const result = store.transfer(user.id, await readBody(req));
    if (!result.valid) res.statusCode = 201;
    return result;
  }],

  // admin
  ['GET', /^\/api\/admin\/customers$/, (req) => {
    requireUser(req, 'admin');
    return store.customers();
  }],
  ['POST', /^\/api\/admin\/customers\/([\w-]+)\/(lock|unlock)$/, (req, res, m) => {
    requireUser(req, 'admin');
    return store.setStatus(m[1], m[2] === 'lock' ? 'LOCKED' : 'ACTIVE');
  }],

  // test support (only for automation: creates isolated data per test)
  ['POST', /^\/api\/test-support\/customers$/, async (req, res) => {
    requireTestKey(req);
    const body = await readBody(req);
    const user = store.createUser({
      username: body.username,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role || 'customer',
      accounts: body.accounts || [],
      payees: body.payees || [],
    });
    (body.history || []).forEach((h) => {
      const account = store.accountsFor(user.id)[h.accountIndex || 0];
      store.record(user.id, account.id, { ...h, date: h.daysAgo != null ? daysAgo(h.daysAgo) : undefined });
    });
    res.statusCode = 201;
    return {
      ...store.publicUser(user),
      password: user.password,
      mfaSecret: user.mfaSecret,
      accounts: store.accountsFor(user.id),
      payees: store.payeesFor(user.id),
    };
  }],
  ['DELETE', /^\/api\/test-support\/customers\/([\w-]+)$/, (req, res, m) => {
    requireTestKey(req);
    return { deleted: store.deleteUser(m[1]) };
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  const route = routes.find(([method, pattern]) => method === req.method && pattern.test(url.pathname));
  if (!route) return send(res, 404, { error: 'Not found' });
  try {
    const result = await route[2](req, res, url.pathname.match(route[1]), url.searchParams);
    if (!res.writableEnded) send(res, res.statusCode || 200, result);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    send(res, status, { error: err.message || 'Unexpected error', field: err.field });
  }
});

server.listen(PORT, () => {
  console.log(`PayNest demo bank running at http://localhost:${PORT}`);
});

module.exports = server;
