/**
 * Creates the case-insensitive unique index on `advertisers.name`.
 *
 * The campaign form lets staff add a brand inline, by typing its name. Without a
 * unique index, "Daraz", "daraz" and "Daraz " become three advertisers, and since
 * campaign spend and reporting hang off `advertiserId`, one brand's numbers get
 * split across them with nothing on screen explaining why.
 *
 * The index cannot be built while duplicates already exist, so this script
 * reports any it finds and stops without changing anything. Merge or rename them,
 * then run it again.
 *
 * Safe to run repeatedly: it does nothing when the index is already in place.
 *
 * Run: node scripts/fix-advertiser-name-index.js
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const INDEX_NAME = 'advertiser_name_unique_ci';
const COLLATION = { locale: 'en', strength: 2 };

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  try {
    const db = client.db();
    const advertisers = db.collection('advertisers');

    const indexes = await advertisers.indexes();
    console.log('Current indexes on advertisers:');
    indexes.forEach((idx) => console.log(`  - ${idx.name}`));

    if (indexes.some((idx) => idx.name === INDEX_NAME)) {
      console.log(`\n${INDEX_NAME} already exists. Nothing to do.`);
      return;
    }

    // Group by trimmed, lower-cased name so the report matches what the index
    // will consider a collision.
    const duplicates = await advertisers
      .aggregate([
        {
          $group: {
            _id: { $toLower: { $trim: { input: '$name' } } },
            count: { $sum: 1 },
            docs: { $push: { _id: '$_id', name: '$name' } },
          },
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    if (duplicates.length > 0) {
      console.error(
        `\nFound ${duplicates.length} brand name(s) held by more than one advertiser:`,
      );
      duplicates.forEach((group) => {
        console.error(`\n  "${group._id}" — ${group.count} records:`);
        group.docs.forEach((doc) =>
          console.error(`     ${doc._id}  ${JSON.stringify(doc.name)}`),
        );
      });
      console.error(
        '\nNo changes made. Point the campaigns at one record per brand, remove or' +
          '\nrename the rest, then run this script again.',
      );
      process.exitCode = 1;
      return;
    }

    console.log(`\nNo duplicates. Creating ${INDEX_NAME}...`);
    await advertisers.createIndex(
      { name: 1 },
      { unique: true, collation: COLLATION, name: INDEX_NAME },
    );
    console.log('Created.');

    const after = await advertisers.indexes();
    const created = after.find((idx) => idx.name === INDEX_NAME);
    console.log(`Verified: ${JSON.stringify(created)}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
