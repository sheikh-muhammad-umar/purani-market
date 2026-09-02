/**
 * Back-fills `shortsExpiryNotifiedAt` on shorts purchases whose expiry was
 * already handled.
 *
 * The shorts expiry sweep used to record "already processed" by stamping
 * `remainingQuantity: -1`. It now uses its own field, because on a bundle that
 * counter belongs to the ad-slot sweep — both run at 1am, so whichever went first
 * stamped `-1` and the other skipped the document, which is why a bundle's shorts
 * credit expired without a word.
 *
 * Without this back-fill the new field would be null on every purchase already
 * dealt with under the old convention, and the next run would notify all of them
 * again about packages that expired long ago.
 *
 * Only touches dedicated shorts purchases carrying the old `-1` marker. Bundles
 * are deliberately left alone: `-1` there was written by the ad-slot sweep and
 * says nothing about whether the seller was ever told about their shorts, so they
 * are allowed one correct notification.
 *
 * Safe to run repeatedly: rows that already have the field are skipped. Pass
 * --dry-run to see what it would do without writing.
 *
 * Run: node scripts/backfill-shorts-expiry-notified.js [--dry-run]
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const purchases = client.db().collection('package_purchases');

    const filter = {
      purchaseType: 'shorts',
      remainingQuantity: -1,
      $or: [
        { shortsExpiryNotifiedAt: null },
        { shortsExpiryNotifiedAt: { $exists: false } },
      ],
    };

    const stale = await purchases.find(filter).toArray();

    if (stale.length === 0) {
      console.log(
        'Nothing to back-fill — no shorts purchases carry the old marker.',
      );
      return;
    }

    console.log(
      `${stale.length} shorts purchase(s) already processed under the old marker.`,
    );

    if (DRY_RUN) {
      for (const purchase of stale) {
        console.log(
          `  would stamp ${purchase._id.toString()} (expired ${
            purchase.expiresAt ? purchase.expiresAt.toISOString() : 'unknown'
          })`,
        );
      }
      console.log('\nDry run — nothing written.');
      return;
    }

    // Stamped with the purchase's own expiry where known, so the record reflects
    // roughly when the seller would have been told, rather than today.
    let updated = 0;
    for (const purchase of stale) {
      const notifiedAt = purchase.expiresAt ?? new Date();
      const result = await purchases.updateOne(
        { _id: purchase._id, ...{ purchaseType: 'shorts' } },
        { $set: { shortsExpiryNotifiedAt: notifiedAt } },
      );
      updated += result.modifiedCount;
    }

    console.log(`Stamped ${updated} shorts purchase(s) as already notified.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
