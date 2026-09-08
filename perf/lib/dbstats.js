'use strict';
/**
 * Exact server-side counters for MongoDB, Elasticsearch and Redis.
 *
 * `docker stats` NetIO is rounded to 3 significant figures, which quantises a
 * 20s delta into ~10MB buckets and produced two containers reporting an
 * identical 391.01MB. These counters are exact integers, so deltas are real.
 *
 * Also captures opcounters, which convert into queries-per-request -- the
 * direct measurement of N+1 behaviour.
 */

const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 20000, maxBuffer: 1 << 24 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
}

async function mongoCounters() {
  // Number() each field inside mongosh and emit via JSON.stringify. printjson
  // wraps 64-bit counters as Long("...") and NumberLong, which is not JSON and
  // silently defeated a regex repair -- every op count came back 0.
  const script = `
    const s = db.serverStatus();
    const n = (v) => (v === undefined || v === null ? null : Number(v));
    print(JSON.stringify({
      bytesIn: n(s.network.bytesIn),
      bytesOut: n(s.network.bytesOut),
      numRequests: n(s.network.numRequests),
      opQuery: n(s.opcounters.query),
      opCommand: n(s.opcounters.command),
      opGetmore: n(s.opcounters.getmore),
      opInsert: n(s.opcounters.insert),
      opUpdate: n(s.opcounters.update),
      connCurrent: n(s.connections.current),
      connAvailable: n(s.connections.available),
      connTotalCreated: n(s.connections.totalCreated)
    }));
  `;
  const out = await run('docker', [
    'exec',
    'personal-mongodb-1',
    'mongosh',
    'marketplace',
    '--quiet',
    '--eval',
    script,
  ]);
  const line = out.trim().split('\n').filter(Boolean).pop();
  return JSON.parse(line);
}

async function esCounters() {
  const out = await run('docker', [
    'exec',
    'personal-elasticsearch-1',
    'curl',
    '-s',
    'http://localhost:9200/_nodes/stats/http,transport,indices?filter_path=nodes.*.http,nodes.*.transport,nodes.*.indices.search',
  ]);
  const j = JSON.parse(out);
  const node = Object.values(j.nodes)[0];
  return {
    httpTotalOpened: node.http?.total_opened ?? null,
    httpCurrentOpen: node.http?.current_open ?? null,
    transportRxBytes: node.transport?.rx_size_in_bytes ?? null,
    transportTxBytes: node.transport?.tx_size_in_bytes ?? null,
    searchQueryTotal: node.indices?.search?.query_total ?? null,
    searchQueryTimeMs: node.indices?.search?.query_time_in_millis ?? null,
    searchFetchTotal: node.indices?.search?.fetch_total ?? null,
  };
}

async function redisCounters() {
  const out = await run('docker', [
    'exec',
    'personal-redis-1',
    'redis-cli',
    'INFO',
    'stats',
  ]);
  const get = (k) => {
    const m = new RegExp(`^${k}:(\\d+)`, 'm').exec(out);
    return m ? Number(m[1]) : null;
  };
  const cmdOut = await run('docker', [
    'exec',
    'personal-redis-1',
    'redis-cli',
    'INFO',
    'commandstats',
  ]);
  const calls = {};
  for (const line of cmdOut.split('\n')) {
    const m = /^cmdstat_(\w+):calls=(\d+)/.exec(line.trim());
    if (m) calls[m[1]] = Number(m[2]);
  }
  return {
    netInputBytes: get('total_net_input_bytes'),
    netOutputBytes: get('total_net_output_bytes'),
    totalCommands: get('total_commands_processed'),
    keyspaceHits: get('keyspace_hits'),
    keyspaceMisses: get('keyspace_misses'),
    commandCalls: calls,
  };
}

async function snapshot() {
  const [mongo, es, redis] = await Promise.all([
    mongoCounters().catch((e) => ({ error: e.message })),
    esCounters().catch((e) => ({ error: e.message })),
    redisCounters().catch((e) => ({ error: e.message })),
  ]);
  return { at: Date.now(), mongo, es, redis };
}

function diffNum(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return b - a;
}

/** Per-request derived metrics given a snapshot pair and request count. */
function delta(before, after, requests) {
  const per = (v) => (v == null || !requests ? null : +(v / requests).toFixed(2));

  const mongoQueries =
    diffNum(before.mongo.opQuery, after.mongo.opQuery) ?? 0;
  const mongoCommands =
    diffNum(before.mongo.opCommand, after.mongo.opCommand) ?? 0;
  const mongoBytesOut = diffNum(before.mongo.bytesOut, after.mongo.bytesOut);
  const mongoBytesIn = diffNum(before.mongo.bytesIn, after.mongo.bytesIn);
  const esQueries = diffNum(
    before.es.searchQueryTotal,
    after.es.searchQueryTotal,
  );
  const esTx = diffNum(before.es.transportTxBytes, after.es.transportTxBytes);
  const redisCmds = diffNum(before.redis.totalCommands, after.redis.totalCommands);
  const redisIn = diffNum(before.redis.netInputBytes, after.redis.netInputBytes);
  const redisOut = diffNum(
    before.redis.netOutputBytes,
    after.redis.netOutputBytes,
  );

  const cmdDelta = {};
  if (before.redis.commandCalls && after.redis.commandCalls) {
    for (const [k, v] of Object.entries(after.redis.commandCalls)) {
      const d = v - (before.redis.commandCalls[k] ?? 0);
      if (d > 0) cmdDelta[k] = d;
    }
  }

  return {
    requests,
    mongo: {
      queries: mongoQueries,
      commands: mongoCommands,
      opsPerRequest: per(mongoQueries + mongoCommands),
      queriesPerRequest: per(mongoQueries),
      commandsPerRequest: per(mongoCommands),
      bytesInMB: mongoBytesIn == null ? null : +(mongoBytesIn / 1048576).toFixed(2),
      bytesOutMB: mongoBytesOut == null ? null : +(mongoBytesOut / 1048576).toFixed(2),
      bytesOutPerRequestKB:
        mongoBytesOut == null || !requests
          ? null
          : +(mongoBytesOut / requests / 1024).toFixed(2),
      connCurrent: after.mongo.connCurrent,
      connTotalCreated: diffNum(
        before.mongo.connTotalCreated,
        after.mongo.connTotalCreated,
      ),
    },
    es: {
      queries: esQueries,
      queriesPerRequest: per(esQueries),
      queryTimeMs: diffNum(
        before.es.searchQueryTimeMs,
        after.es.searchQueryTimeMs,
      ),
      transportTxMB: esTx == null ? null : +(esTx / 1048576).toFixed(2),
      httpOpened: diffNum(before.es.httpTotalOpened, after.es.httpTotalOpened),
    },
    redis: {
      commands: redisCmds,
      commandsPerRequest: per(redisCmds),
      netInMB: redisIn == null ? null : +(redisIn / 1048576).toFixed(2),
      netOutMB: redisOut == null ? null : +(redisOut / 1048576).toFixed(2),
      hits: diffNum(before.redis.keyspaceHits, after.redis.keyspaceHits),
      misses: diffNum(before.redis.keyspaceMisses, after.redis.keyspaceMisses),
      commandCalls: cmdDelta,
    },
  };
}

module.exports = { snapshot, delta };
