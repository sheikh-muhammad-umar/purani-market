/* eslint-disable */
// Backfill province on existing listings by looking up city → province from the locations DB
// Also fills in missing area/blockPhase for testing variety
// Run with: node backend/scripts/backfill-province.js
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function run() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();

    // Build city → province lookup from the locations collections
    const provinces = await db.collection('provinces').find().toArray();
    const cities = await db.collection('cities').find().toArray();
    const areas = await db.collection('areas').find().toArray();

    const provinceById = {};
    provinces.forEach(p => { provinceById[p._id.toString()] = p.name; });

    // city name (lowercase) → province name
    const cityToProvince = {};
    // city name (lowercase) → array of area docs
    const cityToAreas = {};

    cities.forEach(c => {
      const prov = provinceById[c.provinceId.toString()];
      if (prov) {
        cityToProvince[c.name.toLowerCase()] = prov;
      }
      cityToAreas[c.name.toLowerCase()] = [];
    });

    areas.forEach(a => {
      const city = cities.find(c => c._id.toString() === a.cityId.toString());
      if (city) {
        const key = city.name.toLowerCase();
        if (!cityToAreas[key]) cityToAreas[key] = [];
        cityToAreas[key].push(a);
      }
    });

    console.log(`Loaded ${provinces.length} provinces, ${cities.length} cities, ${areas.length} areas`);

    // Fallback: common Pakistani city → province mapping for cities not in the locations DB
    const fallbackCityProvince = {
      'lahore': 'Punjab', 'karachi': 'Sindh', 'islamabad': 'Islamabad',
      'rawalpindi': 'Punjab', 'faisalabad': 'Punjab', 'multan': 'Punjab',
      'peshawar': 'Khyber Pakhtunkhwa', 'quetta': 'Balochistan',
      'sialkot': 'Punjab', 'gujranwala': 'Punjab', 'hyderabad': 'Sindh',
      'bahawalpur': 'Punjab', 'sargodha': 'Punjab', 'sukkur': 'Sindh',
      'abbottabad': 'Khyber Pakhtunkhwa', 'mardan': 'Khyber Pakhtunkhwa',
      'gujrat': 'Punjab', 'sahiwal': 'Punjab', 'larkana': 'Sindh',
      'sheikhupura': 'Punjab', 'jhang': 'Punjab', 'rahim yar khan': 'Punjab',
      'kasur': 'Punjab', 'okara': 'Punjab', 'wah cantt': 'Punjab',
      'dera ghazi khan': 'Punjab', 'chiniot': 'Punjab', 'kamoke': 'Punjab',
      'mirpur': 'Azad Kashmir', 'muzaffarabad': 'Azad Kashmir',
      'gilgit': 'Gilgit-Baltistan', 'skardu': 'Gilgit-Baltistan',
    };

    // Get all listings
    const listings = await db.collection('product_listings').find({}).toArray();
    console.log(`Found ${listings.length} listings to process`);

    let updated = 0;
    let skipped = 0;

    for (const listing of listings) {
      const city = listing.location?.city;
      if (!city) { skipped++; continue; }

      const cityLower = city.toLowerCase();
      const province = cityToProvince[cityLower] || fallbackCityProvince[cityLower];

      if (!province) {
        console.log(`  No province found for city: ${city}`);
        skipped++;
        continue;
      }

      const update = {};

      // Always set province
      update['location.province'] = province;

      // If no area, pick a random one from the DB for this city (for testing)
      if (!listing.location?.area) {
        const cityAreas = cityToAreas[cityLower] || [];
        if (cityAreas.length > 0) {
          const randomArea = cityAreas[Math.floor(Math.random() * cityAreas.length)];
          update['location.area'] = randomArea.name;

          // If the area has blockPhases, pick one randomly
          if (randomArea.blockPhases && randomArea.blockPhases.length > 0 && Math.random() > 0.5) {
            update['location.blockPhase'] = randomArea.blockPhases[Math.floor(Math.random() * randomArea.blockPhases.length)];
          }
          // If the area has subareas, pick one randomly
          if (randomArea.subareas && randomArea.subareas.length > 0 && Math.random() > 0.5) {
            update['location.blockPhase'] = randomArea.subareas[Math.floor(Math.random() * randomArea.subareas.length)];
          }
        }
      }

      await db.collection('product_listings').updateOne(
        { _id: listing._id },
        { $set: update },
      );
      updated++;
    }

    console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);

    // Summary
    const sample = await db.collection('product_listings').find({}).limit(5).project({ title: 1, 'location.province': 1, 'location.city': 1, 'location.area': 1, 'location.blockPhase': 1 }).toArray();
    console.log('\nSample listings:');
    sample.forEach(l => {
      console.log(`  ${l.title}: ${l.location?.province || '?'} > ${l.location?.city || '?'} > ${l.location?.area || '-'} > ${l.location?.blockPhase || '-'}`);
    });

  } catch (err) {
    console.error('Failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run();
