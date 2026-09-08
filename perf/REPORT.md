# Backend Performance Test Report

**Target:** NestJS backend (`backend/`), built from current `src` (`npm run build` run first — `dist` was stale)
**Environment:** local, macOS, 10 CPU / 16 GB. MongoDB 7 (replSet), Elasticsearch 8.18, Redis 7, all in Docker on loopback
**Test instance:** port 3100, separate from the developer instance on port 3000 (never touched)
**Harness:** `perf/` (autocannon 8.0.0 + resource sampler + server-side DB counters). Raw results in `perf/results/*.json`
**Dataset:** tested at both 105 listings (as found) and 50,105 listings / 40,035 active (seeded, tagged `perfSeed: true`)

---

## 1. Headline findings

| # | Finding | Evidence | Impact |
|---|---|---|---|
| 1 | **Single-process ceiling.** The app saturates ~1 CPU core while 9 sit idle. Throughput flatlines at ~358 rps regardless of concurrency. | CPU pinned 89–105% of one core at every load level, 10→1200 connections. `Dockerfile` runs `CMD ["node","dist/main"]`; no cluster/pm2/worker_threads anywhere. | Caps total capacity at ~1/10th of the machine |
| 2 | **Per-request logging costs 30–75% throughput.** Every request writes a log line synchronously to disk. | A/B, identical binary, only stdout destination differs: `seoHome` 6038→7860 rps (+30%), `locationProvinces` 2205→3225 (+46%), `searchPlain` 168→293 (+75%). p99 on `locationProvinces` 109ms→25ms. One test session produced a **299 MB log / 1,601,083 lines**. | Largest single easily-recoverable win |
| 3 | **No response compression.** All 14 endpoints return `content-encoding: none` even when the client sends `Accept-Encoding: gzip, deflate, br`. | gzip would cut `/api/categories` from 78,560→11,968 bytes (84.8%), search from 25,146→2,693 (89.3%). Projected bandwidth at peak: **1,291 → 240 Mbit/s (81% saved)**. `/api/categories` alone projects 702 Mbit/s and would saturate a 1 Gbit link. | Invisible on localhost, severe over real networks |
| 4 | **`deletedAt: {$exists:false}` breaks the covered count on every public list request — and is redundant where `status` is already constrained.** | `count({status:active})` = COUNT_SCAN, **0 docs examined**, 12 ms. Adding `deletedAt` = COUNT←FETCH←IXSCAN, **40,035 docs examined**, 37 ms. `softDelete` (`listings.service.ts:641-645`) and `listing-lifecycle.service.ts:180,729` always set `status: DELETED` *and* `deletedAt` together, so `{status:'active'}` already excludes soft-deleted rows. | 3× cost on every paginated read |
| 5 | **Missing `price.amount` index forces an in-memory sort.** | Price sort examines 40,035 docs to return 20 (ratio **2001:1**), 45 ms median vs **2 ms** for the indexed newest-sort — 22× slower. Subject to MongoDB's 32 MB sort limit. | Sort-by-price degrades with catalogue growth |
| 6 | **Chatty endpoints: 6 DB round trips per request.** | Measured server-side: `/api/categories/:id/inherited-attributes` = **6.04 Mongo ops to return a 96-byte response**; `/api/shorts/feed` = 6.04 ops. | Amplifies any DB latency 6× |
| 7 | **Queue buildup causes cross-endpoint head-of-line blocking.** An 8 ms endpoint became a 132-second one. | `/api/ads/serve` served in 6–33 ms standalone, but logged **132,651 ms** while a heavy `listings` stage's backlog drained. Worst observed: `/api/location/provinces` at **265,960 ms**. | One slow endpoint can stall unrelated traffic |
| 8 | **`Retry-After` header is wrong by 60×.** | Throttle returns `Retry-After: 1` and "retry after 1 seconds", but measured recovery is **60.3 s**. | Compliant clients retry too early and stay throttled |

---

## 2. Load profiles

### 2.1 Load (sustained, 50 connections, 25–30 s per endpoint)

