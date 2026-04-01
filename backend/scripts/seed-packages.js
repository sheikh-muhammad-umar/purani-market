const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const packages = [
  // Featured Ads packages
  {
    name: 'Featured Starter',
    type: 'featured_ads',
    duration: 7,
    quantity: 3,
    defaultPrice: 500,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Featured Plus',
    type: 'featured_ads',
    duration: 15,
    quantity: 5,
    defaultPrice: 900,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Featured Pro',
    type: 'featured_ads',
    duration: 30,
    quantity: 10,
    defaultPrice: 1500,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Ad Slots packages
  {
    name: 'Extra Slots Basic',
    type: 'ad_slots',
    duration: 30,
    quantity: 5,
    defaultPrice: 300,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Extra Slots Standard',
    type: 'ad_slots',
    duration: 30,
    quantity: 15,
    defaultPrice: 700,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Extra Slots Premium',
    type: 'ad_slots',
    duration: 30,
    quantity: 50,
    defaultPrice: 2000,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('ad_packages');

    const existing = await col.countDocuments();
    if (existing > 0) {
      console.log(`Already ${existing} packages in DB. Skipping seed.`);
      return;
    }

    const result = await col.insertMany(packages);
    console.log(`Seeded ${result.insertedCount} packages.`);
  } finally {
    await client.close();
  }
}

seed().catch(console.error);
