/**
 * Migration script: Rename adLimit → listingLimit, activeAdCount → activeListingCount
 *
 * This renames the fields in the `users` collection to match the updated codebase.
 *
 * Run: node scripts/migrate-ad-limit-to-listing-limit.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');

    // Check how many documents have the old field names
    const countOld = await users.countDocuments({ adLimit: { $exists: true } });
    console.log(`Found ${countOld} users with old 'adLimit' field`);

    if (countOld === 0) {
      console.log('Nothing to migrate — fields already renamed or collection is empty.');
      return;
    }

    // Rename fields
    const result = await users.updateMany(
      { adLimit: { $exists: true } },
      {
        $rename: {
          adLimit: 'listingLimit',
          activeAdCount: 'activeListingCount',
        },
      },
    );

    console.log(`Migration complete: ${result.modifiedCount} users updated`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
