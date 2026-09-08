'use strict';
/**
 * Per-request backend work profile.
 *
 * Runs a fixed, modest load against each scenario and reads exact server-side
 * counters before/after, yielding Mongo ops per request, ES queries per request,
 * Redis commands per request, and real network bytes. This is what distinguishes
 * "endpoint is slow" from "endpoint issues six round trips per call".
 *
 * Deliberately low concurrency: the goal is an accurate per-request work count,
 * not peak throughput, and queueing does not change the op count.
 */

const fs = require('fs');
const path = require('path');
const { readApiKey, resolveIds } = require('./lib/env.js');
const { buildScenarios } = require('./lib/scenarios.js');
const { snapshot, delta } = require('./lib/dbstats.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const REQUESTS = Number(process.env.PERF_IO_REQUESTS || 300);
const CONC = Number(process.env.PERF_IO_CONC || 4);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fire(url, apiKey, n, conc) {
  let done = 0;
  let bytes = 0;
  let ok = 0;
  const worker = async () => {
    while (done < n) {
      done++;
      try {
        const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
        const t = await res.text();
        bytes += Buffer.byteLength(t);
        if (res.ok) ok++;
      } catch {
        /* counted as not-ok */
      }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  return { bytes, ok };
}

(async () => {
  const apiKey = readApiKey();
  const ids = resolveIds();
  const scenarios = buildScenarios(ids);
  const out = { startedAt: new Date().toISOString(), requests: REQUESTS, concurrency: CONC, scenarios: {} };

  for (const [key, sc] of Object.entries(scenarios)) {
    // Warm caches so we measure steady-state work, not first-call cache fill.
    await fire(BASE + sc.path, apiKey, 30, 2);
    await sleep(400);

    const before = await snapshot();
    const { bytes, ok } = await fire(BASE + sc.path, apiKey, REQUESTS, CONC);
    const after = await snapshot();

    const d = delta(before, after, REQUESTS);
    d.responseBytesPerRequest = Math.round(bytes / REQUESTS);
    d.okCount = ok;
    out.scenarios[key] = { path: sc.path, name: sc.name, metrics: d };

    console.log(
      `${key.padEnd(22)} mongoOps/req=${String(d.mongo.opsPerRequest).padStart(7)} ` +
        `esQ/req=${String(d.es.queriesPerRequest).padStart(6)} ` +
        `redisCmd/req=${String(d.redis.commandsPerRequest).padStart(6)} ` +
        `mongoOutKB/req=${String(d.mongo.bytesOutPerRequestKB).padStart(8)} ` +
        `respB/req=${String(d.responseBytesPerRequest).padStart(7)}`,
    );
    await sleep(600);
  }

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const file = path.join(__dirname, 'results', 'backend-io.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
})();
