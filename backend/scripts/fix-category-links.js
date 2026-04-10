/* eslint-disable */
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const titleToCategory = {
  'toyota': 'cars', 'honda civic': 'cars', 'suzuki': 'cars', 'corolla': 'cars', 'yaris': 'cars',
  'iphone': 'mobile phones', 'samsung galaxy': 'mobile phones', 'xiaomi': 'mobile phones',
  'macbook': 'computers & accessories', 'dell': 'computers & accessories', 'hp laptop': 'computers & accessories', 'laptop': 'computers & accessories',
  'house': 'houses', 'marla': 'houses', 'plot': 'land & plots',
  'apartment': 'apartments & flats',
  'sofa': 'sofa & chairs', 'bed': 'beds & wardrobes', 'table': 'tables & dining',
  'motorcycle': 'motorcycles', 'honda 125': 'motorcycles', 'yamaha': 'motorcycles',
  'ac ': 'ac & coolers', 'washing': 'washing machines & dryers',
  'camera': 'cameras & accessories', 'gaming': 'games & entertainment',
  'fridge': 'fridges & freezers', 'tv ': 'tv - video - audio', 'generator': 'generators & ups',
};

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected');
  const db = client.db();

  const cats = await db.collection('categories').find({}).toArray();
  const catByName = {};
  cats.forEach(c => { catByName[c.name.toLowerCase()] = c; });

  const listings = await db.collection('product_listings').find({}).toArray();
  console.log('Listings:', listings.length, 'Categories:', cats.length);

  let updated = 0;
  for (const listing of listings) {
    const titleLower = listing.title.toLowerCase();
    let matchedCat = null;

    for (const [keyword, catName] of Object.entries(titleToCategory)) {
      if (titleLower.includes(keyword)) {
        matchedCat = catByName[catName.toLowerCase()];
        break;
      }
    }

    if (!matchedCat) {
      const l2Cats = cats.filter(c => c.level === 2);
      matchedCat = l2Cats[Math.floor(Math.random() * l2Cats.length)];
    }

    if (matchedCat) {
      const path = [matchedCat._id];
      let parent = cats.find(c => c._id.toString() === (matchedCat.parentId || '').toString());
      while (parent) {
        path.unshift(parent._id);
        parent = cats.find(c => c._id.toString() === (parent.parentId || '').toString());
      }

      await db.collection('product_listings').updateOne(
        { _id: listing._id },
        { $set: { categoryId: matchedCat._id, categoryPath: path } }
      );
      updated++;
    }
  }

  console.log('Updated ' + updated + ' listings');

  // Verify
  const sample = await db.collection('product_listings').find({ status: 'active' }).limit(5).toArray();
  sample.forEach(l => {
    const names = l.categoryPath.map(id => {
      const c = cats.find(cc => cc._id.toString() === id.toString());
      return c ? c.name : '?';
    });
    console.log('  ' + l.title + ' => ' + names.join(' / '));
  });

  await client.close();
}

run().catch(e => { console.error(e); process.exit(1); });
