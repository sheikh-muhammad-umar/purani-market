/**
 * Enriches `province_city` category attributes from a bare place-name string to
 * the structured `{ provinceId, cityId, province, city }` shape.
 *
 * Historical listings stored only the name, so a renamed city silently orphaned
 * them. The ids make the reference stable; the names are kept because search
 * indexes, filters and facets all work off the readable value — which means
 * Elasticsearch does not need reindexing, as the indexed value is unchanged.
 *
 * Usage:
 *   node scripts/migrate-province-city-attributes.js            # dry run
 *   node scripts/migrate-province-city-attributes.js --apply    # write changes
 */
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

function readMongoUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const match = fs.readFileSync(envPath, 'utf8').match(/^MONGODB_URI=(.*)$/m);
  if (!match) throw new Error('MONGODB_URI not found in backend/.env');
  return match[1].trim();
}

(async () => {
  const client = new MongoClient(readMongoUri());
  await client.connect();
  const db = client.db();

  // Which attribute keys are province_city, per category.
  const categories = await db.collection('categories').find({}).toArray();
  const provinceCityKeys = new Set();
  for (const cat of categories) {
    for (const attr of cat.attributes || []) {
      if (attr.type === 'province_city') provinceCityKeys.add(attr.key);
    }
  }
  if (provinceCityKeys.size === 0) {
    console.log('No province_city attributes defined. Nothing to do.');
    await client.close();
    return;
  }
  console.log(
    'province_city attribute keys:',
    [...provinceCityKeys].join(', '),
  );

  // Location lookup by name. Cities carry their province reference.
  const provinces = await db.collection('provinces').find({}).toArray();
  const cities = await db.collection('cities').find({}).toArray();
  const provinceById = new Map(provinces.map((p) => [String(p._id), p]));
  const provinceByName = new Map(
    provinces.map((p) => [p.name.toLowerCase(), p]),
  );
  const cityByName = new Map();
  for (const city of cities) {
    // Names are not globally unique; first match wins and ambiguity is reported.
    const key = city.name.toLowerCase();
    if (!cityByName.has(key)) cityByName.set(key, []);
    cityByName.get(key).push(city);
  }

  const listings = await db
    .collection('product_listings')
    .find({}, { projection: { categoryAttributes: 1 } })
    .toArray();

  let converted = 0;
  let alreadyStructured = 0;
  const unresolved = [];
  const ambiguous = [];

  for (const listing of listings) {
    const attrs = listing.categoryAttributes;
    if (!attrs) continue;

    const updates = {};
    for (const key of provinceCityKeys) {
      const value = attrs[key];
      if (value === undefined || value === null || value === '') continue;

      if (typeof value === 'object') {
        alreadyStructured++;
        continue;
      }
      if (typeof value !== 'string') continue;

      // Stored values are a city name, or occasionally "Province - City".
      const raw = value.includes(' - ')
        ? value.split(' - ').pop().trim()
        : value.trim();
      const lookupKey = raw.toLowerCase();

      const cityMatches = cityByName.get(lookupKey) || [];
      if (cityMatches.length > 1) {
        ambiguous.push({ _id: String(listing._id), key, value: raw });
      }

      if (cityMatches.length >= 1) {
        const city = cityMatches[0];
        const province = provinceById.get(String(city.provinceId));
        updates[`categoryAttributes.${key}`] = {
          provinceId: province ? String(province._id) : '',
          cityId: String(city._id),
          province: province ? province.name : '',
          city: city.name,
        };
        converted++;
        continue;
      }

      // Not a city — it may be a province name.
      const province = provinceByName.get(lookupKey);
      if (province) {
        updates[`categoryAttributes.${key}`] = {
          provinceId: String(province._id),
          cityId: '',
          province: province.name,
          city: '',
        };
        converted++;
        continue;
      }

      unresolved.push({ _id: String(listing._id), key, value: raw });
    }

    if (Object.keys(updates).length > 0 && APPLY) {
      await db
        .collection('product_listings')
        .updateOne({ _id: listing._id }, { $set: updates });
    }
  }

  console.log(`\nlistings scanned      : ${listings.length}`);
  console.log(`already structured    : ${alreadyStructured}`);
  console.log(`converted             : ${converted}`);
  console.log(`unresolved names      : ${unresolved.length}`);
  if (unresolved.length > 0)
    console.log('  ', JSON.stringify(unresolved.slice(0, 10)));
  console.log(`ambiguous city names  : ${ambiguous.length}`);
  if (ambiguous.length > 0)
    console.log('  ', JSON.stringify(ambiguous.slice(0, 10)));
  console.log(
    APPLY ? '\nAPPLIED.' : '\nDRY RUN — re-run with --apply to write.',
  );

  await client.close();
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
