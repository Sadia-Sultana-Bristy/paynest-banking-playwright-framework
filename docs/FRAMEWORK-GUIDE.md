# Framework guide

How to extend the framework, and the conventions that keep it maintainable.

## Conventions

| Topic | Rule |
|---|---|
| Imports in specs | Only from `src/fixtures/*.fixtures.js` (plus utils and data). Never `@playwright/test` directly, so custom matchers and fixtures are always available |
| Locators | `getByRole` / `getByLabel` first, `getByTestId` for data regions. No XPath, no styling classes |
| Waiting | Web-first assertions and `waitForReady()`. `waitForTimeout` and `force: true` are lint errors |
| Data | Create it in the test through fixtures; never rely on seeded users or on another test |
| Money | Integer cents in code (`25_00` is $25.00); `formatUSD`/`parseUSD` at the UI boundary |
| Assertions | In specs, not page objects. Page objects expose locators and actions |
| Naming | Spec titles describe behaviour: `a transfer above the remaining daily limit is blocked` |
| Tags | Every `describe` has a suite tag; add feature and risk tags to tests |
| Steps | Use `test.step()` for multi-stage journeys so the report reads as a story |

## Add a page object

```js
// src/pages/statements-page.js
const { BasePage } = require('./base-page');

class StatementsPage extends BasePage {
  constructor(page) {
    super(page);
    this.path = '/#/statements';
    this.title = this.heading('Statements');
    this.downloadButton = page.getByRole('button', { name: 'Download PDF' });
  }
}
module.exports = { StatementsPage };
```

Register it in `src/fixtures/ui.fixtures.js`:

```js
statementsPage: async ({ page }, use) => use(new StatementsPage(page)),
```

## Add a fixture

* **Value or object for a test:** add `name: async ({ deps }, use) => { setup; await use(value); teardown; }`.
* **Configurable per file:** add an option fixture, `name: [defaultValue, { option: true }]`, and override it with `test.use({ name: ... })`.
* **Runs for every test** (a hook): add `{ auto: true }`.
* **Needs no browser:** put it in `api.fixtures.js` so API tests can use it.

## Add data-driven cases

1. Add a row to the JSON file in `tests/data/` (or create a new file).
2. Loop over it in the spec:

```js
const cases = require('../data/transfer-validation.json');
for (const data of cases) {
  test(`validation: ${data.case}`, async ({ transferPage }) => { /* ... */ });
}
```

Each row becomes its own test with its own name, result and retry.

## Add a custom matcher

Add it to `src/support/custom-matchers.js` inside `expect.extend({...})`. Return `{ pass, message, name }`; for async UI matchers, delegate to a web-first assertion so retries and timeouts still apply.

## Pull request checklist

- [ ] Tests pass locally on Chromium: `npm run test:chromium`
- [ ] New or changed tests pass `--repeat-each=5 --retries=0`
- [ ] `npm run lint` is clean
- [ ] Every new test has suite and feature tags
- [ ] No hard waits, no `test.only`, no shared data
- [ ] Page objects contain no business assertions
- [ ] Docs updated if a convention or command changed
