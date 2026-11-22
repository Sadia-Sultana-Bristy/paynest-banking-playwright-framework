'use strict';

/**
 * Custom Playwright reporter: summarises results by tag (@smoke, @transfers,
 * ...) and by project (browser), lists flaky and failed tests, and writes
 * Markdown to reports/summary.md.
 *
 * In GitHub Actions the same Markdown is appended to the job summary page
 * ($GITHUB_STEP_SUMMARY), so reviewers see results without downloading
 * artifacts. Works for normal runs and for `playwright merge-reports`.
 */
const fs = require('fs');
const path = require('path');

class TagSummaryReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || 'reports/summary.md';
    this.title = options.title || 'Test run summary';
    this.tests = new Map();
  }

  onBegin(config) {
    this.rootDir = config.rootDir;
    this.startedAt = Date.now();
  }

  onTestEnd(test, result) {
    // keep the final attempt only; remember how many attempts were needed
    this.tests.set(test.id, { test, result, outcome: test.outcome() });
  }

  async onEnd(fullResult) {
    const rows = [...this.tests.values()];
    const count = (fn) => rows.filter(fn).length;
    const totals = {
      total: rows.length,
      passed: count((r) => r.outcome === 'expected'),
      flaky: count((r) => r.outcome === 'flaky'),
      failed: count((r) => r.outcome === 'unexpected'),
      skipped: count((r) => r.outcome === 'skipped'),
    };

    const byKey = (keyFn) => {
      const map = new Map();
      for (const r of rows) {
        for (const key of keyFn(r)) {
          const bucket = map.get(key) || { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 };
          bucket.total += 1;
          if (r.outcome === 'expected') bucket.passed += 1;
          else if (r.outcome === 'flaky') bucket.flaky += 1;
          else if (r.outcome === 'skipped') bucket.skipped += 1;
          else bucket.failed += 1;
          map.set(key, bucket);
        }
      }
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    };

    const table = (heading, entries) =>
      [
        `| ${heading} | Total | Passed | Failed | Flaky | Skipped |`,
        '|---|---:|---:|---:|---:|---:|',
        ...entries.map(([k, b]) => `| ${k} | ${b.total} | ${b.passed} | ${b.failed} | ${b.flaky} | ${b.skipped} |`),
      ].join('\n');

    const titleOf = (r) => `${r.test.parent.project()?.name || ''} › ${r.test.titlePath().slice(3).join(' › ')}`;
    const status = fullResult.status === 'passed' ? '✅ Passed' : '❌ Failed';
    const minutes = ((fullResult.duration ?? Date.now() - this.startedAt) / 60000).toFixed(1);

    const md = [
      `## ${this.title}: ${status}`,
      '',
      `**${totals.total}** tests · **${totals.passed}** passed · **${totals.failed}** failed · **${totals.flaky}** flaky · **${totals.skipped}** skipped · ${minutes} min`,
      '',
      '### By project',
      table('Project', byKey((r) => [r.test.parent.project()?.name || 'default'])),
      '',
      '### By tag',
      table('Tag', byKey((r) => (r.test.tags.length ? r.test.tags : ['(untagged)']))),
      totals.flaky
        ? `\n### Flaky (passed on retry)\n${rows.filter((r) => r.outcome === 'flaky').map((r) => `- ${titleOf(r)}`).join('\n')}`
        : '',
      totals.failed
        ? `\n### Failed\n${rows.filter((r) => r.outcome === 'unexpected').map((r) => `- ${titleOf(r)}`).join('\n')}`
        : '',
      '',
    ].join('\n');

    const file = path.resolve(process.cwd(), this.outputFile);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

    // eslint-disable-next-line no-console
    console.log(
      `\nSummary: ${totals.passed} passed, ${totals.failed} failed, ${totals.flaky} flaky, ${totals.skipped} skipped -> ${this.outputFile}`,
    );
  }

  printsToStdio() {
    return false;
  }
}

module.exports = TagSummaryReporter;
