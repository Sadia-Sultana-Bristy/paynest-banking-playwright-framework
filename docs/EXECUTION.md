# Execution guide

## Suites and tags

Every test carries a **suite tag** and one or more **feature** or **risk** tags.

| Type | Tags |
|---|---|
| Suite | `@smoke`, `@regression`, `@e2e`, `@api` |
| Feature | `@auth`, `@accounts`, `@navigation`, `@transfers`, `@payees`, `@transactions`, `@admin`, `@export`, `@limits` |
| Risk | `@critical`, `@security`, `@boundary` |

```bash
npx playwright test --grep @smoke                     # one tag
npx playwright test --grep "@transfers|@payees"       # either tag
npx playwright test --grep "(?=.*@regression)(?=.*@security)"   # both tags
npx playwright test --grep-invert @e2e                # everything except e2e
```

## Projects (browsers and layers)

| Project | What runs | Browser |
|---|---|---|
| `api` | `tests/api/**` | none |
| `chromium` | all UI tests | Desktop Chrome 1366×900 |
| `firefox` | all UI tests | Desktop Firefox 1366×900 |
| `webkit` | all UI tests | Desktop Safari 1366×900 |
| `mobile-chrome` | `@smoke` only | Pixel 7 |

```bash
npx playwright test --project=firefox
npx playwright test --project=chromium --project=api
```

## npm scripts

| Script | Description |
|---|---|
| `npm test` | Everything, all projects |
| `npm run test:smoke` | Smoke suite |
| `npm run test:regression` | Regression suite |
| `npm run test:e2e` | End-to-end journeys |
| `npm run test:api` | API layer |
| `npm run test:chromium` | Chromium + API (quick full check) |
| `npm run test:cross-browser` | Chromium, Firefox, WebKit |
| `npm run test:mobile` | Smoke on Pixel 7 |
| `npm run test:headed` | Chromium, visible browser, 1 worker |
| `npm run test:debug` | Playwright Inspector, step by step |
| `npm run test:ui` | UI mode: watch, time-travel, pick tests |
| `npm run test:flaky-check` | Each Chromium test ×5, retries off |
| `npm run report` | Open the last HTML report |
| `npm run lint` | ESLint, including Playwright rules |

## Environments

```bash
npm test                                                     # local (starts the app)
TEST_ENV=staging BASE_URL=https://staging.example.com TEST_SUPPORT_KEY=*** npm run test:smoke
```

For a deployed environment, `startServer` is `false` and global setup checks `/api/health` before any test starts.

## Parallelism and sharding

* Locally, tests run with `fullyParallel` across 50% of CPU cores (`WORKERS=4` overrides).
* Split a run across machines with shards:

```bash
npx playwright test --project=chromium --shard=1/2
npx playwright test --project=chromium --shard=2/2
```

## Continuous integration (GitHub Actions)

Workflow: `.github/workflows/playwright.yml`

| Trigger | When |
|---|---|
| `push` | Every branch |
| `pull_request` | Into `main` |
| `schedule` | Nightly 02:30 UTC full regression |
| `workflow_dispatch` | Manual, optional `grep` input (e.g. `@smoke`) |

Jobs: **Lint** → **Tests** (7 parallel jobs) → **Merge reports** → **Publish report** (only on `main`).

To run manually, go to **Actions → Playwright CI → Run workflow**. You can enter a tag to run a subset.

### Where to find results

| What | Where |
|---|---|
| Pass/fail/flaky table by browser and tag | The run's **Summary** page |
| Inline failure annotations | Pull request **Files changed** tab |
| Merged HTML report | Artifact `html-report`, or the [live report](https://sadia-sultana-bristy.github.io/paynest-banking-playwright-framework/) for `main` |
| JUnit / JSON | Artifact `test-results-junit-json` |
| Screenshots, videos, traces from a failed job | Artifact `test-results-<job>` |

## Debugging a failure

1. Open the HTML report (`npm run report`, or download `html-report` from CI and run `npx playwright show-report <folder>`).
2. Open the failed test. Check **Errors**, then the **attachments**:
   * screenshot and video of the failure
   * `browser-console-errors.txt`, `failed-requests.txt` and `page-url.txt` from the diagnostics fixture
   * `error-context.md` (page snapshot at the failure)
3. Open the **trace** to step through every action with the DOM, network and console at that moment:
   ```bash
   npx playwright show-trace test-results/<test-folder>/trace.zip
   ```
4. Reproduce locally: `npx playwright test <file>:<line> --project=chromium --headed`.
5. Suspect flakiness? Run `npx playwright test <file> --repeat-each=10 --retries=0`.
