'use strict';
/**
 * A/B test: cost of the global per-request logger.
 *
 * Same binary, same configuration, same data. The only difference is where the
 * process's stdout points. Node writes to a regular file SYNCHRONOUSLY, so if
 * per-request logging is on the critical path, sending stdout to /dev/null
 * removes the blocking write and throughput should rise measurably.
 *
 * Usage: node ab-logging.js <label>
 * Run once per backend configuration, then compare the two JSON outputs.
 */

const fs = require('fs');
const path = require('path');
const { readApiKey, resolveIds } = require('./lib/env.js');
const { buildScenarios } = require('./lib/scenarios.js');
const { runStage } = require('./lib/runner.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const LABEL = process.argv[2] || 'unlabelled';
const CONN = Number(process.env.AB_CONN || 50);
const DUR = Number(process.env.AB_DUR || 20);

// A cached endpoint (max requests/sec, so max log lines/sec) plus two DB-bound
// ones, to show the effect is broad rather than specific to one handler.
const KEYS = ['seoHome', 'locationProvinces', 'searchPlain', 'listings'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function drain(apiKey) {
  const probe = BASE + '/api/location/provinces';
  const t0 = Date.now();
  let good = 0;
  while (Date.now() - t0 < 180000) {
    const s = Date.now();
    try {
      const r = await fetch(probe, { headers: { 'x-api-key': apiKey } });
      await r.text();
      good = Date.now() - s <= 60 ? good + 1 : 0;
      if (good >= 3) return;
    } catch {
      good = 0;
    }
    await sleep(500);
  }
}

(async () => {
  const apiKey = readApiKey();
  const ids = resolveIds();
  const scenarios = buildScenarios(ids);
  const pidFile = path.join(__dirname, 'logs', 'backend.pid');
  const pid = fs.existsSync(pidFile)
    ? Number(fs.readFileSync(pidFile, 'utf8').trim())
    : null;

  const out = { label: LABEL, conn: CONN, dur: DUR, at: new Date().toISOString(), stages: {} };
  console.log(`A/B label=${LABEL} conn=${CONN} dur=${DUR}s pid=${pid}`);

  for (const key of KEYS) {
    const sc = scenarios[key];
    await drain(apiKey);
    for (let i = 0; i < 25; i++) {
      const r = await fetch(BASE + sc.path, { headers: { 'x-api-key': apiKey } });
      await r.text();
    }
    const r = await runStage({
      url: BASE,
      path: sc.path,
      apiKey,
      connections: CONN,
      duration: DUR,
      pid,
    });
    out.stages[key] = r;
    console.log(
      `  ${key.padEnd(20)} rps=${String(Math.round(r.throughput.reqPerSecAvg)).padStart(6)} ` +
        `p50=${String(r.latencyMs.p50).padStart(5)} p99=${String(r.latencyMs.p99).padStart(6)} ` +
        `cpu=${String(r.resources?.backendProcess?.cpuPctOneCore?.avg ?? '-').padStart(6)}%`,
    );
    await drain(apiKey);
  }

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const f = path.join(__dirname, 'results', `ab-logging-${LABEL}.json`);
  fs.writeFileSync(f, JSON.stringify(out, null, 2));
  console.log(`wrote ${path.relative(process.cwd(), f)}`);
})();
