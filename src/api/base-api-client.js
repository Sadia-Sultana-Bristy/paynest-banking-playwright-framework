'use strict';

const { withRetry } = require('../utils/retry');
const { createLogger } = require('../utils/logger');

class ApiError extends Error {
  constructor(method, url, status, body) {
    super(`${method} ${url} -> ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Thin wrapper around Playwright's APIRequestContext.
 *  - Parses JSON and raises a typed ApiError for non-2xx responses.
 *  - Retries idempotent requests (GET) on 5xx / network errors only.
 *  - Exposes `raw()` for negative tests that need the untouched response.
 */
class BaseApiClient {
  /** @param {import('@playwright/test').APIRequestContext} request */
  constructor(request, { headers = {}, name = 'api' } = {}) {
    this.request = request;
    this.headers = headers;
    this.log = createLogger(name);
  }

  async raw(method, url, { data, params } = {}) {
    return this.request.fetch(url, { method, data, params, headers: this.headers });
  }

  async send(method, url, options = {}) {
    const idempotent = method === 'GET';
    return withRetry(
      async () => {
        this.log.debug(`${method} ${url}`);
        const response = await this.raw(method, url, options);
        const isJson = (response.headers()['content-type'] || '').includes('json');
        const body = isJson ? await response.json() : await response.text();
        if (!response.ok()) throw new ApiError(method, url, response.status(), body);
        return body;
      },
      {
        retries: idempotent ? 2 : 0,
        label: `${method} ${url}`,
        shouldRetry: (error) => !(error instanceof ApiError) || error.status >= 500,
      },
    );
  }

  get(url, params) {
    return this.send('GET', url, { params });
  }

  post(url, data) {
    return this.send('POST', url, { data });
  }

  delete(url) {
    return this.send('DELETE', url);
  }
}

module.exports = { BaseApiClient, ApiError };
