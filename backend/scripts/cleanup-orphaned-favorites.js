const { MongoClient } = require('mongodb');

async function cleanup() {
  const client = new MongoClient('mongodb://localhost:27017/marketplace');
  await client.connect();
  const db = client.db();

  const favorites = await db.collection('favorites').find({}).toArray();
  const listingIds = favorites.map(f => f.productListingId).filter(Boolean);

  const existingListings = await db.collection('product_listings')
    .find({ _id: { $in: listingIds } })
    .project({ _id: 1 })
    .toArray();

  const existingSet = new Set(existingListings.map(l => l._id.toString()));

  const orphans = favorites.filter(
    f => !f.productListingId || !existingSet.has(f.productListingId.toString())
  );

  console.log(`Total favorites: ${favorites.length}`);
  console.log(`Orphaned (listing deleted): ${orphans.length}`);

  if (orphans.length > 0) {
    const ids = orphans.map(f => f._id);
    const result = await db.collection('favorites').deleteMany({ _id: { $in: ids } });
    console.log(`Deleted ${result.deletedCount} orphaned favorites`);
  } else {
    console.log('No orphaned favorites to clean up');
  }

  await client.close();
}

cleanup();
