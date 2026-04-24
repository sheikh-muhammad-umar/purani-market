/**
 * Migration: Rename vehicleType "bike" → "motorcycle"
 * in vehicle_brands, vehicle_models, and vehicle_variants collections.
 *
 * Usage:
 *   node scripts/migrate-bike-to-motorcycle.js
 *
 * Set MONGODB_URI env var or defaults to local dev DB.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/marketplace?replicaSet=rs0&directConnection=true';

async function run() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();

    const collections = ['vehicle_brands', 'vehicle_models', 'vehicle_variants'];

    for (const name of collections) {
      const result = await db
        .collection(name)
        .updateMany({ vehicleType: 'bike' }, { $set: { vehicleType: 'motorcycle' } });

      console.log(
        `${name}: ${result.matchedCount} matched, ${result.modifiedCount} updated`,
      );
    }

    console.log('Migration complete.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
