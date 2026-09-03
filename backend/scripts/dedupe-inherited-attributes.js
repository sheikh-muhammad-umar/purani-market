/* eslint-disable */
// Removes category attributes whose `key` is already provided by an ancestor
// category. Such duplicates make the whole subcategory un-editable in the admin
// UI (both backend updateAttributes/assignAttributes and the FE saveAttributes
// reject any child key that collides with a parent). The child keeps inheriting
// the attribute from its ancestor, so nothing is lost from the listing forms.
//
// Non-destructive and idempotent: it only trims duplicate keys, never removes a
// category or a unique attribute, and re-running it is a no-op.
//
//   node scripts/dedupe-inherited-attributes.js
//   DRY_RUN=1 node scripts/dedupe-inherited-attributes.js   (preview only)
const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col = client.db().collection('categories');
    const all = await col
      .find({})
      .project({ name: 1, slug: 1, parentId: 1, attributes: 1 })
      .toArray();
    const byId = new Map(all.map((c) => [c._id.toString(), c]));

    function ancestorKeys(cat) {
      const keys = new Set();
      let cur = cat.parentId ? byId.get(cat.parentId.toString()) : null;
      while (cur) {
        for (const a of cur.attributes || []) keys.add(a.key);
        cur = cur.parentId ? byId.get(cur.parentId.toString()) : null;
      }
      return keys;
    }

    let updated = 0;
    let removedTotal = 0;

    for (const cat of all) {
      const anc = ancestorKeys(cat);
      const attrs = cat.attributes || [];
      const kept = attrs.filter((a) => !anc.has(a.key));
      const removed = attrs.filter((a) => anc.has(a.key)).map((a) => a.key);
      if (removed.length === 0) continue;

      console.log(
        `${cat.slug} (${cat.name}): removing ${removed.length} inherited-duplicate key(s): ${removed.join(', ')}`,
      );
      removedTotal += removed.length;
      updated++;

      if (!DRY_RUN) {
        await col.updateOne(
          { _id: cat._id },
          { $set: { attributes: kept, updatedAt: new Date() } },
        );
      }
    }

    console.log('---');
    console.log(
      `${DRY_RUN ? '[DRY RUN] would update' : 'updated'} ${updated} categor${updated === 1 ? 'y' : 'ies'}, removing ${removedTotal} duplicate attribute(s)`,
    );

    if (!DRY_RUN && updated > 0) {
      try {
        const Redis = require('ioredis');
        const redis = new Redis(process.env.REDIS_URL || undefined);
        await redis.del('categories:tree');
        await redis.quit();
        console.log('Cleared Redis categories:tree cache');
      } catch (e) {
        console.log('Redis cache clear skipped:', e.message);
      }
    }
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
