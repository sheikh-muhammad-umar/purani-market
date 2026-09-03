/**
 * Migrate reviews from listing-keyed to seller-keyed uniqueness.
 *
 * Reviews are about a seller, not a listing. Historically the unique key was
 * {reviewerId, productListingId}, which allowed one buyer to review the same
 * seller once per listing. The new rule is one review per buyer per seller.
 *
 * This script:
 *   1. Drops the old {reviewerId, productListingId} unique index.
 *   2. De-duplicates: where a buyer has multiple reviews for the same seller,
 *      keeps the most recent and removes the rest (so the new unique index can
 *      be built).
 *   3. Creates the new {reviewerId, sellerId} unique index.
 *
 * Safe to run more than once. Run before/at deploy of the seller-keyed reviews.
 *
 * Usage:  node scripts/migrate-reviews-to-seller.js
 */
const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const OLD_INDEX = 'reviewerId_1_productListingId_1';
const NEW_INDEX = 'reviewerId_1_sellerId_1';

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const reviews = db.collection('reviews');

    // 1. Drop the old unique index if it exists.
    const indexes = await reviews.indexes();
    if (indexes.some((i) => i.name === OLD_INDEX)) {
      await reviews.dropIndex(OLD_INDEX);
      console.log(`Dropped old index ${OLD_INDEX}.`);
    } else {
      console.log(`Old index ${OLD_INDEX} not present — skipping drop.`);
    }

    // 2. De-duplicate by {reviewerId, sellerId}, keeping the newest.
    const dupes = await reviews
      .aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { reviewerId: '$reviewerId', sellerId: '$sellerId' },
            ids: { $push: '$_id' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    let removed = 0;
    for (const group of dupes) {
      // ids are newest-first (sorted above); keep [0], drop the rest.
      const toRemove = group.ids.slice(1);
      if (toRemove.length > 0) {
        const res = await reviews.deleteMany({ _id: { $in: toRemove } });
        removed += res.deletedCount;
      }
    }
    if (removed > 0) {
      console.log(
        `Removed ${removed} duplicate review(s) (kept the most recent per buyer+seller).`,
      );
    } else {
      console.log('No duplicate reviews to remove.');
    }

    // 3. Create the new unique index.
    await reviews.createIndex({ reviewerId: 1, sellerId: 1 }, { unique: true });
    console.log(`Ensured new unique index ${NEW_INDEX}.`);

    console.log('\nDone. Reviews are now seller-keyed.');
  } finally {
    await client.close();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
