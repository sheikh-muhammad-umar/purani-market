/**
 * Reports ad packages that no longer satisfy the rules the API now enforces.
 *
 * Read-only on purpose. Every finding here is a pricing decision rather than a
 * mechanical fix: an all-in-one missing shorts could be corrected by adding shorts
 * or by demoting it to a single-purpose package, and only whoever set its price can
 * say which. Writing a guess would change what sellers are being sold.
 *
 * Two rules arrived after these documents were written, so packages created earlier
 * may not meet them:
 *
 *  - An all-in-one grants featured ads, ad slots and shorts. The old admin form
 *    accepted any two kinds, so partial bundles could be saved, and a bundle with no
 *    entitlement list at all grants nothing while still being sellable.
 *  - Terms are per type: all-in-one packages run to 90 days, single-purpose ad
 *    packages do not.
 *
 * Purchase counts are included because they decide what can be done next. A flagged
 * package nobody bought can be deleted outright; one with purchases has to be
 * deactivated so paid orders still resolve.
 *
 * Usage: node scripts/audit-bundle-packages.js
 *        MONGODB_URI=... node scripts/audit-bundle-packages.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

/** Kinds an all-in-one has to grant. Mirrors BUNDLE_KINDS in the API. */
const BUNDLE_KINDS = ['featured_ads', 'ad_slots', 'shorts'];

const durations = (value, fallback) =>
  (value || fallback)
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d > 0);

const BUNDLE_DURATIONS = durations(
  process.env.BUNDLE_PACKAGE_DURATIONS,
  '7,15,30,60,90',
);
const AD_DURATIONS = durations(process.env.PACKAGE_DURATIONS, '7,15,30');

/** Kinds this package actually grants a non-zero amount of. */
function grantedKinds(pkg) {
  return (pkg.entitlements || [])
    .filter((e) => e && e.quantity > 0)
    .map((e) => e.kind);
}

async function audit() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    const packages = await db.collection('ad_packages').find({}).toArray();
    if (packages.length === 0) {
      console.log('No ad packages found. Nothing to audit.');
      return;
    }

    // One grouped count rather than a query per package, so the audit stays cheap
    // on a catalogue that has grown.
    const purchaseRows = await db
      .collection('package_purchases')
      .aggregate([{ $group: { _id: '$packageId', count: { $sum: 1 } } }])
      .toArray();
    const purchasesByPackage = new Map(
      purchaseRows
        .filter((r) => r._id)
        .map((r) => [r._id.toString(), r.count]),
    );

    const bundles = packages.filter((p) => p.type === 'bundle');
    const findings = [];

    for (const pkg of packages) {
      const problems = [];
      const isBundle = pkg.type === 'bundle';

      if (isBundle) {
        const granted = grantedKinds(pkg);
        if (granted.length === 0) {
          // Worse than incomplete: sellable, and delivers nothing.
          problems.push('grants nothing (no entitlements recorded)');
        } else {
          const missing = BUNDLE_KINDS.filter((k) => !granted.includes(k));
          if (missing.length > 0) {
            problems.push(`missing ${missing.join(' and ')}`);
          }
        }
      }

      const allowed = isBundle ? BUNDLE_DURATIONS : AD_DURATIONS;
      if (!allowed.includes(pkg.duration)) {
        problems.push(
          `${pkg.duration}-day term is not sold for ${pkg.type} (allowed: ${allowed.join(', ')})`,
        );
      }

      if (problems.length > 0) {
        findings.push({
          pkg,
          problems,
          purchases: purchasesByPackage.get(pkg._id.toString()) || 0,
        });
      }
    }

    console.log('Ad package audit');
    console.log('================');
    console.log(`Packages:      ${packages.length}`);
    console.log(`All-in-one:    ${bundles.length}`);
    console.log(`Needing review: ${findings.length}`);
    console.log('');

    if (findings.length === 0) {
      console.log('Every package satisfies the current rules. Nothing to do.');
      return;
    }

    for (const { pkg, problems, purchases } of findings) {
      const state = pkg.isActive ? 'ACTIVE' : 'inactive';
      console.log(`- ${pkg.name}  [${pkg.type}, ${pkg.duration}d, ${state}]`);
      console.log(`    _id:       ${pkg._id.toString()}`);
      console.log(`    grants:    ${grantedKinds(pkg).join(', ') || '(nothing)'}`);
      console.log(`    purchases: ${purchases}`);
      for (const problem of problems) {
        console.log(`    problem:   ${problem}`);
      }
      console.log(
        purchases === 0
          ? '    options:   fix the entitlements, or delete it (no purchases to preserve)'
          : '    options:   fix the entitlements, or deactivate it (purchases must keep resolving)',
      );
      console.log('');
    }

    const active = findings.filter((f) => f.pkg.isActive);
    if (active.length > 0) {
      console.log(
        `${active.length} of these are still on sale. Those are the ones to deal with first.`,
      );
    }
  } finally {
    await client.close();
  }
}

audit().catch((err) => {
  console.error(`Audit failed: ${err.message}`);
  process.exitCode = 1;
});
