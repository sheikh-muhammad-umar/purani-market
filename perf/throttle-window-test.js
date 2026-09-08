'use strict';
/**
 * Measures the ACTUAL throttle window.
 *
 * Saturates the limit, then polls once a second until a request is accepted
 * again. The recovery delay is the real window, which is what matters -- the
 * configured `ttl` value is only an intention.
 */

const { readApiKey } = require('./lib/env.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const PATH = '/api/location/provinces';
const MAX_WAIT_SEC = 75;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const apiKey = readApiKey();
  const hdrs = { headers: { 'x-api-key': apiKey || '' } };

  // Saturate.
  let sent = 0;
  let sawLimit = false;
  for (let i = 0; i < 400; i++) {
    const res = await fetch(BASE + PATH, hdrs);
    await res.text();
    sent++;
    if (res.status === 429) {
      sawLimit = true;
      break;
    }
  }
  if (!sawLimit) {
    console.log(
      JSON.stringify(
        { error: 'limiter never engaged', sent, note: 'limit likely raised' },
        null,
        2,
      ),
    );
    return;
  }
  console.log(`limiter engaged after ${sent} requests; polling for recovery...`);

  const t0 = Date.now();
  let recoveredAtSec = null;
  for (let s = 1; s <= MAX_WAIT_SEC; s++) {
    await sleep(1000);
    const res = await fetch(BASE + PATH, hdrs);
    await res.text();
    const elapsed = (Date.now() - t0) / 1000;
    if (res.status >= 200 && res.status < 300) {
      recoveredAtSec = +elapsed.toFixed(1);
      break;
    }
    if (s % 5 === 0) console.log(`  still throttled at ${elapsed.toFixed(0)}s`);
  }

  console.log(
    JSON.stringify(
      {
        requestsToEngageLimiter: sent,
        recoveredAfterSec: recoveredAtSec,
        verdict:
          recoveredAtSec === null
            ? `still throttled after ${MAX_WAIT_SEC}s -> window >= ${MAX_WAIT_SEC}s`
            : recoveredAtSec <= 3
              ? `window is ~${recoveredAtSec}s -> effective limit is ~120 req/SEC, not per minute`
              : `window is ~${recoveredAtSec}s`,
      },
      null,
      2,
    ),
  );
})();
