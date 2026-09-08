'use strict';
/**
 * Final post-fix benchmark.
 *
 * Repeats each case and reports the median, because single 20s samples on this
 * host swung by 3x on an unchanged configuration. Drains hard between cases: the
 * earlier 14-scenario sweep contaminated itself, which is what produced a
 * nonsense 0 rps reading on a healthy endpoint.
 *
 * Cases marked BYPASS send x-no-compression, isolating the compression cost on
 * the same running server without a rebuild.
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const { readApiKey, resolveIds } = require('./lib/env.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const CONN = 50;
const DUR = 12;
const REPEATS = 3;
const KEY = readApiKey();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function drain() {
  const probe = BASE + '/api/location/provinces';
  const t0 = Date.now();
  let good = 0;
  while (Date.now() - t0 < 240000) {
    const s = Date.now();
    try {
      const r = await fetch(probe, { headers: { 'x-api-key': KEY } });
      await r.text();
      good = Date.now() - s <= 25 ? good + 1 : 0;
      if (good >= 5) return true;
    } catch {
      good = 0;
    }
    await sleep(400);
  }
  console.log('      (WARNING: did not fully drain)');
  return false;
}

async function run(pathname, hdrs) {
  const r = await autocannon({
    url: BASE + pathname,
    connections: CONN,
    duration: DUR,
    headers: { 'x-api-key': KEY, ...hdrs },
    timeout: 30,
  });
  return {
    rps: r.requests.average,
    p50: r.latency.p50,
    p99: r.latency.p99,
    bytesPerSec: r.throughput.average,
    non2xx: r.non2xx || 0,
  };
}

(async () => {
  const ids = resolveIds();
  const cases = [
    ['listings            (fix 3: covered count)', '/api/listings?page=1&limit=20', {}],
    ['searchPriceSort     (fix 4: indexed sort) ', '/api/search?sort=price_asc&page=1&limit=20', {}],
    ['search              (mixed)               ', '/api/search?page=1&limit=20', {}],
    ['seoHome             compressed            ', '/api/seo/home', {}],
    ['seoHome             BYPASS compression    ', '/api/seo/home', { 'x-no-compression': '1' }],
    ['categoryTree  78KB  compressed            ', '/api/categories', {}],
    ['categoryTree  78KB  BYPASS compression    ', '/api/categories', { 'x-no-compression': '1' }],
    ['locationProvinces   never compressed      ', '/api/location/provinces', {}],
  ];

  const acc = {};
  for (let i = 1; i <= REPEATS; i++) {
    console.log(`\n--- repeat ${i}/${REPEATS} ---`);
    for (const [label, p, hdrs] of cases) {
      await drain();
      const r = await run(p, hdrs);
      (acc[label] = acc[label] || []).push(r);
      console.log(
        `  ${label} rps=${String(Math.round(r.rps)).padStart(6)} p50=${String(r.p50).padStart(4)} p99=${String(r.p99).padStart(6)} non2xx=${r.non2xx}`,
      );
    }
  }

  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log('\n\n=== MEDIANS across ' + REPEATS + ' repeats ===');
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('case', 44) + pad('rps', 8) + pad('p50', 7) + pad('p99', 8) + pad('MB/s', 8) + 'samples');
  const summary = {};
  for (const [label, arr] of Object.entries(acc)) {
    const rps = med(arr.map((x) => x.rps));
    summary[label.trim()] = Math.round(rps);
    console.log(
      pad(label, 44) +
        pad(Math.round(rps), 8) +
        pad(med(arr.map((x) => x.p50)), 7) +
        pad(med(arr.map((x) => x.p99)), 8) +
        pad((med(arr.map((x) => x.bytesPerSec)) / 1048576).toFixed(2), 8) +
        '[' + arr.map((x) => Math.round(x.rps)).join(', ') + ']',
    );
  }

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, 'results', 'final-bench.json'),
    JSON.stringify({ at: new Date().toISOString(), conn: CONN, dur: DUR, repeats: REPEATS, raw: acc, medians: summary }, null, 2),
  );
  console.log('\nwrote results/final-bench.json');
})();
