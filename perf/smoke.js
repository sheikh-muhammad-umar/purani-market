'use strict';
/** Verifies every scenario returns 2xx before any load profile runs. */

const { readApiKey, resolveIds } = require('./lib/env.js');
const { buildScenarios } = require('./lib/scenarios.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';

(async () => {
  const apiKey = readApiKey();
  console.log('api key loaded:', apiKey ? 'yes' : 'NO (guard may reject)');
  const ids = resolveIds();
  console.log('resolved ids:', ids);

  const scenarios = buildScenarios(ids);
  const bad = [];

  for (const [key, sc] of Object.entries(scenarios)) {
    const t0 = process.hrtime.bigint();
    let status = 0;
    let bytes = 0;
    let snippet = '';
    try {
      const res = await fetch(BASE + sc.path, {
        headers: { 'x-api-key': apiKey || '' },
      });
      status = res.status;
      const txt = await res.text();
      bytes = Buffer.byteLength(txt);
      if (status >= 400) snippet = txt.slice(0, 160);
    } catch (e) {
      snippet = e.message;
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const ok = status >= 200 && status < 300;
    if (!ok) bad.push(key);
    console.log(
      `${ok ? 'OK ' : 'BAD'} ${String(status).padEnd(4)} ${ms
        .toFixed(0)
        .padStart(6)}ms ${String(bytes).padStart(8)}B  ${key}  ${sc.path}${
        snippet ? '\n      -> ' + snippet : ''
      }`,
    );
  }

  console.log(
    bad.length
      ? `\n${bad.length} scenario(s) failing: ${bad.join(', ')}`
      : '\nall scenarios healthy',
  );
})();
