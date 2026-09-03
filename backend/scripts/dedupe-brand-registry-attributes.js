/* eslint-disable */
// Removes category ATTRIBUTES that duplicate the admin-managed brand registry.
//
// On categories backed by a brand registry, users pick brand/model/variant from
// the registry (vehicle_brands/vehicle_models/vehicle_variants, or brands),
// which is stored in the listing's top-level brand fields. Defining `make`,
// `model`, or `brand` ALSO as static category attributes makes the create form
// show the value twice (registry picker + attribute field) and stores it twice.
//
// This script removes those redundant attribute keys, but ONLY where a registry
// actually backs the category — verified at runtime against the registry
// collections — so it never strips the only input path from a category that has
// no registry (e.g. Smart Watches/Tablets, which are hasBrands but have no
// seeded brands). It is non-destructive (only trims specific keys) and
// idempotent.
//
//   node scripts/dedupe-brand-registry-attributes.js
//   DRY_RUN=1 node scripts/dedupe-brand-registry-attributes.js
const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

// Keys supplied by a VEHICLE registry (brand+model+variant picker).
const VEHICLE_KEYS = new Set(['make', 'model']);
// Keys supplied by a SIMPLE brand registry (brand picker only — NO model).
const SIMPLE_KEYS = new Set(['brand']);

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const cats = await db.collection('categories').find({}).toArray();
    const byId = new Map(cats.map((x) => [x._id.toString(), x]));

    const vehCatIds = new Set(
      (await db.collection('vehicle_brands').distinct('categoryId')).map(String),
    );
    const simpleCatIds = new Set(
      (await db.collection('brands').distinct('categoryId')).map(String),
    );

    function pathIds(cat) {
      const ids = [];
      let cur = cat;
      while (cur) {
        ids.push(cur._id.toString());
        cur = cur.parentId ? byId.get(cur.parentId.toString()) : null;
      }
      return ids;
    }

    let updated = 0;
    let removedTotal = 0;

    for (const cat of cats) {
      const attrs = cat.attributes || [];
      if (attrs.length === 0) continue;

      const ids = pathIds(cat);
      const isVehicle = ids.some((id) => vehCatIds.has(id));
      const isSimple = ids.some((id) => simpleCatIds.has(id));
      if (!isVehicle && !isSimple) continue; // no registry backs this category

      const removable = isVehicle ? VEHICLE_KEYS : SIMPLE_KEYS;
      const kept = attrs.filter((a) => !removable.has(a.key));
      const removed = attrs.filter((a) => removable.has(a.key)).map((a) => a.key);
      if (removed.length === 0) continue;

      console.log(
        `${cat.slug} (${cat.name}) [${isVehicle ? 'vehicle' : 'simple'} registry]: removing ${removed.join(', ')}`,
      );
      removedTotal += removed.length;
      updated++;

      if (!DRY_RUN) {
        await db
          .collection('categories')
          .updateOne(
            { _id: cat._id },
            { $set: { attributes: kept, updatedAt: new Date() } },
          );
      }
    }

    console.log('---');
    console.log(
      `${DRY_RUN ? '[DRY RUN] would update' : 'updated'} ${updated} categor${updated === 1 ? 'y' : 'ies'}, removing ${removedTotal} redundant attribute(s)`,
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
