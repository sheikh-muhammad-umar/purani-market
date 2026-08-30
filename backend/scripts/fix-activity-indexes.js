/**
 * Reconciles the indexes on `user_activities` with what the schema declares.
 *
 * Two things drifted. Older schema revisions created `action_1` and
 * `userId_1_action_1`, both of which are now leading prefixes of the compound
 * indexes that replaced them (`action_1_createdAt_-1` and
 * `userId_1_action_1_createdAt_-1`). MongoDB can serve a prefix query from the
 * longer index, so the short ones earn nothing and still cost a write on every
 * insert — and this collection is insert-heavy.
 *
 * Separately, three partial indexes were declared with
 * `{ $exists: true, $ne: null }`. MongoDB rejects `$ne` inside a
 * partialFilterExpression, so those builds failed silently and the collection ran
 * without them. The schema now uses `{ $type: 'string' }`; this script reports
 * whether they exist so a deployment can confirm the fix took effect.
 *
 * Read-only unless --apply is passed. Nothing here deletes documents.
 *
 *   node scripts/fix-activity-indexes.js            # report only
 *   node scripts/fix-activity-indexes.js --apply    # drop redundant indexes
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const APPLY = process.argv.includes('--apply');

/** Superseded by a compound index that starts with the same fields. */
const REDUNDANT = [
  { name: 'action_1', supersededBy: 'action_1_createdAt_-1' },
  { name: 'userId_1_action_1', supersededBy: 'userId_1_action_1_createdAt_-1' },
];

/** Declared in the schema; listed here so a run reports anything missing. */
const EXPECTED = [
  'userId_1_createdAt_-1',
  'action_1_createdAt_-1',
  'userId_1_action_1_createdAt_-1',
  'productListingId_1_action_1',
  'searchQuery_1_createdAt_-1',
  'metadata.deviceType_1_createdAt_-1',
  'sessionId_1_createdAt_-1',
  'visitorId_1_createdAt_-1',
  'createdAt_1',
];

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const collection = client.db().collection('user_activities');
    const before = await collection.indexes();
    const names = before.map((i) => i.name);

    console.log(`user_activities has ${before.length} indexes\n`);

    const missing = EXPECTED.filter((name) => !names.includes(name));
    if (missing.length) {
      console.log(
        'Declared but missing (start the API once to let Mongoose build them):',
      );
      for (const name of missing) console.log(`  ${name}`);
      console.log('');
    } else {
      console.log('Every index the schema declares is present.\n');
    }

    const ttl = before.find((i) => i.name === 'createdAt_1');
    if (ttl?.expireAfterSeconds) {
      console.log(
        `Retention: ${Math.round(ttl.expireAfterSeconds / 86400)} days\n`,
      );
    }

    const present = REDUNDANT.filter(({ name }) => names.includes(name));
    if (!present.length) {
      console.log('No redundant indexes left to drop.');
      return;
    }

    console.log(`${present.length} redundant index(es):`);
    for (const { name, supersededBy } of present) {
      console.log(`  ${name}  — prefix of ${supersededBy}`);
    }

    if (!APPLY) {
      console.log(
        '\nRe-run with --apply to drop them. No documents are affected.',
      );
      return;
    }

    for (const { name, supersededBy } of present) {
      // Refuse to drop unless the index that replaces it actually exists, so a
      // half-built collection cannot be left with neither.
      if (!names.includes(supersededBy)) {
        console.log(`\nSkipping ${name}: ${supersededBy} is not present.`);
        continue;
      }
      await collection.dropIndex(name);
      console.log(`\nDropped ${name}`);
    }

    const after = await collection.indexes();
    console.log(`\nDone. ${before.length} indexes -> ${after.length}.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
