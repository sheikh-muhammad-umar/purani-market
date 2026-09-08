/**
 * Removes every document created by seed-volume.mongo.js.
 *
 * Scoped strictly to `perfSeed: true`, so pre-existing listings are untouched.
 * The app's change stream propagates these deletions out of Elasticsearch.
 *
 * Run:  docker exec -i personal-mongodb-1 mongosh marketplace --quiet < cleanup-volume.mongo.js
 */

const before = db.product_listings.countDocuments({});
const seeded = db.product_listings.countDocuments({ perfSeed: true });
print('total before: ' + before + '  seeded: ' + seeded);

if (seeded === 0) {
  print('nothing to remove');
} else {
  const res = db.product_listings.deleteMany({ perfSeed: true });
  print('deleted: ' + res.deletedCount);
}

print('total after:  ' + db.product_listings.countDocuments({}));
print('perfSeed remaining: ' + db.product_listings.countDocuments({ perfSeed: true }));
