/* eslint-disable */
// Adds L3 subcategories + sample listings for 3-level testing
// Run: node backend/scripts/seed-l3.js
const { MongoClient, ObjectId } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function run() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();
  console.log('Connected');

  // Get existing L2 categories
  const l2Cats = await db.collection('categories').find({ level: 2 }).toArray();
  console.log(`Found ${l2Cats.length} L2 categories`);

  const now = new Date();
  const l3Categories = [];
  const l3Map = {}; // slug -> _id for listings

  for (const l2 of l2Cats) {
    const subs = getL3For(l2.slug);
    for (let i = 0; i < subs.length; i++) {
      const id = new ObjectId();
      l3Categories.push({
        _id: id, name: subs[i].name, slug: subs[i].slug,
        level: 3, parentId: l2._id, isActive: true, sortOrder: i,
        attributes: [], filters: [], createdAt: now, updatedAt: now,
      });
      l3Map[subs[i].slug] = id;
    }
  }

  if (l3Categories.length > 0) {
    await db.collection('categories').insertMany(l3Categories);
    console.log(`Inserted ${l3Categories.length} L3 categories`);
  }

  // Get a seller for listings
  const seller = await db.collection('users').findOne({ role: 'user' });
  if (!seller) { console.log('No user found for listings'); await client.close(); return; }

  // Get L1 + L2 for categoryPath
  const allCats = await db.collection('categories').find({}).toArray();
  const catById = {};
  allCats.forEach(c => catById[c._id.toString()] = c);

  function getCategoryPath(catId) {
    const path = [];
    let cur = catById[catId.toString()];
    while (cur) {
      path.unshift(cur._id);
      cur = cur.parentId ? catById[cur.parentId.toString()] : null;
    }
    return path;
  }

  const listings = [
    { title: 'Toyota Corolla XLi 2019 - Manual', slug: 'sedan', price: 3800000, city: 'Lahore', area: 'Model Town' },
    { title: 'Honda City Aspire 2021 - Auto', slug: 'sedan', price: 5200000, city: 'Karachi', area: 'Gulshan' },
    { title: 'Suzuki Alto VXR 2022', slug: 'hatchback', price: 2400000, city: 'Islamabad', area: 'F-10' },
    { title: 'Toyota Yaris Hatchback 2023', slug: 'hatchback', price: 4100000, city: 'Lahore', area: 'DHA Phase 5' },
    { title: 'Toyota Hilux Revo 2021 - 4x4', slug: 'suv-pickup', price: 9500000, city: 'Peshawar', area: 'Hayatabad' },
    { title: 'iPhone 15 128GB - PTA Approved', slug: 'iphone', price: 420000, city: 'Lahore', area: 'Liberty' },
    { title: 'iPhone 14 Pro 256GB - Mint', slug: 'iphone', price: 350000, city: 'Karachi', area: 'Clifton' },
    { title: 'Samsung Galaxy S24 128GB', slug: 'samsung', price: 280000, city: 'Islamabad', area: 'Blue Area' },
    { title: 'Samsung Galaxy A54 - New', slug: 'samsung', price: 95000, city: 'Lahore', area: 'Johar Town' },
    { title: 'Xiaomi 14 Ultra 512GB', slug: 'xiaomi-other', price: 220000, city: 'Rawalpindi', area: 'Saddar' },
    { title: 'Dell XPS 15 - i7 32GB', slug: 'windows-laptop', price: 480000, city: 'Lahore', area: 'Gulberg' },
    { title: 'MacBook Air M2 256GB', slug: 'macbook', price: 380000, city: 'Karachi', area: 'Defence' },
    { title: '5 Marla House in Bahria Town', slug: 'house-sale', price: 15000000, city: 'Lahore', area: 'Bahria Town' },
    { title: '10 Marla Plot in DHA Phase 9', slug: 'plot-sale', price: 22000000, city: 'Lahore', area: 'DHA Phase 9' },
    { title: '2 Bed Apartment for Rent - Clifton', slug: 'apartment-rent', price: 85000, city: 'Karachi', area: 'Clifton' },
  ];

  const listingDocs = [];
  for (const l of listings) {
    const catId = l3Map[l.slug];
    if (!catId) continue;
    listingDocs.push({
      _id: new ObjectId(),
      sellerId: seller._id,
      title: l.title,
      description: l.title + '. Great condition, contact for details.',
      price: { amount: l.price, currency: 'PKR' },
      categoryId: catId,
      categoryPath: getCategoryPath(catId),
      condition: 'used',
      categoryAttributes: {},
      images: [{ url: 'https://images.unsplash.com/photo-1549924231-f129b911e442?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1549924231-f129b911e442?w=300', sortOrder: 0 }],
      location: { type: 'Point', coordinates: [74.35, 31.52], city: l.city, area: l.area },
      contactInfo: { email: seller.email },
      status: 'active', isFeatured: false, viewCount: Math.floor(Math.random() * 500),
      favoriteCount: Math.floor(Math.random() * 30),
      createdAt: new Date(Date.now() - Math.random() * 7 * 86400000), updatedAt: now,
    });
  }

  if (listingDocs.length > 0) {
    await db.collection('product_listings').insertMany(listingDocs);
    console.log(`Inserted ${listingDocs.length} listings across L3 categories`);
  }

  // Clear Redis category cache
  const Redis = require('ioredis');
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.del('categories:tree');
    console.log('Cleared category cache');
    redis.disconnect();
  } catch (e) { console.log('Redis cache clear skipped:', e.message); }

  console.log('\n✅ L3 seed complete!');
  await client.close();
}

function getL3For(slug) {
  const map = {
    'cars': [
      { name: 'Sedan', slug: 'sedan' },
      { name: 'Hatchback', slug: 'hatchback' },
      { name: 'SUV / Pickup', slug: 'suv-pickup' },
      { name: 'Van / Bus', slug: 'van-bus' },
    ],
    'motorcycles': [
      { name: 'Standard', slug: 'standard-bike' },
      { name: 'Sports', slug: 'sports-bike' },
      { name: 'Scooter', slug: 'scooter' },
    ],
    'mobile-phones': [
      { name: 'iPhone', slug: 'iphone' },
      { name: 'Samsung', slug: 'samsung' },
      { name: 'Xiaomi / Other', slug: 'xiaomi-other' },
    ],
    'laptops': [
      { name: 'Windows Laptop', slug: 'windows-laptop' },
      { name: 'MacBook', slug: 'macbook' },
      { name: 'Chromebook', slug: 'chromebook' },
    ],
    'houses': [
      { name: 'House for Sale', slug: 'house-sale' },
      { name: 'House for Rent', slug: 'house-rent' },
      { name: 'Plot / Land', slug: 'plot-sale' },
    ],
    'apartments': [
      { name: 'Apartment for Sale', slug: 'apartment-sale' },
      { name: 'Apartment for Rent', slug: 'apartment-rent' },
      { name: 'Room / Flatmate', slug: 'room-flatmate' },
    ],
  };
  return map[slug] || [];
}

run().catch(e => { console.error(e); process.exit(1); });
