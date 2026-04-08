/* eslint-disable */
// One-time cleanup: deletes listings with null categoryId or referencing deleted categories
// Run with: node backend/scripts/cleanup-orphaned-listings.js
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function cleanup() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');

    const listings = db.collection('product_listings');
    const categories = db.collection('categories');

    // 1. Delete listings with null/missing categoryId
    const nullResult = await listings.deleteMany({
      $or: [{ categoryId: null }, { categoryId: { $exists: false } }],
    });
    console.log(`Deleted ${nullResult.deletedCount} listing(s) with null/missing categoryId`);

    // 2. Find all distinct categoryIds still in listings
    const usedCatIds = await listings.distinct('categoryId');
    const existingCats = await categories
      .find({ _id: { $in: usedCatIds } })
      .project({ _id: 1 })
      .toArray();
    const existingSet = new Set(existingCats.map((c) => c._id.toString()));
    const orphanedIds = usedCatIds.filter((id) => !existingSet.has(id.toString()));

    if (orphanedIds.length > 0) {
      const orphanResult = await listings.deleteMany({ categoryId: { $in: orphanedIds } });
      console.log(`Deleted ${orphanResult.deletedCount} listing(s) referencing ${orphanedIds.length} deleted category(ies)`);
    } else {
      console.log('No listings referencing deleted categories');
    }

    console.log('\nCleanup complete.');
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

cleanup();
