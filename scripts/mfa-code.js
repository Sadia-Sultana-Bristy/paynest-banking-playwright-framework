'use strict';

/**
 * Prints the current MFA code for a secret, for manual testing of the demo app.
 *   npm run mfa -- paynest-demo-secret
 */
const { generateTotp } = require('../src/utils/totp');

const secret = process.argv[2];
if (!secret) {
  console.error('Usage: npm run mfa -- <mfaSecret>   (seeded users: paynest-demo-secret, paynest-admin-secret)');
  process.exit(1);
}
const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
console.log(`${generateTotp(secret)}  (valid for ~${secondsLeft}s)`);
