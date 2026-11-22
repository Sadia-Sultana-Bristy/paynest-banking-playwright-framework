# Architecture

This document explains how the framework is put together and why. It is written for an engineer joining the project or reviewing it.

## 1. Goals

| Goal | How it is met |
|---|---|
| Tests can run in any order, in parallel, on any number of machines | Per-test data creation and teardown; no shared state between tests |
| A failure is diagnosable from CI alone, without re-running locally | Screenshot + video + trace + console/network diagnostics on failure; merged HTML report |
| New tests are cheap to write and easy to review | Page objects, components, fixtures and custom matchers hide mechanics; specs read as behaviour |
| Fast feedback | API-based setup and sign-in; sharded cross-browser jobs; a smoke suite for quick checks |
| Same code runs against local, CI and deployed environments | Environment profiles + validated configuration; the app is started only when needed |

## 2. Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ tests/   smoke · regression · e2e · api        (what to verify)      │
│          data/*.json                            (data-driven inputs) │
├──────────────────────────────────────────────────────────────────────┤
│ src/fixtures   ui.fixtures ──extends──> api.fixtures  (wiring + hooks)│
├───────────────────────────────┬──────────────────────────────────────┤
│ src/pages + src/components    │ src/api                              │
│ (how to drive the UI)         │ (how to call the REST API)           │
├───────────────────────────────┴──────────────────────────────────────┤
│ src/utils · src/support · src/reporters · src/hooks                  │
├──────────────────────────────────────────────────────────────────────┤
│ config/ (environment profiles, validated, frozen)                    │
└──────────────────────────────────────────────────────────────────────┘
```

Dependencies only point downwards: specs never build page objects or HTTP clients themselves, and page objects never contain assertions about business outcomes. That belongs in the test.

### Page Object Model

* **`BasePage`** holds behaviour every screen shares, and acts as the framework's *custom commands*:
  * `open()` navigates and waits for the SPA's ready signal; it reloads when the URL is already current, because a hash route would otherwise not re-render.
  * `waitForReady()` waits for `#app[data-route=<route>][aria-busy=false]`, so a test never acts on the previous screen.
  * `fillForm({ Label: value, Select: { option: 'partial text' } })` fills a whole form by accessible label.
  * `selectOptionContaining()` picks options whose labels contain live data, such as balances.
  * `fieldError(field)`, `formError` and `expectToast()` cover every form's feedback.
* **Page objects** (`src/pages/`) expose locators and intention-revealing actions: `transferPage.send({...})`, `payeesPage.addPayee(...)`, `transactionsPage.exportCsv()`.
* **Components** (`src/components/`) are UI pieces that appear on several pages. `DataTable.rows()` turns any table into an array of objects keyed by column header, so tests assert on data rather than DOM structure.

### Fixtures

```
customerProfile (option) ─┐
appConfig ──> testSupport ─┴─> customer ──> signedInCustomer
          └─> bankApi (page.request in UI tests) ──┘
testSupport ──> signedInAdmin
page ──> loginPage, mfaPage, dashboardPage, transferPage, payeesPage, transactionsPage, adminPage, navBar
page ──> diagnostics (auto: runs for every UI test)
```

* `api.fixtures.js` contains everything that needs no browser, so the `api` project never launches one.
* `ui.fixtures.js` extends it and **overrides `bankApi`** to use `page.request`. API sign-in then shares the browser's cookie jar, which signs the page in as well.
* `customerProfile` is an **option fixture**: a file or `describe` block changes the customer it gets with `test.use({ customerProfile: {...} })`, for example a richer account for daily-limit tests or a fixed transaction history for filter tests.
* `diagnostics` is an **auto fixture** acting as a before/after hook for every UI test. It records console errors, uncaught page errors and 5xx responses, annotates retries, and attaches everything to the report when a test fails.

### API layer

* `BaseApiClient` wraps `APIRequestContext`: it parses JSON, raises a typed `ApiError` with status and body, and **retries only idempotent GETs on 5xx or network errors** with exponential backoff.
* `BankApi` provides customer and admin operations used to arrange state and verify the ledger behind the UI.
* `TestSupportApi` calls environment-only endpoints that create and delete customers. It tracks what it created and cleans up in fixture teardown, even when the test fails.

## 3. Test data strategy

**Every test creates the customer it needs and deletes it afterwards.**

* No shared accounts, so a transfer in one test can never change a balance another test asserts on.
* Usernames, payees and memos come from `data-factory.js`: unique per worker and timestamp, safe across parallel CI shards.
* Static inputs for validation rules live in `tests/data/*.json` and generate one test per row. Adding a rule means adding one line of JSON.
* Seeded demo users in `app/seed.js` exist only for manual exploration; no test depends on them.

## 4. Synchronisation (no hard waits)

* Web-first assertions (`await expect(locator).toHaveText(...)`) retry until the expect timeout.
* The app publishes a ready signal: `data-route` is the current route and `aria-busy` is `false` once its data is rendered. `BasePage.waitForReady()` waits on both.
* `page.waitForTimeout` is banned by lint (`playwright/no-wait-for-timeout: error`), as is `force: true`.

## 5. Retry and flakiness strategy

| Layer | Behaviour |
|---|---|
| Test retries | `0` locally (failures surface immediately), `2` in CI (`RETRIES` overrides) |
| Evidence | Trace on first retry in CI and on any failure locally; video and screenshot kept on failure |
| Visibility | Retried passes are reported as **flaky**, not passed, in the HTML report and in the tag summary |
| Reproduction | `npm run test:flaky-check` runs each test 5 times with retries off |
| Infrastructure | `withRetry()` with backoff for health checks and idempotent API GETs only, never for assertions |

## 6. Execution model

* `fullyParallel: true`: tests inside one file also run in parallel. Safe because of the data strategy.
* **Projects:** `api` (no browser), `chromium`, `firefox`, `webkit` (1366×900) and `mobile-chrome` (Pixel 7, smoke only).
* **CI:** 7 jobs in parallel (3 browsers × 2 shards, plus API and mobile together). Each writes a *blob* report, and a merge job combines them.
* **webServer:** Playwright starts the demo app for `local` and `ci` profiles and waits for `/api/health`. For deployed environments, `startServer` is false.

## 7. Reporting

| Output | Location | Used for |
|---|---|---|
| HTML report | `reports/html` (Pages on `main`) | Debugging: steps, traces, videos, screenshots, attachments |
| JUnit XML | `reports/junit/results.xml` | CI dashboards / test management import |
| JSON | `reports/json/results.json` | Custom analysis |
| Tag summary | `reports/summary.md` + GitHub job summary | At-a-glance pass/fail/flaky by browser and tag |
| Run metadata | `reports/run-metadata.json` | Environment, commit, branch and run URL for the report |

The tag summary comes from a custom reporter (`src/reporters/tag-summary-reporter.js`) that also works under `playwright merge-reports`, so CI produces one summary for all shards.

## 8. Design decisions

| # | Decision | Alternatives considered | Reason |
|---|---|---|---|
| 1 | Per-test data via a test-support API | Shared seeded users; DB snapshots | Only option that stays correct under full parallelism and sharding |
| 2 | API sign-in for non-auth tests | `storageState` files from a setup project | Each test has a different user, so a saved state can't be reused; API sign-in is equally fast |
| 3 | Real TOTP generation | Disabling MFA in test environments | Tests the real security flow; no test-only bypass in the product |
| 4 | Fixtures instead of `beforeEach` boilerplate | Base test classes | Composable, lazy (only what a test asks for is created), guaranteed teardown |
| 5 | Two fixture files (API, UI) | One file | API tests never launch a browser |
| 6 | Blob reports + merge job | Per-shard HTML reports | One report for the whole run, including every browser |
| 7 | Accessible locators | CSS/XPath | Resilient to markup changes and checks accessibility as a side effect |
| 8 | JavaScript (CommonJS) + ESLint | TypeScript | Matches the team stack; `// @ts-check` and JSDoc give editor type hints |
