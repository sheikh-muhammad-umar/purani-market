/**
 * Follow-ups to explain.mongo.js.
 *
 * 1. Isolates the cost the `deletedAt: {$exists:false}` predicate adds, by
 *    comparing the same count with and without it. A count that needs no
 *    document fetch is served from the index alone (COUNT_SCAN); adding an
 *    unindexed predicate forces a FETCH of every candidate.
 * 2. Explains the regex COUNT rather than the regex find(). The find() stops at
 *    limit 20, but the count that runs beside it must evaluate every candidate
 *    against all seven regexes, so it is the expensive half.
 */

function plan(label, run, note) {
  let ex;
  try {
    ex = run();
  } catch (e) {
    print('\n### ' + label + '\n  FAILED: ' + e.message);
    return;
  }
  const st = ex.executionStats;
  const stages = [];
  let idx = null;
  (function walk(s) {
    if (!s || typeof s !== 'object') return;
    if (s.stage) stages.push(s.stage);
    if (s.indexName && !idx) idx = s.indexName;
    for (const k of ['inputStage', 'queryPlan']) if (s[k]) walk(s[k]);
    if (Array.isArray(s.inputStages)) s.inputStages.forEach(walk);
  })(ex.queryPlanner.winningPlan);

  print('\n### ' + label);
  if (note) print('  ' + note);
  print('  stages       : ' + stages.join(' <- '));
  print('  index        : ' + (idx || 'NONE'));
  print('  docsExamined : ' + st.totalDocsExamined);
  print('  keysExamined : ' + st.totalKeysExamined);
  print('  execTimeMs   : ' + st.executionTimeMillis);
  if (stages.indexOf('FETCH') === -1 && stages.indexOf('COUNT_SCAN') !== -1) {
    print('  -> COVERED COUNT: served from index, no document reads');
  }
}

print('=== isolating the deletedAt predicate cost ===');

plan(
  'A. count({status:active}) only',
  () => db.product_listings.explain('executionStats').count({ status: 'active' }),
  'no unindexed predicate',
);

plan(
  'B. count({status:active, deletedAt:{$exists:false}})  <- what the app runs',
  () =>
    db.product_listings
      .explain('executionStats')
      .count({ status: 'active', deletedAt: { $exists: false } }),
  'adds the unindexed deletedAt check',
);

print('\n=== the regex fallback COUNT (the expensive half) ===');

const safeQ = 'phone';
const regexFilter = {
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
};

plan(
  'C. countDocuments(7-field regex filter)  <- runs on every fallback search',
  () => db.product_listings.explain('executionStats').count(regexFilter),
  'must evaluate all seven regexes against every candidate document',
);

// A term that matches nothing: no early exit is possible, worst case.
const missFilter = JSON.parse(JSON.stringify(regexFilter).replace(/phone/g, 'zzzznotfoundzzzz'));
plan(
  'D. regex find() for a term that matches NOTHING (worst case)',
  () =>
    db.product_listings
      .find(missFilter)
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(20)
      .explain('executionStats'),
  'limit 20 cannot short-circuit because nothing matches',
);

print('\n=== wall-clock timing, 5 runs each (server-side, excludes app+network) ===');
function timeIt(label, fn, runs) {
  runs = runs || 5;
  const ts = [];
  for (let i = 0; i < runs; i++) {
    const t0 = Date.now();
    fn();
    ts.push(Date.now() - t0);
  }
  ts.sort((a, b) => a - b);
  print('  ' + label.padEnd(52) + ' median=' + ts[Math.floor(runs / 2)] + 'ms  min=' + ts[0] + '  max=' + ts[runs - 1]);
}

timeIt('count({status:active})', () => db.product_listings.countDocuments({ status: 'active' }));
timeIt('count({status:active, deletedAt:$exists:false})', () =>
  db.product_listings.countDocuments({ status: 'active', deletedAt: { $exists: false } }),
);
timeIt('countDocuments(7-field regex)', () => db.product_listings.countDocuments(regexFilter));
timeIt('price-sort page (in-memory sort)', () =>
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false } })
    .sort({ isFeatured: -1, 'price.amount': 1 })
    .limit(20)
    .toArray(),
);
timeIt('newest-sort page (indexed sort)', () =>
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false } })
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(20)
    .toArray(),
);
