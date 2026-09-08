'use strict';
/** Prints error composition and infra resource use from a saved result file. */

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('usage: node inspect.js results/<file>.json');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));

console.log(`profile=${data.profile} tag=${data.tag || '-'}`);
if (data.target) console.log(`target=${data.target.scenario.name}`);
console.log('');

const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('stage', 24) +
    pad('rps', 7) +
    pad('2xx', 9) +
    pad('4xx', 7) +
    pad('5xx', 7) +
    pad('tmo', 7) +
    pad('rst', 7) +
    pad('sockErr', 9) +
    pad('err%', 8),
);
for (const [name, s] of Object.entries(data.stages)) {
  const r = s.result;
  const e = r.errors;
  console.log(
    pad(name, 24) +
      pad(Math.round(r.throughput.reqPerSecAvg), 7) +
      pad(e.statusCodes['2xx'], 9) +
      pad(e.statusCodes['4xx'], 7) +
      pad(e.statusCodes['5xx'], 7) +
      pad(e.timeouts, 7) +
      pad(e.resets, 7) +
      pad(e.socketErrors, 9) +
      pad(e.errorRatePct, 8),
  );
}

console.log('\n--- infra CPU% (container) / mem MB, avg over stage ---');
console.log(
  pad('stage', 24) +
    pad('mongo cpu', 12) +
    pad('mongo mem', 12) +
    pad('es cpu', 10) +
    pad('es mem', 10) +
    pad('redis cpu', 11) +
    pad('redis mem', 11),
);
for (const [name, s] of Object.entries(data.stages)) {
  const c = s.result.resources?.containers || {};
  const g = (n, k) => {
    const v = c[n]?.[k];
    return v ? v.avg : '-';
  };
  console.log(
    pad(name, 24) +
      pad(g('personal-mongodb-1', 'cpuPct'), 12) +
      pad(g('personal-mongodb-1', 'memMB'), 12) +
      pad(g('personal-elasticsearch-1', 'cpuPct'), 10) +
      pad(g('personal-elasticsearch-1', 'memMB'), 10) +
      pad(g('personal-redis-1', 'cpuPct'), 11) +
      pad(g('personal-redis-1', 'memMB'), 11),
  );
}

console.log('\n--- backend process + container net I/O delta (MB) ---');
console.log(
  pad('stage', 24) +
    pad('cpu avg', 10) +
    pad('cpu max', 10) +
    pad('rss avg', 10) +
    pad('rss max', 10) +
    pad('mongoRx', 10) +
    pad('mongoTx', 10) +
    pad('esRx', 9) +
    pad('esTx', 9),
);
for (const [name, s] of Object.entries(data.stages)) {
  const bp = s.result.resources?.backendProcess || {};
  const net = s.result.resources?.containerNetIO || {};
  const n = (k, f) => (net[k] ? net[k][f] : '-');
  console.log(
    pad(name, 24) +
      pad(bp.cpuPctOneCore?.avg ?? '-', 10) +
      pad(bp.cpuPctOneCore?.max ?? '-', 10) +
      pad(bp.rssMB?.avg ?? '-', 10) +
      pad(bp.rssMB?.max ?? '-', 10) +
      pad(n('personal-mongodb-1', 'rxMB'), 10) +
      pad(n('personal-mongodb-1', 'txMB'), 10) +
      pad(n('personal-elasticsearch-1', 'rxMB'), 9) +
      pad(n('personal-elasticsearch-1', 'txMB'), 9),
  );
}

console.log('\n--- app-level throughput (bytes) ---');
for (const [name, s] of Object.entries(data.stages)) {
  const t = s.result.throughput;
  console.log(
    pad(name, 24) +
      pad((t.bytesPerSecAvg / 1048576).toFixed(2) + ' MB/s', 14) +
      pad((t.totalBytes / 1048576).toFixed(1) + ' MB total', 18) +
      pad(t.totalRequests + ' reqs', 14),
  );
}
