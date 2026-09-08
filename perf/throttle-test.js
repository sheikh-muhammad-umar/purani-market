'use strict';
/**
 * Throttle verification.
 *
 * Run against an instance using the SHIPPED throttle values (limit 120 / 60s).
 * Fires requests sequentially and records where the limiter engages, plus which
 * headers and status it returns. Sequential rather than concurrent so the
 * cut-off index is unambiguous.
 */

const { readApiKey } = require('./lib/env.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const PATH = process.env.PERF_THROTTLE_PATH || '/api/location/provinces';
const N = Number(process.env.PERF_THROTTLE_N || 200);

(async () => {
  const apiKey = readApiKey();
  let ok = 0;
  let limited = 0;
  let other = 0;
  let firstLimitedAt = null;
  let headersAtLimit = null;
  let bodyAtLimit = null;

  const t0 = Date.now();
  for (let i = 1; i <= N; i++) {
    const res = await fetch(BASE + PATH, {
      headers: { 'x-api-key': apiKey || '' },
    });
    if (res.status === 429) {
      limited++;
      if (firstLimitedAt === null) {
        firstLimitedAt = i;
        headersAtLimit = Object.fromEntries(
          [...res.headers.entries()].filter(([k]) =>
            /ratelimit|retry-after/i.test(k),
          ),
        );
        bodyAtLimit = (await res.text()).slice(0, 200);
      } else {
        await res.text();
      }
    } else if (res.status >= 200 && res.status < 300) {
      ok++;
      await res.text();
    } else {
      other++;
      await res.text();
    }
  }
  const elapsedSec = (Date.now() - t0) / 1000;

  console.log(
    JSON.stringify(
      {
        target: BASE + PATH,
        requestsSent: N,
        elapsedSec: +elapsedSec.toFixed(2),
        achievedReqPerSec: +(N / elapsedSec).toFixed(1),
        accepted2xx: ok,
        throttled429: limited,
        otherStatus: other,
        firstThrottledAtRequest: firstLimitedAt,
        rateLimitHeaders: headersAtLimit,
        throttledBody: bodyAtLimit,
      },
      null,
      2,
    ),
  );
})();
