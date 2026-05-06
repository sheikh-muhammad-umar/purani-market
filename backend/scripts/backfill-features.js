/* eslint-disable */
/**
 * Backfill selectedFeatures on 50 existing listings.
 * Looks up each listing's category, gets the available features for that category,
 * and randomly assigns a subset of relevant features.
 *
 * Usage:  cd backend && node scripts/backfill-features.js
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

function pick(arr, min, max) {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  const categoriesCol = db.collection('categories');
  const listingsCol = db.collection('product_listings');

  // 1. Build a map of categoryId -> features[]
  const categories = await categoriesCol.find({ features: { $exists: true, $ne: [] } }).toArray();
  const featureMap = new Map();
  for (const cat of categories) {
    featureMap.set(cat._id.toString(), cat.features);
  }

  console.log(`Found ${featureMap.size} categories with features defined.`);

  if (featureMap.size === 0) {
    console.log('No categories have features defined. Run seed-categories-full.js first.');
    await client.close();
    return;
  }

  // 2. Find listings that belong to categories with features and have empty/no selectedFeatures
  const categoryIds = categories.map(c => c._id);
  const listings = await listingsCol.find({
    categoryId: { $in: categoryIds },
    $or: [
      { selectedFeatures: { $exists: false } },
      { selectedFeatures: { $size: 0 } },
    ],
  }).limit(50).toArray();

  console.log(`Found ${listings.length} listings eligible for feature backfill.`);

  if (listings.length === 0) {
    console.log('No eligible listings found. They may already have features assigned.');
    await client.close();
    return;
  }

  // 3. Assign random features from the category's feature list
  let updated = 0;
  for (const listing of listings) {
    const catFeatures = featureMap.get(listing.categoryId.toString());
    if (!catFeatures || catFeatures.length === 0) continue;

    // Pick 2-6 random features (or fewer if category has less)
    const minFeatures = Math.min(2, catFeatures.length);
    const maxFeatures = Math.min(6, catFeatures.length);
    const selected = pick(catFeatures, minFeatures, maxFeatures);

    await listingsCol.updateOne(
      { _id: listing._id },
      { $set: { selectedFeatures: selected, updatedAt: new Date() } },
    );

    updated++;
    console.log(`  [${updated}] ${listing.title} → ${selected.join(', ')}`);
  }

  console.log(`\nDone! Updated ${updated} listings with features.`);
  await client.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