Zero errors on every endpoint in every run. Ranked by throughput at 50 k listings (drained run):

| endpoint | rps | p50 | p90 | p99 | max |
|---|---|---|---|---|---|
| `seo/listing/:id` | 6783 | 6 | 9 | 13 | 102 |
| `seo/home` | 6028 | 7 | 11 | 19 | 208 |
| `ads/serve` | 1389 | 31 | 51 | 88 | 330 |
| `categories` | 1118 | 34 | 72 | 199 | 476 |
| `shorts/feed` | 584 | 84 | 98 | 107 | 393 |
| `categories/:id/inherited-attributes` | 627 | 60 | 143 | 233 | 459 |
| `search?sort=price_asc` | 461 | 80 | 188 | 498 | 904 |
| `search?category=empty` | 443 | 97 | 178 | 307 | 583 |
| `search?q=phone` | 399 | 98 | 216 | 436 | 967 |
| `search?category=busy` | 371 | 115 | 203 | 376 | 866 |
| `search` | 297 | 139 | 298 | 506 | 850 |
| `listings?page=50` | 112 | 448 | 599 | 747 | 929 |
| **`listings`** | **85** | **515** | **902** | **1396** | **1898** |

`locationProvinces` is excluded from this table: its stage was contaminated by the previous stage's backlog (finding 7). Measured clean elsewhere at 2205–3225 rps.

### 2.2 Stress (ramp to failure, `search?category=`)

| connections | rps | p50 | p99 | max | error % | error type |
|---|---|---|---|---|---|---|
| 10 | 406 | 19 | 113 | 282 | 0 | — |
| 25 | 444 | 46 | 178 | 289 | 0 | — |
| **50** | **495** ← peak | 92 | 333 | 437 | 0 | — |
| 100 | 423 | 178 | 940 | 2227 | 0 | — |
| 200 | 372 | 325 | 4095 | 8617 | 0 | — |
| 400 | 358 | 514 | 15454 | 20026 | 1.90 | socket only |
| 800 | 358 | 1585 | 8346 | 13253 | 0 | — |
| 1200 | 357 | 620 | 9570 | 19744 | 19.53 | socket only |

**Knee at 50 connections / ~495 rps.** Past that, throughput *falls* while latency grows roughly linearly with concurrency — textbook queueing, not capacity gain. CPU stayed pinned at ~100% of one core the whole way.

**All errors were socket-level. Zero 4xx and zero 5xx at any load.** The app never returns errors; it stops accepting connections. Infrastructure was not the limit: Mongo 44–65%, Elasticsearch 80–105%, Redis <1%.

### 2.3 Spike (5 → 500 → 5 connections)

| phase | rps | p50 | p99 | max | error % | RSS |
|---|---|---|---|---|---|---|
| pre-spike calm (5) | 479 | 7 | 58 | 268 | 0 | 507 MB |
| **spike (500)** | 624 | 359 | 2002 | 14372 | 1.15 | 643 MB |
| recovery (5) | 565 | 6 | 38 | 122 | 0 | 507 MB |
| steady (5) | 503 | 7 | 43 | 127 | 0 | 523 MB |

**Recovers fully in the next window** — p50 back to 6 ms, RSS back to 507 MB, no residual damage. Throughput *rose* during the spike (more concurrency filled the pipe) while latency paid for it. Graceful degradation, no crash.

### 2.4 Soak / Endurance (8 min, 30 connections, ~340 k requests)

| slice | rps | p50 | p99 | RSS |
|---|---|---|---|---|
| 1 | 732 | 38 | 87 | 538 MB |
| 4 | 693 | 40 | 89 | 636 MB |
| 8 | 662 | 43 | 80 | 615 MB |
| 12 | 658 | 44 | 79 | 602 MB |
| 16 | 698 | 42 | 70 | 632 MB |

**No memory leak.** RSS rose 538 MB → ~600–640 MB plateau then oscillated (normal GC), never monotonic. p50 drifted only 38→42 ms; p99 *improved* 87→70 ms. Throughput stable within ±8%. Zero errors. **Pass.**

