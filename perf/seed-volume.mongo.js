/**
 * Volume test seeder.
 *
 * Inserts PERF_SEED_COUNT listings into product_listings, every one tagged
 * `perfSeed: true` so the entire set can be removed with a single delete. Real
 * category, seller and location ids are reused so the documents match what the
 * app's queries actually filter and sort on -- synthetic ids would miss the
 * indexes and make the results meaningless in the opposite direction.
 *
 * Run:  docker exec -i personal-mongodb-1 mongosh marketplace --quiet < seed-volume.mongo.js
 */

const COUNT = Number(globalThis.SEED_COUNT || 50000);
const BATCH = 5000;

const sellers = db.users.find({}, { _id: 1 }).toArray().map((u) => u._id);
if (sellers.length === 0) throw new Error('no users to attribute listings to');

// Level-2 categories with their parent, so categoryPath is realistic.
const cats = db.categories
  .find({ level: 2 }, { _id: 1, parentId: 1, name: 1 })
  .limit(60)
  .toArray();
if (cats.length === 0) throw new Error('no level-2 categories found');

const provinces = db.provinces.find({}, { _id: 1, name: 1 }).toArray();
const cities = db.cities
  .find({}, { _id: 1, name: 1, provinceId: 1 })
  .limit(120)
  .toArray();
const areas = db.areas
  .find({}, { _id: 1, name: 1, cityId: 1 })
  .limit(400)
  .toArray();

const conditions = ['new', 'used', 'refurbished'];
// Weighted toward active: matches how a real marketplace looks and keeps the
// hot-path filter ({status:'active'}) selective in the same proportion.
const statuses = [
  'active', 'active', 'active', 'active', 'active',
  'active', 'active', 'active', 'sold', 'expired',
];
const nouns = [
  'iPhone', 'Samsung Galaxy', 'Honda Civic', 'Toyota Corolla', 'Suzuki Mehran',
  'Yamaha YBR', 'Dell Laptop', 'HP Pavilion', 'Sofa Set', 'Dining Table',
  'Apartment', 'House', 'Plot', 'Generator', 'Air Conditioner',
  'Refrigerator', 'Washing Machine', 'Bicycle', 'Camera', 'PlayStation',
];
const adjs = [
  'Excellent Condition', 'Slightly Used', 'Brand New', 'Urgent Sale',
  'Negotiable', 'Imported', 'Well Maintained', 'First Owner',
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

const LOREM =
  'This listing is seeded for performance testing. It contains a realistic ' +
  'length description so that document size, network transfer and any regex ' +
  'scan over the description field behave comparably to production data. ' +
  'Contact for details and inspection. Price is slightly negotiable for ' +
  'serious buyers only. No time wasters please. Available for viewing.';

print('seeding ' + COUNT + ' listings in batches of ' + BATCH + '...');
const startedAt = Date.now();
let inserted = 0;

while (inserted < COUNT) {
  const n = Math.min(BATCH, COUNT - inserted);
  const docs = [];
  for (let i = 0; i < n; i++) {
    const cat = pick(cats);
    const city = pick(cities);
    const prov = provinces.find(
      (p) => String(p._id) === String(city.provinceId),
    ) || pick(provinces);
    const areaPool = areas.filter(
      (a) => String(a.cityId) === String(city._id),
    );
    const area = areaPool.length ? pick(areaPool) : pick(areas);
    const status = pick(statuses);
    // Spread createdAt across ~2 years so sort-by-newest and date ranges are
    // not all ties.
    const created = new Date(Date.now() - randInt(0, 730) * 86400000);
    const featured = Math.random() < 0.06;

    docs.push({
      perfSeed: true,
      sellerId: pick(sellers),
      title: pick(adjs) + ' ' + pick(nouns) + ' ' + randInt(2005, 2025),
      description: LOREM,
      price: { amount: randInt(1000, 25000000), currency: 'PKR' },
      categoryId: cat._id,
      categoryPath: cat.parentId ? [cat.parentId, cat._id] : [cat._id],
      condition: pick(conditions),
      categoryAttributes: {},
      selectedFeatures: [],
      images: [
        { url: '/uploads/seed-a.jpg', thumbnailUrl: '/uploads/seed-a-t.jpg', sortOrder: 0 },
        { url: '/uploads/seed-b.jpg', thumbnailUrl: '/uploads/seed-b-t.jpg', sortOrder: 1 },
      ],
      location: {
        provinceId: prov._id,
        cityId: city._id,
        areaId: area._id,
        province: prov.name,
        city: city.name,
        area: area.name,
      },
      status: status,
      isFeatured: featured,
      featuredUntil: featured
        ? new Date(Date.now() + randInt(1, 30) * 86400000)
        : undefined,
      sellerVerified: Math.random() < 0.35,
      sellerRating: Math.random() < 0.5 ? +(Math.random() * 5).toFixed(1) : 0,
      sellerReviewCount: randInt(0, 40),
      viewCount: randInt(0, 5000),
      favoriteCount: randInt(0, 300),
      rejectionCount: 0,
      createdAt: created,
      updatedAt: created,
      __v: 0,
    });
  }
  db.product_listings.insertMany(docs, { ordered: false });
  inserted += n;
  print('  inserted ' + inserted + '/' + COUNT);
}

const elapsed = (Date.now() - startedAt) / 1000;
print('done in ' + elapsed.toFixed(1) + 's');
print('total listings now: ' + db.product_listings.countDocuments({}));
print('perfSeed listings:  ' + db.product_listings.countDocuments({ perfSeed: true }));
print('active listings:    ' + db.product_listings.countDocuments({ status: 'active' }));
const st = db.stats();
print('dataSize MB: ' + (st.dataSize / 1048576).toFixed(1) +
      '  indexSize MB: ' + (st.indexSize / 1048576).toFixed(1));
