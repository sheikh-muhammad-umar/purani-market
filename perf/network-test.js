'use strict';
/**
 * Network I/O and congestion analysis.
 *
 * Checks whether responses are compressed, how large the payloads are, whether
 * connections are reused, and what bandwidth each endpoint would demand at its
 * measured peak throughput. Uncompressed JSON is the usual cause of a service
 * that is fast on localhost and slow over a real network, because localhost has
 * effectively infinite bandwidth and hides the payload cost entirely.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { readApiKey, resolveIds } = require('./lib/env.js');
const { buildScenarios } = require('./lib/scenarios.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';

// Peak rps measured in the load profile, used to project bandwidth demand.
const PEAK_RPS = {
  categoryTree: 1118,
  inheritedAttributes: 627,
  searchPlain: 297,
  searchWithCategory: 371,
  searchEmptyCategory: 443,
  searchText: 399,
  searchPriceSort: 461,
  listings: 85,
  listingsDeepPage: 112,
  shortsFeed: 584,
  seoHome: 6028,
  seoListing: 6783,
  adServe: 1389,
  locationProvinces: 2230,
};

(async () => {
  const apiKey = readApiKey();
  const ids = resolveIds();
  const scenarios = buildScenarios(ids);
  const rows = [];

  for (const [key, sc] of Object.entries(scenarios)) {
    // Explicitly advertise support for compression.
    const res = await fetch(BASE + sc.path, {
      headers: {
        'x-api-key': apiKey,
        'accept-encoding': 'gzip, deflate, br',
      },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const encoding = res.headers.get('content-encoding') || 'none';
    const connection = res.headers.get('connection') || '(absent)';
    const cacheControl = res.headers.get('cache-control') || '(absent)';
    const etag = res.headers.get('etag') ? 'yes' : 'no';

    // What it would have cost if gzip were enabled.
    const gz = zlib.gzipSync(buf, { level: 6 }).length;
    const br = zlib.brotliCompressSync(buf).length;

    rows.push({
      key,
      path: sc.path,
      bytes: buf.length,
      encoding,
      gzipBytes: gz,
      brotliBytes: br,
      gzipSavingPct: buf.length ? +(((buf.length - gz) / buf.length) * 100).toFixed(1) : 0,
      brotliSavingPct: buf.length ? +(((buf.length - br) / buf.length) * 100).toFixed(1) : 0,
      connection,
      cacheControl,
      etag,
      peakRps: PEAK_RPS[key] ?? null,
    });
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('=== compression & payload ===');
  console.log(
    pad('endpoint', 22) + pad('bytes', 9) + pad('enc', 6) + pad('gzip', 9) +
      pad('save%', 8) + pad('brotli', 9) + pad('save%', 8) + pad('etag', 6) + pad('cache-control', 16),
  );
  for (const r of rows) {
    console.log(
      pad(r.key, 22) + pad(r.bytes, 9) + pad(r.encoding, 6) + pad(r.gzipBytes, 9) +
        pad(r.gzipSavingPct, 8) + pad(r.brotliBytes, 9) + pad(r.brotliSavingPct, 8) +
        pad(r.etag, 6) + pad(r.cacheControl.slice(0, 15), 16),
    );
  }

  console.log('\n=== projected bandwidth at measured peak throughput ===');
  console.log(
    pad('endpoint', 22) + pad('peak rps', 10) + pad('now Mbit/s', 13) +
      pad('gzip Mbit/s', 13) + pad('saved Mbit/s', 13),
  );
  let totalNow = 0;
  let totalGz = 0;
  for (const r of rows) {
    if (!r.peakRps) continue;
    const now = (r.bytes * r.peakRps * 8) / 1e6;
    const gzM = (r.gzipBytes * r.peakRps * 8) / 1e6;
    totalNow += now;
    totalGz += gzM;
    console.log(
      pad(r.key, 22) + pad(r.peakRps, 10) + pad(now.toFixed(1), 13) +
        pad(gzM.toFixed(1), 13) + pad((now - gzM).toFixed(1), 13),
    );
  }
  console.log(
    pad('', 22) + pad('', 10) + pad(totalNow.toFixed(1), 13) + pad(totalGz.toFixed(1), 13) +
      pad((totalNow - totalGz).toFixed(1), 13),
  );

  console.log('\n=== connection reuse (keep-alive) ===');
  const t0 = Date.now();
  const agentTest = [];
  for (let i = 0; i < 5; i++) {
    const s = Date.now();
    const r = await fetch(BASE + '/api/location/provinces', {
      headers: { 'x-api-key': apiKey },
    });
    await r.text();
    agentTest.push(Date.now() - s);
  }
  console.log(`  5 sequential requests (ms): ${agentTest.join(', ')}`);
  console.log(`  connection header: ${rows[0].connection}`);
  console.log(`  total ${Date.now() - t0}ms`);

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(
    path.join(__dirname, 'results', 'network.json'),
    JSON.stringify({ at: new Date().toISOString(), rows }, null, 2),
  );
  console.log('\nwrote results/network.json');
})();