### 2.5 Volume / Flood (105 → 50,105 listings, 500×)

Control endpoints that do not touch listings (`categories`, `shorts/feed`, `seo/home`, `locationProvinces`) held flat or improved, isolating genuine volume damage:

| endpoint | 105 docs | 50 k docs | change | cause |
|---|---|---|---|---|
| `listings?page=50` | 1724 | 112 | **−94%** | skip walks 1,226 docs; page 50 now has real data |
| `listings` | 314 | 85 | **−73%** | 40,035-doc count per request |
| `search` | 637 | 297 | **−53%** | un-`select()`ed enrichment fetch over larger docs |
| `search?category=empty` | 769 | 443 | −42% | Mongo regex fallback |
| `search?category=busy` | 581 | 371 | −36% | facets + chain walk |
| `search?q=` | 570 | 399 | −30% | — |
| `search?sort=price_asc` | 559 | 461 | −18% | — |
| `shorts/feed` | 281 | 584 | *+108%* | control — unaffected |
| `seo/home` | 2550 | 6028 | *+136%* | control — Redis cached |

---

## 3. Requested metrics

### Response time / latency
Best case p50 6 ms (`seo/*`, Redis-cached) to worst case p50 515 ms (`listings` at 50 k). p99 stays under 200 ms only for cached endpoints; the listing feed reaches p99 1396 ms at 50 connections.

### Throughput
Peak sustained **495 rps** on the search path; hard ceiling **~358 rps** under overload. Cached SEO endpoints reach 6–7.8 k rps because they never touch Mongo (measured 0.04 Mongo ops/request).

### Error rate
**0% at all normal load.** Errors appear only past the knee — 1.9% at 400 connections, 19.53% at 1200 — and are **exclusively socket-level**. No 4xx or 5xx was produced by the application at any point in any profile.

### CPU utilisation
Backend pinned at **89–105% of one core** in every profile (max spike 153%, i.e. some libuv threadpool help). Host has 10 cores. Infrastructure never became the bottleneck: Mongo 44–65%, ES 80–105%, Redis <1%.

### Memory utilisation
Idle ~190 MB; under load 500–850 MB; peak 1008 MB. Stable plateau under 8-minute soak with no leak. ES container holds a constant 1.29–1.4 GB (512 MB heap plus off-heap).

### Network I/O
Measured from exact server-side counters, not `docker stats` (whose 3-significant-figure rounding quantised 20 s deltas into ~10 MB buckets and produced two containers reporting an identical 391.01 MB — discarded as unreliable).

Per request, steady state:

| endpoint | Mongo ops | ES queries | Redis cmds | Mongo bytes out | response bytes |
|---|---|---|---|---|---|
| `inherited-attributes` | **6.04** | 0 | 0.01 | 2.89 KB | **96** |
| `shorts/feed` | **6.04** | 0 | 0.01 | 16.49 KB | 10,089 |
| `search?category=empty` | 5.04 | 1 | 0.01 | 2.05 KB | 134 |
| `search?category=busy` | 3.05 | **2** | 0.01 | 38.47 KB | 36,840 |
| `ads/serve` | 3.04 | 0 | 0.01 | 2.12 KB | 580 |
| `listings` | 2.04 | 0 | 0.01 | 38.20 KB | 39,520 |
| `search` | 1.08 | 1 | 0.01 | **37.87 KB** | 37,837 |
| `seo/home`, `seo/listing` | 0.04 | 0 | 1.01 | 0.27 KB | 1,305 / 1,723 |

`search` pulls 37.87 KB out of Mongo to produce a 37.84 KB response — the enrichment query at `search.service.ts:459-470` has `.lean()` but no `.select()`, fetching whole documents to read three fields.

