'use strict';

/**
 * Tiny levelled logger. Output is prefixed with the worker index so that
 * interleaved logs from parallel workers stay readable in CI.
 * Level is controlled by LOG_LEVEL (debug | info | warn | error).
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function createLogger(scope, level = process.env.LOG_LEVEL || 'warn') {
  const threshold = LEVELS[level] ?? LEVELS.warn;
  const worker = process.env.TEST_WORKER_INDEX ?? '-';
  const write = (lvl, message, meta) => {
    if (LEVELS[lvl] < threshold) return;
    const line = `[${new Date().toISOString()}] [w${worker}] ${lvl.toUpperCase().padEnd(5)} ${scope}: ${message}`;
    // eslint-disable-next-line no-console
    (lvl === 'error' ? console.error : console.log)(meta ? `${line} ${JSON.stringify(meta)}` : line);
  };
  return {
    debug: (m, meta) => write('debug', m, meta),
    info: (m, meta) => write('info', m, meta),
    warn: (m, meta) => write('warn', m, meta),
    error: (m, meta) => write('error', m, meta),
  };
}

module.exports = { createLogger };
