'use strict';

/**
 * Minimal RFC 6238 TOTP implementation (HMAC-SHA1, 6 digits, 30s step).
 * Used by the demo app to verify MFA codes. The test framework has its own
 * copy in src/utils/totp.js so the tests never import application code.
 */
const crypto = require('crypto');

const STEP_SECONDS = 30;
const DIGITS = 6;

function hotp(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'utf8')).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

function generate(secret, timestamp = Date.now()) {
  return hotp(secret, Math.floor(timestamp / 1000 / STEP_SECONDS));
}

/** Accepts the current code and one step either side to tolerate clock drift. */
function verify(secret, code, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  return [-1, 0, 1].some((drift) => hotp(secret, counter + drift) === String(code));
}

module.exports = { generate, verify };
