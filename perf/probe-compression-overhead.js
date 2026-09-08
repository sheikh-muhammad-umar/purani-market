'use strict';
/**
 * Does the compression middleware cost throughput on responses it does not
 * compress?
 *
 * /api/location/provinces is 969 bytes, below the 1KB threshold, so it is never
 * compressed -- but the middleware still wraps write/end on every response to
 * decide that. This measures the same endpoint with compression active versus
 * bypassed via the x-no-compression escape hatch wired into the filter, plus a
 * repeat count so host noise can be distinguished from a real regression.
 */

const autocannon = require('autocannon');
const { readApiKey } = require('./lib/env.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const CONN = 50;
const DUR = 12;
const REPEATS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for the server to go quiet.
 *
 * Without this the previous case's backlog is still being served when the next
 * one starts, which produced samples of [1969, 661, 174] rps for one unchanged
 * configuration -- more spread within a case than between cases, so the
 * comparison was meaningless.
 */
async function drain() {
  const probe = BASE + '/api/location/provinces';
  const key = readApiKey();
  const t0 = Date.now();
  let good = 0;
  while (Date.now() - t0 < 240000) {
    const s = Date.now();
    try {
      const r = await fetch(probe, { headers: { 'x-api-key': key } });
      await r.text();
      good = Date.now() - s <= 25 ? good + 1 : 0;
      if (good >= 5) return true;
    } catch {
      good = 0;
    }
    await sleep(400);
  }
  console.log('    (WARNING: did not fully drain)');
  return false;
}

async function run(path, extraHeaders) {
  const r = await autocannon({
    url: BASE + path,
    connections: CONN,
    duration: DUR,
    headers: { 'x-api-key': readApiKey(), ...extraHeaders },
    timeout: 30,
  });
  return { rps: r.requests.average, p50: r.latency.p50, p99: r.latency.p99 };
}

(async () => {
  const cases = [
    ['provinces  969B  compression ACTIVE ', '/api/location/provinces', {}],
    ['provinces  969B  compression BYPASS ', '/api/location/provinces', { 'x-no-compression': '1' }],
    ['adServe    580B  compression ACTIVE ', '/api/ads/serve?placement=search_top', {}],
    ['adServe    580B  compression BYPASS ', '/api/ads/serve?placement=search_top', { 'x-no-compression': '1' }],
    ['categories 78KB  compression ACTIVE ', '/api/categories', {}],
    ['categories 78KB  compression BYPASS ', '/api/categories', { 'x-no-compression': '1' }],
  ];

  const results = {};
  for (let i = 1; i <= REPEATS; i++) {
    console.log(`\n--- repeat ${i}/${REPEATS} ---`);
    for (const [label, path, hdrs] of cases) {
      await drain();
      const r = await run(path, hdrs);
      (results[label] = results[label] || []).push(r.rps);
      console.log(
        `  ${label} rps=${String(Math.round(r.rps)).padStart(6)} p50=${String(r.p50).padStart(4)} p99=${String(r.p99).padStart(5)}`,
      );
    }
  }

  console.log('\n=== medians across repeats ===');
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const [label, arr] of Object.entries(results)) {
    console.log(`  ${label} median rps=${Math.round(med(arr))}   samples=[${arr.map(Math.round).join(', ')}]`);
  }
})();
