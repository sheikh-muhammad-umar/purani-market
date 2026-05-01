/**
 * Backfill sellerVerified on all product listings.
 *
 * A seller is "verified" when emailVerified, phoneVerified, AND idVerified
 * are all true on their User document.
 *
 * Usage: node scripts/backfill-seller-verified.js
 */
const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/marketplace?replicaSet=rs0&directConnection=true';

async function backfill() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    // Build a set of verified seller IDs
    const verifiedUsers = await db
      .collection('users')
      .find(
        { emailVerified: true, phoneVerified: true, idVerified: true },
        { projection: { _id: 1 } },
      )
      .toArray();

    const verifiedIds = new Set(verifiedUsers.map((u) => u._id.toString()));
    console.log(`Found ${verifiedIds.size} fully verified sellers`);

    // Update all listings: set sellerVerified based on whether their seller is verified
    const listings = await db
      .collection('product_listings')
      .find({}, { projection: { _id: 1, sellerId: 1 } })
      .toArray();

    console.log(`Processing ${listings.length} listings...`);

    let updatedCount = 0;
    const bulkOps = listings.map((listing) => ({
      updateOne: {
        filter: { _id: listing._id },
        update: {
          $set: {
            sellerVerified: verifiedIds.has(listing.sellerId.toString()),
          },
        },
      },
    }));

    if (bulkOps.length > 0) {
      const result = await db
        .collection('product_listings')
        .bulkWrite(bulkOps);
      updatedCount = result.modifiedCount;
    }

    console.log(`Updated ${updatedCount} listings`);
    console.log(
      `Verified: ${listings.filter((l) => verifiedIds.has(l.sellerId.toString())).length}`,
    );
    console.log(
      `Not verified: ${listings.filter((l) => !verifiedIds.has(l.sellerId.toString())).length}`,
    );
  } finally {
    await client.close();
  }
}

backfill().catch(console.error);
