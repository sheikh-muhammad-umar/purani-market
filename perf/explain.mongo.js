/**
 * Query plan analysis against the seeded dataset.
 *
 * explain(executionStats) reports index usage, documents examined and in-memory
 * sorts. These are structural facts about the query plan, so unlike wall-clock
 * latency they are unaffected by host CPU contention -- which is what makes this
 * the reliable volume-test evidence on a laptop running an IDE.
 *
 * The queries mirror what the services actually build (verified against
 * listings.service.ts, search.service.ts and shorts.service.ts).
 */

function analyse(label, csr, note) {
  let ex;
  try {
    ex = csr.explain('executionStats');
  } catch (e) {
    print('\n### ' + label + '\n  EXPLAIN FAILED: ' + e.message);
    return;
  }
  const st = ex.executionStats;
  const w = ex.queryPlanner.winningPlan;

  // Walk the plan tree collecting stage names and any sort/index detail.
  const stages = [];
  let indexName = null;
  let sortInMemory = null;
  let sortMemBytes = null;
  (function walk(s) {
    if (!s || typeof s !== 'object') return;
    if (s.stage) stages.push(s.stage);
    if (s.indexName && !indexName) indexName = s.indexName;
    if (s.stage === 'SORT') {
      sortInMemory = true;
      if (s.memUsage != null) sortMemBytes = s.memUsage;
    }
    for (const k of ['inputStage', 'queryPlan', 'child']) if (s[k]) walk(s[k]);
    if (Array.isArray(s.inputStages)) s.inputStages.forEach(walk);
    if (Array.isArray(s.shards)) s.shards.forEach((x) => walk(x.winningPlan));
  })(w);

  const examined = st.totalDocsExamined;
  const keys = st.totalKeysExamined;
  const returned = st.nReturned;
  const ratio = returned > 0 ? (examined / returned).toFixed(1) : examined;

  print('\n### ' + label);
  if (note) print('  ' + note);
  print('  stages          : ' + stages.join(' <- '));
  print('  index used      : ' + (indexName || 'NONE (collection scan)'));
  print('  docsExamined    : ' + examined);
  print('  keysExamined    : ' + keys);
  print('  nReturned       : ' + returned);
  print('  examined/returned: ' + ratio + (examined / Math.max(returned, 1) > 50 ? '   <-- WASTEFUL' : ''));
  print('  execTimeMs      : ' + st.executionTimeMillis);
  if (stages.indexOf('COLLSCAN') !== -1) print('  *** COLLSCAN: full collection scan ***');
  if (sortInMemory) {
    print('  *** IN-MEMORY SORT' +
      (sortMemBytes != null ? ' (' + (sortMemBytes / 1048576).toFixed(2) + ' MB of the 32MB limit)' : '') +
      ' ***');
  }
}

const total = db.product_listings.countDocuments({});
const active = db.product_listings.countDocuments({ status: 'active' });
print('=== product_listings: ' + total + ' docs, ' + active + ' active ===');
print('=== declared indexes ===');
db.product_listings.getIndexes().forEach((i) => print('  ' + i.name + '  ' + JSON.stringify(i.key)));

// ---- 1. The public listing feed (listings.service.ts:150,214-232) ----
analyse(
  '1. listings feed: find({status:active, deletedAt:$exists:false}).sort({isFeatured:-1,createdAt:-1}).limit(20)',
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false } })
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(20),
  'deletedAt has no index; sort key {isFeatured:-1,createdAt:-1} does exist',
);

// ---- 2. The pagination count that runs alongside it (listings.service.ts:229) ----
analyse(
  '2. pagination count: countDocuments({status:active, deletedAt:$exists:false})',
  db.product_listings.find({ status: 'active', deletedAt: { $exists: false } }),
  'this is the count query paid on EVERY page request',
);

// ---- 3. Price sort -- the missing index (search.service.ts:637-641) ----
analyse(
  '3. price sort: find({status:active}).sort({isFeatured:-1,"price.amount":1}).limit(20)',
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false } })
    .sort({ isFeatured: -1, 'price.amount': 1 })
    .limit(20),
  'no index covers {isFeatured, price.amount}',
);

// ---- 4. Deep pagination ----
analyse(
  '4. deep page: skip(980).limit(20) sorted by newest',
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false } })
    .sort({ isFeatured: -1, createdAt: -1 })
    .skip(980)
    .limit(20),
  'skip still walks every skipped document',
);

// ---- 5. The 7-field unanchored regex fallback (search.service.ts:524-533) ----
const safeQ = 'phone';
analyse(
  '5. Mongo regex fallback: 7-field unanchored case-insensitive $or',
  db.product_listings
    .find({
      status: 'active',
      deletedAt: { $exists: false },
      $or: [
        { title: { $regex: safeQ, $options: 'i' } },
        { description: { $regex: safeQ, $options: 'i' } },
        { brandName: { $regex: safeQ, $options: 'i' } },
        { vehicleBrandName: { $regex: safeQ, $options: 'i' } },
        { modelName: { $regex: safeQ, $options: 'i' } },
        { variantName: { $regex: safeQ, $options: 'i' } },
        { selectedFeatures: { $regex: safeQ, $options: 'i' } },
      ],
    })
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(20),
  'triggered when ES returns 0 hits, when ANY orphaned ES doc is seen, or on ES error',
);

// ---- 6. Price range filter (search.service.ts:565-569) ----
analyse(
  '6. price range: price.amount between 100000 and 2000000',
  db.product_listings
    .find({
      status: 'active',
      deletedAt: { $exists: false },
      'price.amount': { $gte: 100000, $lte: 2000000 },
    })
    .limit(20),
  'price.amount has no index',
);

// ---- 7. condition filter (search.service.ts:544) ----
analyse(
  '7. condition filter: condition=used',
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false }, condition: 'used' })
    .limit(20),
  'condition has no index',
);

// ---- 8. seller + status (seo.service.ts:533, listings.service.ts:939) ----
const someSeller = db.product_listings.findOne({}, { sellerId: 1 }).sellerId;
analyse(
  '8. seller listings: {sellerId, status:active}',
  db.product_listings.find({ sellerId: someSeller, status: 'active' }),
  'only sellerId alone is indexed; no {sellerId,status} compound',
);

// ---- 9. featured ads (listings.service.ts:294-298) ----
analyse(
  '9. featured: {isFeatured:true, featuredUntil:{$gt:now}}',
  db.product_listings
    .find({
      status: 'active',
      deletedAt: { $exists: false },
      isFeatured: true,
      featuredUntil: { $gt: new Date() },
    })
    .limit(20),
  'featuredUntil has no index',
);

// ---- 10. shorts public feed count (shorts.service.ts:448-450) ----
analyse(
  '10. shorts feed count: countDocuments({status:active}) [unfiltered]',
  db.short_videos.find({ status: 'active' }),
  'ignores every caller filter, so the returned total is wrong as well as costly',
);

print('\n=== collection scan cost reference ===');
print('a COLLSCAN over ' + total + ' listings examines ' + total + ' docs to return a 20-doc page');
