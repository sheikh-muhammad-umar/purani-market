'use strict';
/**
 * Autocannon wrapper that pairs every run with resource sampling.
 *
 * Records non-2xx separately from socket errors: a 429 flood and a connection
 * reset are both "errors" in a naive count but mean opposite things (rate
 * limiter working vs server falling over).
 */

const autocannon = require('autocannon');
const { Sampler } = require('./sampler.js');

/**
 * @param {object} opts
 * @param {string} opts.url        base url
 * @param {string} opts.path       request path
 * @param {string} opts.apiKey
 * @param {number} opts.connections
 * @param {number} opts.duration   seconds
 * @param {number} [opts.overallRate] requests/sec cap across all connections
 * @param {number} [opts.pid]      backend pid to sample
 */
async function runStage(opts) {
  const sampler = opts.pid ? new Sampler(opts.pid) : null;
  if (sampler) await sampler.start();

  const result = await autocannon({
    url: opts.url + opts.path,
    connections: opts.connections,
    duration: opts.duration,
    ...(opts.overallRate ? { overallRate: opts.overallRate } : {}),
    headers: { 'x-api-key': opts.apiKey },
    // Long enough that a slow endpoint records latency instead of a timeout.
    timeout: 30,
  });

  if (sampler) await sampler.stop();

  const non2xx =
    (result.non2xx || 0) +
    (result['1xx'] || 0) * 0; // non2xx already aggregates; kept explicit
  const socketErrors =
    (result.errors || 0) + (result.timeouts || 0) + (result.resets || 0);
  const totalReq = result.requests.total || 0;

  return {
    connections: opts.connections,
    duration: opts.duration,
    overallRate: opts.overallRate || null,
    latencyMs: {
      p50: result.latency.p50,
      p90: result.latency.p90,
      p97_5: result.latency.p97_5,
      p99: result.latency.p99,
      avg: result.latency.average,
      max: result.latency.max,
      stddev: result.latency.stddev,
    },
    throughput: {
      reqPerSecAvg: result.requests.average,
      reqPerSecStddev: result.requests.stddev,
      totalRequests: totalReq,
      bytesPerSecAvg: result.throughput.average,
      totalBytes: result.throughput.total,
    },
    errors: {
      non2xx,
      statusCodes: {
        '2xx': result['2xx'] || 0,
        '3xx': result['3xx'] || 0,
        '4xx': result['4xx'] || 0,
        '5xx': result['5xx'] || 0,
      },
      socketErrors: result.errors || 0,
      timeouts: result.timeouts || 0,
      resets: result.resets || 0,
      errorRatePct: totalReq
        ? +(((non2xx + socketErrors) / totalReq) * 100).toFixed(2)
        : 0,
    },
    resources: sampler ? sampler.summary() : null,
  };
}

module.exports = { runStage };
