# Setup guide

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20 or newer (CI uses 22) | `node -v` |
| npm | 10+ | `npm -v` |
| Git | any recent | `git --version` |

Windows, macOS and Linux are all supported. VS Code with the official **Playwright Test for VS Code** extension is recommended.

## 1. Install

```bash
git clone https://github.com/Sadia-Sultana-Bristy/paynest-banking-playwright-framework.git
cd paynest-banking-playwright-framework
npm ci                              # exact versions from package-lock.json
npx playwright install --with-deps  # Chromium, Firefox, WebKit + OS dependencies
```

Only need one browser? `npx playwright install chromium` is enough for `npm run test:chromium`.

## 2. Configure (optional)

The defaults work out of the box. To override anything locally:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `TEST_ENV` | `local` | Profile from `config/environments.js` (`local`, `ci`, `staging`) |
| `BASE_URL` | from profile | Application URL |
| `TEST_SUPPORT_KEY` | from profile | Key for the test-data API. Keep real keys in CI secrets |
| `START_SERVER` | from profile | `true` = Playwright starts the demo app |
| `RETRIES` | `0` local / `2` CI | Test retries |
| `WORKERS` | 50% of CPUs | Parallel workers |
| `HEADLESS` | `true` | Set `false` to watch the browser |
| `TEST_TIMEOUT`, `EXPECT_TIMEOUT` | `30000`, `5000` | Timeouts in ms |
| `LOG_LEVEL` | `warn` | `debug` shows every API call the framework makes |

Configuration is validated at startup. An unknown `TEST_ENV`, an invalid URL or a missing key fails immediately with a clear message.

## 3. Verify

```bash
npm run test:smoke
```

Playwright starts the demo app on port 3000, runs the smoke suite and writes reports to `reports/`.

## 4. Explore the demo app manually (optional)

```bash
npm run app                          # http://localhost:3000
npm run mfa -- paynest-demo-secret   # current MFA code for the demo customer
```

| User | Password | MFA secret | Role |
|---|---|---|---|
| `jane.doe` | `Demo#2026` | `paynest-demo-secret` | Customer |
| `admin.ops` | `Admin#2026` | `paynest-admin-secret` | Admin |

These users exist only for manual exploration. Automated tests create their own customers.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Executable doesn't exist` | Run `npx playwright install` |
| `Invalid test configuration: TEST_SUPPORT_KEY is required` | Set `TEST_SUPPORT_KEY` for non-local environments |
| `TEST_SUPPORT_KEY was rejected` | The app was started with a different key. Stop the running app or use the same key |
| Port 3000 already in use | `PORT=4000 BASE_URL=http://localhost:4000 npm test` |
| Linux: missing libraries | `npx playwright install-deps` |
