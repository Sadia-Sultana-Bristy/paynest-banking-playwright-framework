'use strict';

const js = require('@eslint/js');
const playwright = require('eslint-plugin-playwright');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'reports/', 'test-results/', 'blob-report/', 'playwright-report/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Playwright fixtures are requested by destructuring even when only their side effect is needed.
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
      'no-console': 'warn',
    },
  },
  {
    // the demo app and CLI scripts log to the console on purpose
    files: ['app/**/*.js', 'scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['app/public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['tests/**/*.js'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-focused-test': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      // Assertions often live in page-object helpers and test.step blocks.
      'playwright/expect-expect': 'off',
      // Data-driven tests are generated in loops on purpose.
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
    },
  },
];
