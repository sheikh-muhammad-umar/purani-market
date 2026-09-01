/**
 * Back-fills `user.baseListingLimit`.
 *
 * `listingLimit` used to be one number that three writers adjusted: activation
 * added slots to it, expiry subtracted a snapshot, and an admin overwrote it.
 * It is now derived — `baseListingLimit` plus the slots of every active package —
 * so each existing user needs their base recovered from the current value.
 *
 * Base = current listingLimit − slots from packages still active, floored at the
 * configured default so nobody ends up below the standard allowance. For a user
 * with no packages that is simply their current limit, which preserves any
 * goodwill grant an admin had made.
 *
 * Safe to run repeatedly: users that already have a base are skipped. Pass
 * --dry-run to see what it would do without writing.
 *
 * Run: node scripts/backfill-base-listing-limit.js [--dry-run]
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const DEFAULT_LISTING_LIMIT = parseInt(
  process.env.DEFAULT_LISTING_LIMIT || '10',
  10,
);
const DRY_RUN = process.argv.includes('--dry-run');

/** Slot quantity a purchase granted, in either storage shape. */
function slotsGranted(purchase) {
  if (Array.isArray(purchase.entitlements) && purchase.entitlements.length) {
    const row = purchase.entitlements.find((e) => e.kind === 'ad_slots');
    return row ? row.quantity : 0;
  }
  return purchase.type === 'ad_slots' ? purchase.quantity || 0 : 0;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const db = client.db();
    const users = db.collection('users');
    const purchases = db.collection('package_purchases');
    const now = new Date();

    const pending = await users
      .find(
        { baseListingLimit: { $exists: false } },
        { projection: { listingLimit: 1, activeListingCount: 1 } },
      )
      .toArray();

    console.log(`Users without a base: ${pending.length}`);
    if (pending.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    let written = 0;
    let overLimit = 0;

    for (const user of pending) {
      const active = await purchases
        .find({
          sellerId: user._id,
          paymentStatus: 'completed',
          expiresAt: { $gt: now },
          $or: [
            { type: 'ad_slots' },
            { entitlements: { $elemMatch: { kind: 'ad_slots' } } },
          ],
        })
        .toArray();

      const granted = active.reduce((sum, p) => sum + slotsGranted(p), 0);
      const current = user.listingLimit ?? DEFAULT_LISTING_LIMIT;
      const base = Math.max(DEFAULT_LISTING_LIMIT, current - granted);
      const effective = base + granted;

      // Worth surfacing: a seller already over their limit stays over it. Nothing
      // deactivates listings when a limit drops, so this only reports it.
      if ((user.activeListingCount ?? 0) > effective) {
        overLimit++;
      }

      if (DRY_RUN) {
        console.log(
          `  ${user._id}: limit ${current} − ${granted} granted → base ${base}, effective ${effective}`,
        );
        continue;
      }

      await users.updateOne(
        { _id: user._id },
        { $set: { baseListingLimit: base, listingLimit: effective } },
      );
      written++;
    }

    if (DRY_RUN) {
      console.log(
        `\nDry run — nothing written. ${pending.length} would change.`,
      );
    } else {
      console.log(`\nBack-filled ${written} user(s).`);
    }
    if (overLimit > 0) {
      console.log(
        `${overLimit} user(s) hold more active listings than their limit. ` +
          'Existing ads keep running; they simply cannot post more until some expire.',
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