### Network congestion
- **No compression** on any endpoint (finding 3). Projected peak demand 1,291 Mbit/s vs 240 Mbit/s with gzip.
- **Keep-alive works** — `connection: keep-alive`, sequential requests 2–4 ms.
- **ETags are present** on all endpoints (enables 304s) but **`Cache-Control` is absent everywhere**, so browsers and CDNs will not cache and every view costs a revalidation round trip.
- Note: gzip would *inflate* the 96-byte `inherited-attributes` response (96→109 bytes), so compression needs a minimum-size threshold (the `compression` package defaults to 1 KB).

### Throttle
Verified twice, second run after a restart for a clean window:
- **Exactly 120 requests accepted; request 121 is the first 429.** Matches `THROTTLE_DEFAULT_LIMIT` default of 120.
- **Real window 60.3 s**, matching `THROTTLE_DEFAULT_TTL` 60000 ms.
- `Retry-After: 1` returned while the real wait is 60 s (finding 8).
- Storage is **in-memory** (no Redis storage configured on `ThrottlerModule`), so limits are **per instance**. N instances behind a load balancer permit N×120, and every deploy resets all counters.
- 429 bodies are well-formed (statusCode, timestamp, path, method, message, requestId).

### Database bottlenecks
Query plans against 50,105 docs (`explain(executionStats)` — structural, so immune to host CPU noise):

| query | plan | docs examined | returned | median |
|---|---|---|---|---|
| `count({status:active})` | COUNT←**COUNT_SCAN** (covered) | **0** | — | 12 ms |
| `count({status, deletedAt:$exists:false})` ← app runs this | COUNT←FETCH←IXSCAN | **40,035** | — | 37 ms |
| `countDocuments(7-field regex)` | COUNT←FETCH←IXSCAN | 40,035 | — | 103 ms |
| regex find, **zero matches** (worst case) | LIMIT←FETCH←IXSCAN | **50,105** | 0 | 285 ms |
| price sort page | **SORT**←FETCH←IXSCAN | 40,035 | 20 (**2001:1**) | 45 ms |
| newest sort page | LIMIT←FETCH←IXSCAN | 25 | 20 | **2 ms** |
| seller listings `{sellerId,status}` | FETCH←IXSCAN | 12,527 | 9,969 | 15 ms |
| deep page `skip(980)` | LIMIT←SKIP←FETCH←IXSCAN | 1,226 | 20 | 16 ms |

**Correction to the initial static prediction: there are no COLLSCANs.** The `status_1` index rescues these queries, so the missing `deletedAt` index is a *covered-count* problem, not a full-scan problem. Also, indexes exist that are absent from the schema file (`sellerVerified_1`, `biddingEnabled_1_status_1`) — created out-of-band by `scripts/`.

Confirmed missing and worth adding: `price.amount` (sort + range), `{sellerId, status}` compound, `featuredUntil`, `condition`.

### Poor coding practices
Verified by reading the code and confirmed by measurement:

- **N+1 category chain walk.** `categories.service.ts:449-459` `getCategoryChain` issues one `findById` per level, and `findById` (`:105-114`) has no `.lean()`, hydrating the whole `attributes` array each hop. Called **twice per search request** (`search.service.ts:837` and `:1001-1003`). Measured: 6.04 Mongo ops for a 96-byte response. The same data is already Redis-cached by `getCategoryTree` in the same file (`:83-103`, 1 h TTL).
- **Same pattern repeated:** `listings.service.ts:1370-1383` (no lean), `advertising.service.ts:328-347` (per ad-serve, at least lean+bounded).
- **Unfiltered count in the shorts feed.** `shorts.service.ts:448-450` counts `{status:'active'}` while ignoring every caller filter, so the returned `total` is **wrong as well as costly** — and it is awaited *before* the aggregation instead of alongside it.
- **`shorts.service.ts` has 18 `find()` calls and zero `.lean()`**, plus 16 `populate()`. The public feed re-fetches after `$sample` and triple-populates.
- **`$match` then `$sample`** (`shorts.service.ts:474-477`) cannot use the optimised random-cursor path, and with `_id:{$nin:seenIds}` the matched set grows as the user scrolls — the feed gets slower the longer someone browses.
- **Over-fetch in search enrichment** (`search.service.ts:459-470`): `.lean()` but no `.select()`.
- **Unanchored 7-field `$regex` fallback** (`search.service.ts:524-533`): correctly escaped (no ReDoS) but unanchored and case-insensitive, so no index can serve it. Triggers when ES returns 0 hits, on any ES error, **or whenever a single orphaned ES document is detected**.
- **Sequential independent awaits:** `shorts.service.ts:448/474`, `seo.service.ts:519/533`, `categories.controller.ts:46-49` (which also re-walks the chain twice).
- **Blocking sync I/O:** `listings/storage.service.ts:85-87` `fs.existsSync` + `mkdirSync` — upload path only, low priority.

