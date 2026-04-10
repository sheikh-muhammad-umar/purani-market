/* eslint-disable */
// Backfill location IDs on existing listings by matching names to the locations collections
// Run with: node backend/scripts/backfill-location-ids.js
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected');
  const db = client.db();

  const provinces = await db.collection('provinces').find().toArray();
  const cities = await db.collection('cities').find().toArray();
  const areas = await db.collection('areas').find().toArray();

  // Build lookup maps (name lowercase -> doc)
  const provByName = {};
  provinces.forEach(p => { provByName[p.name.toLowerCase()] = p; });

  const cityByName = {};
  cities.forEach(c => { cityByName[c.name.toLowerCase()] = c; });

  const areaByName = {};
  areas.forEach(a => {
    const city = cities.find(c => c._id.toString() === a.cityId.toString());
    if (city) {
      const key = city.name.toLowerCase() + '|' + a.name.toLowerCase();
      areaByName[key] = a;
    }
  });

  const listings = await db.collection('product_listings').find({}).toArray();
  console.log('Processing', listings.length, 'listings');

  let updated = 0;
  for (const listing of listings) {
    const loc = listing.location || {};
    const update = {};

    if (loc.province && !loc.provinceId) {
      const prov = provByName[loc.province.toLowerCase()];
      if (prov) update['location.provinceId'] = prov._id;
    }

    if (loc.city && !loc.cityId) {
      const city = cityByName[loc.city.toLowerCase()];
      if (city) update['location.cityId'] = city._id;
    }

    if (loc.city && loc.area && !loc.areaId) {
      const key = loc.city.toLowerCase() + '|' + loc.area.toLowerCase();
      const area = areaByName[key];
      if (area) update['location.areaId'] = area._id;
    }

    if (Object.keys(update).length > 0) {
      await db.collection('product_listings').updateOne({ _id: listing._id }, { $set: update });
      updated++;
    }
  }

  console.log('Updated', updated, 'listings with location IDs');
  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
