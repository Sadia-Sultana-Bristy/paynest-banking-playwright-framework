'use strict';

/**
 * Used only by `playwright merge-reports` in CI to combine the blob reports
 * from every browser and shard into a single set of reports.
 */
module.exports = {
  testDir: './tests',
  reporter: [
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    ['json', { outputFile: 'reports/json/results.json' }],
    ['./src/reporters/tag-summary-reporter.js', { title: 'PayNest cross-browser run' }],
  ],
};