### Configuration issues
- **No connection pool or timeout settings at all** (`app.module.ts:46-76`): Mongoose has no `maxPoolSize`, `serverSelectionTimeoutMS` or `socketTimeoutMS`; ioredis has no `commandTimeout`, `maxRetriesPerRequest` or bounded `retryStrategy` (so a Redis blip queues commands forever and grows memory); **Elasticsearch has no `requestTimeout`** — which means a *slow* ES never trips the Mongo fallback that `search()` carefully implements, the request simply hangs.
- Global logging interceptor with no environment gating (`common.module.ts:42-45`).
- No compression middleware; no `Cache-Control`.
- Throttle state in memory rather than Redis.
- Runs single-process in production (`Dockerfile`: `CMD ["node","dist/main"]`).
- Measured under `NODE_ENV=development` (the committed value in `backend/.env`).

### Practices that are already sound
Worth not "fixing": SEO/sitemap/prerender caching with explicit TTLs and `.lean()` throughout; category tree cached with correct invalidation on every mutation; `engagement.service.ts` deliberately batched with `Promise.all` and `$match` before `$group`; pagination and sort inputs hard-capped and allow-listed (`asPageSize`, `asSortField`, `@Max(100)`); all regex inputs escaped; `listings.getOwnViewCounts` uses a single `$facet` instead of seven counts; `ShortVideoSchema`, `AdCreativeSchema` and `AdEventSchema` indexes match their queries exactly; `search()` parallelises results and facets; throttling covers all routes, not just auth. All cache TTLs are sensible.

---

## 4. Recommended order of work

