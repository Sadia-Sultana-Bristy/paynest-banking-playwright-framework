'use strict';

/**
 * RFC 6238 time-based one-time password generator (HMAC-SHA1, 6 digits, 30s).
 * Lets tests pass multi-factor authentication the same way a real
 * authenticator app would, without disabling MFA in the test environment.
 */
const crypto = require('crypto');

const STEP_SECONDS = 30;

function generateTotp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'utf8')).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, '0');
}

/** A syntactically valid code that is guaranteed not to match the current window. */
function invalidTotp(secret) {
  const valid = new Set([-30_000, 0, 30_000].map((drift) => generateTotp(secret, Date.now() + drift)));
  let candidate = 0;
  while (valid.has(String(candidate).padStart(6, '0'))) candidate += 1;
  return String(candidate).padStart(6, '0');
}

module.exports = { generateTotp, invalidTotp };
