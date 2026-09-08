'use strict';
/**
 * Profile runner.
 *
 * Usage: node run-profile.js <baseline|load|stress|spike|soak> [tag]
 *
 * Every profile writes a JSON result file into ./results so the report is built
 * from recorded numbers rather than scrollback. A warmup precedes each measured
 * stage: the first request to a cached endpoint pays Redis-miss + JIT cost and
 * would otherwise land in the p99 of an otherwise-warm run.
 */

const fs = require('fs');
const path = require('path');
const { readApiKey, resolveIds } = require('./lib/env.js');
const { buildScenarios } = require('./lib/scenarios.js');
const { runStage } = require('./lib/runner.js');

const BASE = process.env.PERF_BASE_URL || 'http://127.0.0.1:3100';
const RESULTS = path.join(__dirname, 'results');

function pidOf() {
  const p = path.join(__dirname, 'logs', 'backend.pid');
  return fs.existsSync(p) ? Number(fs.readFileSync(p, 'utf8').trim()) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function warmup(url, apiKey, n = 25) {
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch(url, { headers: { 'x-api-key': apiKey } });
      await r.text();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Waits until the server has drained its backlog.
 *
 * A heavy stage can leave thousands of requests still queued after autocannon
 * stops; the next stage then measures those queued requests instead of its own
 * endpoint. That produced a 132-SECOND reading on an endpoint that serves in
 * 8ms standalone. Probes a cheap endpoint until latency is back near baseline
 * for several consecutive samples.
 */
async function drain(apiKey, { thresholdMs = 60, consecutive = 3, maxWaitMs = 180000 } = {}) {
  const probe = BASE + '/api/location/provinces';
  const t0 = Date.now();
  let good = 0;
  let last = null;
  while (Date.now() - t0 < maxWaitMs) {
    const s = Date.now();
    try {
      const r = await fetch(probe, { headers: { 'x-api-key': apiKey } });
      await r.text();
      last = Date.now() - s;
      good = last <= thresholdMs ? good + 1 : 0;
      if (good >= consecutive) {
        const waited = Date.now() - t0;
        if (waited > 2000) console.log(`    (drained in ${(waited / 1000).toFixed(1)}s)`);
        return true;
      }
    } catch {
      good = 0;
    }
    await sleep(500);
  }
  console.log(
    `    (WARNING: still not drained after ${(maxWaitMs / 1000).toFixed(0)}s, last probe ${last}ms)`,
  );
  return false;
}

function fmtStage(label, r) {
  const l = r.latencyMs;
  const t = r.throughput;
  const e = r.errors;
  return (
    `  ${String(label).padEnd(26)} ` +
    `rps=${String(Math.round(t.reqPerSecAvg)).padStart(6)} ` +
    `p50=${String(l.p50).padStart(5)} p90=${String(l.p90).padStart(6)} ` +
    `p99=${String(l.p99).padStart(6)} max=${String(l.max).padStart(6)} ` +
    `err=${String(e.errorRatePct).padStart(6)}% ` +
    `cpu=${String(r.resources?.backendProcess?.cpuPctOneCore?.avg ?? '-').padStart(6)}% ` +
    `rss=${String(r.resources?.backendProcess?.rssMB?.max ?? '-').padStart(6)}MB`
  );
}

async function main() {
  const profile = process.argv[2];
  const tag = process.argv[3] || '';
  if (!profile) {
    console.error('usage: node run-profile.js <baseline|load|stress|spike|soak> [tag]');
    process.exit(1);
  }

  const apiKey = readApiKey();
  const ids = resolveIds();
  const scenarios = buildScenarios(ids);
  const pid = pidOf();
  console.log(`profile=${profile} base=${BASE} backendPid=${pid ?? 'unknown'}`);

  const out = {
    profile,
    tag,
    startedAt: new Date().toISOString(),
    baseUrl: BASE,
    backendPid: pid,
    ids,
    stages: {},
  };

  // ---- BASELINE: single connection, every scenario. Latency floor. ----
  if (profile === 'baseline') {
    for (const [key, sc] of Object.entries(scenarios)) {
      await warmup(BASE + sc.path, apiKey, 15);
      const r = await runStage({
        url: BASE,
        path: sc.path,
        apiKey,
        connections: 1,
        duration: 10,
        pid,
      });
      out.stages[key] = { scenario: sc, result: r };
      console.log(fmtStage(key, r));
      await sleep(500);
    }
  }

  // ---- LOAD: sustained expected concurrency per scenario. ----
  if (profile === 'load') {
    const CONN = Number(process.env.PERF_LOAD_CONN || 50);
    const DUR = Number(process.env.PERF_LOAD_DUR || 30);
    for (const [key, sc] of Object.entries(scenarios)) {
      // Drain BEFORE warming up, so this scenario starts from a quiet server.
      await drain(apiKey);
      await warmup(BASE + sc.path, apiKey, 25);
      const r = await runStage({
        url: BASE,
        path: sc.path,
        apiKey,
        connections: CONN,
        duration: DUR,
        pid,
      });
      out.stages[key] = { scenario: sc, result: r };
      console.log(fmtStage(key, r));
      // Drain AFTER too, and record how long the backlog took to clear: that
      // recovery time is itself a result worth reporting.
      const dt0 = Date.now();
      await drain(apiKey);
      out.stages[key].drainSec = +((Date.now() - dt0) / 1000).toFixed(1);
    }
  }

  // ---- STRESS: ramp one heavy endpoint until it degrades. ----
  if (profile === 'stress') {
    const target = process.env.PERF_STRESS_SCENARIO || 'searchWithCategory';
    const sc = scenarios[target];
    if (!sc) throw new Error(`unknown scenario ${target}`);
    out.target = { key: target, scenario: sc };
    const steps = (process.env.PERF_STRESS_STEPS || '10,25,50,100,200,400,800')
      .split(',')
      .map(Number);
    console.log(`stress target: ${sc.name}`);
    await warmup(BASE + sc.path, apiKey, 30);
    for (const conn of steps) {
      const r = await runStage({
        url: BASE,
        path: sc.path,
        apiKey,
        connections: conn,
        duration: Number(process.env.PERF_STRESS_DUR || 20),
        pid,
      });
      out.stages[`conn_${conn}`] = { connections: conn, result: r };
      console.log(fmtStage(`${conn} conns`, r));
      await sleep(2000);
    }
  }

  // ---- SPIKE: calm -> sudden burst -> calm. Measures shock + recovery. ----
  if (profile === 'spike') {
    const target = process.env.PERF_SPIKE_SCENARIO || 'searchPlain';
    const sc = scenarios[target];
    out.target = { key: target, scenario: sc };
    console.log(`spike target: ${sc.name}`);
    await warmup(BASE + sc.path, apiKey, 30);

    const phases = [
      { label: 'pre-spike calm', connections: 5, duration: 15 },
      { label: 'SPIKE', connections: 500, duration: 15 },
      { label: 'post-spike recovery', connections: 5, duration: 20 },
      { label: 'post-spike steady', connections: 5, duration: 20 },
    ];
    for (const p of phases) {
      const r = await runStage({
        url: BASE,
        path: sc.path,
        apiKey,
        connections: p.connections,
        duration: p.duration,
        pid,
      });
      out.stages[p.label] = { ...p, result: r };
      console.log(fmtStage(p.label, r));
      // No sleep between calm and spike: the abruptness is the point.
      if (p.label === 'post-spike recovery') await sleep(1000);
    }
  }

  // ---- SOAK: moderate load, extended. Watches RSS drift + latency creep. ----
  if (profile === 'soak') {
    const target = process.env.PERF_SOAK_SCENARIO || 'searchPlain';
    const sc = scenarios[target];
    const slices = Number(process.env.PERF_SOAK_SLICES || 12);
    const sliceDur = Number(process.env.PERF_SOAK_SLICE_DUR || 30);
    const conn = Number(process.env.PERF_SOAK_CONN || 30);
    out.target = { key: target, scenario: sc, slices, sliceDur, conn };
    console.log(
      `soak target: ${sc.name} (${slices} x ${sliceDur}s @ ${conn} conns = ${
        (slices * sliceDur) / 60
      } min)`,
    );
    await warmup(BASE + sc.path, apiKey, 30);
    for (let i = 1; i <= slices; i++) {
      const r = await runStage({
        url: BASE,
        path: sc.path,
        apiKey,
        connections: conn,
        duration: sliceDur,
        pid,
      });
      out.stages[`slice_${String(i).padStart(2, '0')}`] = {
        slice: i,
        elapsedMin: +(((i * sliceDur) / 60)).toFixed(1),
        result: r,
      };
      console.log(fmtStage(`slice ${i}/${slices}`, r));
    }
  }

  out.finishedAt = new Date().toISOString();
  fs.mkdirSync(RESULTS, { recursive: true });
  const file = path.join(
    RESULTS,
    `${profile}${tag ? '-' + tag : ''}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