1. **Gate the request logger** — sample it, drop to `debug`, or disable per-request logging in production, and use an async transport. Free 30–75% throughput. (`logging.interceptor.ts`, `common.module.ts:42-45`)
2. **Run multiple processes** — Node cluster, or N replicas behind the load balancer. Unlocks the 9 idle cores. If you do this, move throttle storage to Redis first, or per-instance limits multiply.
3. **Add `compression`** with a 1 KB threshold. Cuts projected egress 81%.
4. **Drop `deletedAt: {$exists:false}` from filters that already constrain `status`** — soft-delete sets both fields atomically, so it is redundant there. Restores the covered count: 37 ms → 12 ms per page request. For queries that genuinely span statuses (e.g. a seller's own listings), keep the predicate and add a `{status:1, deletedAt:1}` compound index instead.
5. **Add indexes:** `price.amount`, `{sellerId, status}`, `featuredUntil`, `condition`. Eliminates the 2001:1 in-memory sort.
6. **Cache `getInheritedAttributes`** or derive the chain from the already-cached tree, and add `.lean()` to `findById`. Removes 6 round trips per request.
7. **Set client timeouts and pool sizes** (`app.module.ts:46-76`) — especially ES `requestTimeout`, without which the Mongo fallback cannot protect you.
8. **Fix the shorts feed:** filter the count, run it in parallel, add `.lean()`, drop the three populates.
9. **Add `Cache-Control`** to public GETs so the existing ETags can actually be used by browsers and CDNs.
10. **Fix `Retry-After`** to report the real remaining window.

---

## 5. Measurement caveats

- **Localhost only.** No real network latency or bandwidth limit, which is exactly why the missing compression looks free here and will not in production.
- **The IDE competed for CPU.** Kiro's renderer/Electron consumed 74%/45% during part of the session, and Docker on macOS runs in a VM, so DB round-trip latency inflated. This invalidated a first volume comparison (every endpoint dropped ~35%, including ones untouched by data volume). Mitigated by re-running with control endpoints and by relying on `explain()` plans, which are structural.
- **First volume load run was contaminated** by backlog bleeding across stages, producing a false "0 rps" for `ads/serve`. Fixed by adding an explicit drain between stages; the corrected run is the one reported.
- **Shared infrastructure.** The developer's instance on :3000 uses the same Mongo/Redis/ES. Measured idle noise floor was negligible (0 Mongo queries, 0 ES queries, ~3 heartbeat commands per 15 s).
- **`NODE_ENV=development`**, so production may differ (though the logging interceptor is not environment-gated, so its cost applies either way).
- **Soak was 8 minutes**, not hours. Adequate to rule out fast leaks and show a stable plateau; a multi-hour run would be needed for slow leaks or fragmentation.
- Write paths (listing creation, uploads, auth, WebSocket messaging) were **not** load-tested — this covers public read paths.

---

## 6. Reproducing

```bash
cd perf
npm install

# start the test instance (never touches :3000)
LOGNAME_SUFFIX=run ./restart-backend.sh              # throttle raised for measurement
LOG_DEST=discard ./restart-backend.sh                # stdout to /dev/null (logging A/B)

node smoke.js                     # verify all scenarios return 2xx
node throttle-test.js             # needs shipped throttle defaults
node throttle-window-test.js
node run-profile.js baseline
node run-profile.js load
node run-profile.js stress search
node run-profile.js spike search
node run-profile.js soak search
node measure-backend-io.js        # per-request Mongo/ES/Redis ops
node network-test.js              # compression, payloads, keep-alive
node ab-logging.js <label>        # run once per stdout destination
node inspect.js results/<f>.json  # error composition + infra resources

# query plans
docker cp explain.mongo.js personal-mongodb-1:/tmp/explain.js
docker exec personal-mongodb-1 mongosh marketplace --quiet --file /tmp/explain.js
docker cp explain2.mongo.js personal-mongodb-1:/tmp/explain2.js
docker exec personal-mongodb-1 mongosh marketplace --quiet --file /tmp/explain2.js
```

### Seeded data — rollback

50,000 listings tagged `perfSeed: true` are currently in the database. To remove them (the change stream propagates deletions out of Elasticsearch):

```bash
docker exec personal-mongodb-1 mongosh marketplace --quiet --file /tmp/cleanup-volume.js
```

---

# Part 2 — Fixes applied

Four fixes were implemented and verified. Full backend suite passes: **79 suites, 1213 tests**.

## Changes

| # | Change | Files |
|---|---|---|
| 1 | Per-request logging no longer emitted for fast successful requests. SLOW warnings kept; full logging available behind `HTTP_LOG_ALL=true`. Log line is now only built when it will actually be written. | `common/interceptors/logging.interceptor.ts` |
| 2 | `compression` middleware added, 1KB threshold, gzip level 4, `x-no-compression` escape hatch. | `main.ts`, `package.json` |
| 3 | Redundant `deletedAt: {$exists:false}` removed from filters that already pin `status`. **Kept** on the owner branch, which pins no status. | `listings/listings.service.ts` (`findAll`, `getFeaturedAds`), `search/search.service.ts` (`mongoFallbackSearch`) |
| 4 | Three indexes added: `{status,isFeatured,price.amount}` ascending and descending, plus `{sellerId,status}`. | `listings/schemas/product-listing.schema.ts` |

## Verification — deterministic

These are query-plan facts and exact byte counts, unaffected by host load.

**Fix 3 — pagination count is now covered:**

| | plan | docs examined | median |
|---|---|---|---|
| before | COUNT←FETCH←IXSCAN | 40,035 | 36 ms |
| **after** | **COUNT←COUNT_SCAN** | **0** | **11 ms** |

**Fix 4 — price sort is now index-served:**

| | plan | docs examined | returned | median |
|---|---|---|---|---|
| before | **SORT**←FETCH←IXSCAN | 40,035 | 20 (2001:1) | 45 ms |
| **after** ASC | LIMIT←FETCH←IXSCAN via `status_1_isFeatured_-1_price.amount_1` | **20** | 20 (1:1) | **2 ms** |
| **after** DESC | LIMIT←FETCH←IXSCAN via `status_1_isFeatured_-1_price.amount_-1` | **20** | 20 (1:1) | **0 ms** |

`{sellerId, status}` now resolves through `sellerId_1_status_1`: 9,969 examined for 9,969 returned, down from 12,527.

**Fix 2 — compression, measured on the wire:**

| endpoint | raw | gzipped | saved |
|---|---|---|---|
| `/api/categories` | 78,560 | 12,617 | 83.9% |
| `/api/search` | 25,147 | 2,910 | 88.4% |
| `/api/listings` | 25,058 | ~2,900 | ~88% |
| `/api/shorts/feed` | 10,089 | 2,354 | 76.7% |
| `/api/seo/home` | 1,305 | 650 | 50.2% |
| `/api/location/provinces` (969 B) | 969 | not compressed | — |
| `/api/ads/serve` (580 B) | 580 | not compressed | — |

Sub-1KB responses are correctly left alone, so the 96-byte payload that gzip would have *inflated* to 109 bytes is untouched.

Level 4 was chosen from a payload-specific microbenchmark: on the 78KB category tree, level 6 costs 0.666 ms/response versus level 4's 0.414 ms — 61% more CPU for 5.1% smaller output. On sub-2KB payloads the two levels differ by a few bytes and a few microseconds. Given the process is CPU-bound on one core, the cheaper level is the better trade here.

**Fix 1 — logging:** 3,000 requests produced **0 new log lines** (previously ~1 per request). Log file 59 KB, against 299 MB / 1,601,083 lines for a comparable pre-fix session.

## Verification — end-to-end throughput: inconclusive on this host

The one honest caveat. Repeated 12s samples at 50 connections, with hard draining between every case, still swung wildly on unchanged configurations:

- `locationProvinces`: [2638, **173**, 3229] rps
- `categoryTree`: [1315, 1052, **15**] rps
- `seoHome` compressed measured *faster* than the same endpoint with compression bypassed — physically impossible, so noise clearly dominates.

Cause is host interference (the IDE consuming 45–75% CPU, and Docker's macOS VM inflating DB round trips), not the application. **No end-to-end throughput delta from these fixes should be quoted from this machine.** The structural verifications above are the reliable evidence, and the earlier logger A/B (+30–75%, measured back-to-back while the host was quiet) is the most trustworthy throughput figure.

The single clear end-to-end signal that did survive: `/api/listings` moved from ~105 rps pre-fix to 335–413 rps across every post-fix run, which is consistent with the covered-count fix and far larger than the observed noise band.

To measure properly, re-run on an idle machine or a CI runner:

```bash
cd perf && node final-bench.js
```

## Not done — still open from the recommendation list

5. Run multiple processes (unlocks 9 idle cores) — **move throttle storage to Redis first**, or per-instance limits multiply.
6. Throttle storage → Redis.
7. Client timeouts and pool sizes (`app.module.ts:46-76`), especially ES `requestTimeout`.
8. Shorts feed: filter the count, parallelise, `.lean()`, drop the three populates.
9. `Cache-Control` on public GETs so the existing ETags are usable.
10. Fix `Retry-After` to report the real remaining window.

Also noted but out of scope: `ai/recommendation.service.ts` still carries the same redundant `deletedAt` predicate (its spec asserts it at `recommendation.service.spec.ts:187`), and `/api/categories` returns a 78KB payload that is Redis-cached but recompressed on every request — caching the compressed bytes would remove that cost entirely.
