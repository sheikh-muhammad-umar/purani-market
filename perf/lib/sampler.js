'use strict';
/**
 * Resource sampler.
 *
 * Samples the backend Node process and the three infrastructure containers
 * while a load profile runs, so latency numbers can be attributed to a
 * resource (CPU-bound vs waiting on a DB).
 *
 * CPU is derived from the *delta* of cumulative CPU time over the sampling
 * interval rather than `ps %cpu`, which on macOS reports a decaying average
 * that lags sharply behind a 30s test and would understate peaks.
 * Reported as percent of ONE core, so 800 == 8 cores saturated.
 */

const { execFile } = require('child_process');

function sh(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout) =>
      resolve(err ? '' : stdout.trim()),
    );
  });
}

/** Parses ps cputime ([DD-]HH:MM:SS.ss | MM:SS.ss) into seconds. */
function parseCpuTime(raw) {
  if (!raw) return null;
  let s = raw.trim();
  let days = 0;
  if (s.includes('-')) {
    const [d, rest] = s.split('-');
    days = parseInt(d, 10) || 0;
    s = rest;
  }
  const parts = s.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return sec + days * 86400;
}

/** Parses a docker stats size string ("1.5GiB", "12.3MB", "0B") into bytes. */
function parseSize(raw) {
  if (!raw) return null;
  const m = /^([\d.]+)\s*([KMGT]?i?B)$/i.exec(raw.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const mult = {
    b: 1,
    kb: 1e3,
    mb: 1e6,
    gb: 1e9,
    tb: 1e12,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  }[unit];
  return mult ? n * mult : null;
}

const CONTAINERS = [
  'personal-mongodb-1',
  'personal-elasticsearch-1',
  'personal-redis-1',
];

class Sampler {
  /** @param {number} pid backend Node process id */
  constructor(pid) {
    this.pid = pid;
    this.procSamples = []; // { cpuPctOneCore, rssBytes }
    this.containerSamples = new Map(); // name -> [{cpuPct, memBytes}]
    this.netStart = null;
    this.netEnd = null;
    this._prev = null;
    this._timer = null;
    this._dockerTimer = null;
    this._stopped = false;
    for (const c of CONTAINERS) this.containerSamples.set(c, []);
  }

  async _sampleProc() {
    const out = await sh('ps', ['-o', 'cputime=,rss=', '-p', String(this.pid)]);
    if (!out) return;
    const parts = out.split(/\s+/).filter(Boolean);
    const cpuSec = parseCpuTime(parts[0]);
    const rssKb = Number(parts[1]);
    if (cpuSec == null || Number.isNaN(rssKb)) return;
    const now = Date.now();
    if (this._prev) {
      const wall = (now - this._prev.now) / 1000;
      if (wall > 0) {
        this.procSamples.push({
          cpuPctOneCore: ((cpuSec - this._prev.cpuSec) / wall) * 100,
          rssBytes: rssKb * 1024,
        });
      }
    }
    this._prev = { now, cpuSec };
  }

  async _dockerStats() {
    const out = await sh('docker', [
      'stats',
      '--no-stream',
      '--format',
      '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}',
      ...CONTAINERS,
    ]);
    if (!out) return null;
    const rows = {};
    for (const line of out.split('\n')) {
      const [name, cpu, mem, net] = line.split('\t');
      if (!name) continue;
      rows[name.trim()] = {
        cpuPct: parseFloat(cpu) || 0,
        memBytes: parseSize((mem || '').split('/')[0]) || 0,
        netRxBytes: parseSize((net || '').split('/')[0]) || 0,
        netTxBytes: parseSize((net || '').split('/')[1]) || 0,
      };
    }
    return rows;
  }

  async start() {
    await this._sampleProc(); // prime the CPU delta
    this.netStart = await this._dockerStats();
    this._timer = setInterval(() => {
      if (!this._stopped) this._sampleProc().catch(() => {});
    }, 500);
    const pollDocker = async () => {
      if (this._stopped) return;
      const rows = await this._dockerStats();
      if (rows) {
        for (const [name, v] of Object.entries(rows)) {
          const arr = this.containerSamples.get(name);
          if (arr) arr.push(v);
        }
      }
      if (!this._stopped) this._dockerTimer = setTimeout(pollDocker, 1500);
    };
    this._dockerTimer = setTimeout(pollDocker, 1500);
  }

  async stop() {
    this._stopped = true;
    clearInterval(this._timer);
    clearTimeout(this._dockerTimer);
    this.netEnd = await this._dockerStats();
  }

  summary() {
    const cpu = this.procSamples.map((s) => s.cpuPctOneCore);
    const rss = this.procSamples.map((s) => s.rssBytes);
    const stat = (arr) =>
      arr.length
        ? {
            avg: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
            max: +Math.max(...arr).toFixed(1),
            min: +Math.min(...arr).toFixed(1),
          }
        : null;

    const containers = {};
    for (const [name, arr] of this.containerSamples) {
      if (!arr.length) continue;
      containers[name] = {
        cpuPct: stat(arr.map((a) => a.cpuPct)),
        memMB: stat(arr.map((a) => a.memBytes / 1048576)),
      };
    }

    // Network I/O as a delta across the run (cumulative counters).
    const net = {};
    if (this.netStart && this.netEnd) {
      for (const name of CONTAINERS) {
        const a = this.netStart[name];
        const b = this.netEnd[name];
        if (!a || !b) continue;
        net[name] = {
          rxMB: +((b.netRxBytes - a.netRxBytes) / 1048576).toFixed(2),
          txMB: +((b.netTxBytes - a.netTxBytes) / 1048576).toFixed(2),
        };
      }
    }

    return {
      backendProcess: {
        cpuPctOneCore: stat(cpu),
        rssMB: rss.length
          ? {
              avg: +(
                rss.reduce((a, b) => a + b, 0) /
                rss.length /
                1048576
              ).toFixed(1),
              max: +(Math.max(...rss) / 1048576).toFixed(1),
              start: +(rss[0] / 1048576).toFixed(1),
              end: +(rss[rss.length - 1] / 1048576).toFixed(1),
            }
          : null,
        samples: rss.length,
      },
      containers,
      containerNetIO: net,
    };
  }
}

module.exports = { Sampler, parseSize, parseCpuTime };
