const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

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
  // All-in-one bundles. `type: 'bundle'` with an explicit entitlement list, since
  // one `quantity` cannot describe a package that grants three different things.
  {
    name: 'All in One Starter',
    type: 'bundle',
    duration: 30,
    quantity: 13,
    entitlements: [
      { kind: 'ad_slots', quantity: 10 },
      { kind: 'featured_ads', quantity: 2 },
      { kind: 'shorts', quantity: 1 },
    ],
    defaultPrice: 1800,
    categoryPricing: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'All in One Pro',
    type: 'bundle',
    duration: 30,
    quantity: 40,
    entitlements: [
      { kind: 'ad_slots', quantity: 25 },
      { kind: 'featured_ads', quantity: 10 },
      { kind: 'shorts', quantity: 5 },
    ],
    defaultPrice: 4500,
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
