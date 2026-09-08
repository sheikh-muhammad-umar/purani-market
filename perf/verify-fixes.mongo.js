/**
 * Confirms fixes 3 and 4 changed the query PLANS, not just the wall clock.
 *
 * Plan shape is deterministic, so unlike latency it is not affected by whatever
 * else the host is doing.
 */

function plan(label, csrOrExplain, expect) {
  // find() gives a cursor that still needs .explain(); the
  // explain().count() form has already produced the explain document.
  const ex =
    csrOrExplain && typeof csrOrExplain.explain === 'function'
      ? csrOrExplain.explain('executionStats')
      : csrOrExplain;
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

  const hasSort = stages.indexOf('SORT') !== -1;
  const hasFetch = stages.indexOf('FETCH') !== -1;
  print('\n### ' + label);
  print('  stages       : ' + stages.join(' <- '));
  print('  index        : ' + (idx || 'NONE'));
  print('  docsExamined : ' + st.totalDocsExamined);
  print('  nReturned    : ' + st.nReturned);
  print('  execTimeMs   : ' + st.executionTimeMillis);
  print('  in-memory sort: ' + (hasSort ? 'YES' : 'no'));
  if (expect === 'no-sort') {
    print(hasSort ? '  RESULT: STILL SORTING IN MEMORY' : '  RESULT: PASS - sort served by index');
  }
  if (expect === 'covered') {
    print(hasFetch ? '  RESULT: STILL FETCHING DOCUMENTS' : '  RESULT: PASS - covered by index, 0 document reads');
  }
  return { stages: stages, docsExamined: st.totalDocsExamined, ms: st.executionTimeMillis };
}

print('=== FIX 3: pagination count is now covered ===');
print('the public listing feed no longer sends deletedAt, so the count is index-only');

plan(
  'AFTER  count({status:active})   <- what the app now runs',
  db.product_listings.explain('executionStats').count({ status: 'active' }),
  'covered',
);

plan(
  'BEFORE count({status:active, deletedAt:$exists:false})   <- for comparison',
  db.product_listings
    .explain('executionStats')
    .count({ status: 'active', deletedAt: { $exists: false } }),
  'covered',
);

print('\n\n=== FIX 4: price sort is now index-served ===');

plan(
  'AFTER  price ASC  sort({isFeatured:-1,"price.amount":1}) on {status:active}',
  db.product_listings
    .find({ status: 'active' })
    .sort({ isFeatured: -1, 'price.amount': 1 })
    .limit(20),
  'no-sort',
);

plan(
  'AFTER  price DESC sort({isFeatured:-1,"price.amount":-1}) on {status:active}',
  db.product_listings
    .find({ status: 'active' })
    .sort({ isFeatured: -1, 'price.amount': -1 })
    .limit(20),
  'no-sort',
);

plan(
  'BEFORE price ASC with the old deletedAt predicate   <- for comparison',
  db.product_listings
    .find({ status: 'active', deletedAt: { $exists: false } })
    .sort({ isFeatured: -1, 'price.amount': 1 })
    .limit(20),
  'no-sort',
);

print('\n\n=== FIX 4: seller + status ===');
const seller = db.product_listings.findOne({}, { sellerId: 1 }).sellerId;
plan(
  'AFTER  {sellerId, status:active}',
  db.product_listings.find({ sellerId: seller, status: 'active' }),
  null,
);

print('\n\n=== wall-clock, 7 runs each ===');
function timeIt(label, fn) {
  const ts = [];
  for (let i = 0; i < 7; i++) {
    const t0 = Date.now();
    fn();
    ts.push(Date.now() - t0);
  }
  ts.sort(function (a, b) {
    return a - b;
  });
  print('  ' + label.padEnd(56) + ' median=' + ts[3] + 'ms  min=' + ts[0] + '  max=' + ts[6]);
}

timeIt('AFTER  count({status:active})', function () {
  db.product_listings.countDocuments({ status: 'active' });
});
timeIt('BEFORE count({status, deletedAt})', function () {
  db.product_listings.countDocuments({ status: 'active', deletedAt: { $exists: false } });
});
timeIt('AFTER  price-sort page', function () {
  db.product_listings.find({ status: 'active' }).sort({ isFeatured: -1, 'price.amount': 1 }).limit(20).toArray();
});
timeIt('BEFORE price-sort page (with deletedAt)', function () {
  db.product_listings.find({ status: 'active', deletedAt: { $exists: false } }).sort({ isFeatured: -1, 'price.amount': 1 }).limit(20).toArray();
});
timeIt('reference: newest-sort page (was already indexed)', function () {
  db.product_listings.find({ status: 'active' }).sort({ isFeatured: -1, createdAt: -1 }).limit(20).toArray();
});
