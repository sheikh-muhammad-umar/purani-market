/**
 * Fix conversation indexes: drop the non-sparse unique index on
 * { buyerId, sellerId, productListingId } and let Mongoose recreate it as sparse.
 *
 * Run: node scripts/fix-conversation-indexes.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const collection = db.collection('conversations');

  console.log('Current indexes:');
  const indexes = await collection.indexes();
  console.log(JSON.stringify(indexes, null, 2));

  // Drop the non-sparse compound index if it exists
  const targetIndex = 'buyerId_1_sellerId_1_productListingId_1';
  const existing = indexes.find((idx) => idx.name === targetIndex);

  if (existing && !existing.sparse) {
    console.log(`\nDropping non-sparse index: ${targetIndex}`);
    await collection.dropIndex(targetIndex);
    console.log('Dropped successfully.');

    // Recreate as sparse
    console.log('Recreating as sparse...');
    await collection.createIndex(
      { buyerId: 1, sellerId: 1, productListingId: 1 },
      { unique: true, sparse: true },
    );
    console.log('Recreated with sparse: true');
  } else if (existing && existing.sparse) {
    console.log(`\nIndex ${targetIndex} is already sparse. No action needed.`);
  } else {
    console.log(`\nIndex ${targetIndex} not found. Creating...`);
    await collection.createIndex(
      { buyerId: 1, sellerId: 1, productListingId: 1 },
      { unique: true, sparse: true },
    );
    console.log('Created with sparse: true');
  }

  // Also check the shortVideoId index
  const shortIndex = 'buyerId_1_sellerId_1_shortVideoId_1';
  const shortExisting = indexes.find((idx) => idx.name === shortIndex);
  if (shortExisting && !shortExisting.sparse) {
    console.log(`\nDropping non-sparse index: ${shortIndex}`);
    await collection.dropIndex(shortIndex);
    await collection.createIndex(
      { buyerId: 1, sellerId: 1, shortVideoId: 1 },
      { unique: true, sparse: true },
    );
    console.log('Recreated with sparse: true');
  }

  console.log('\nDone. Final indexes:');
  const finalIndexes = await collection.indexes();
  console.log(JSON.stringify(finalIndexes, null, 2));

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
