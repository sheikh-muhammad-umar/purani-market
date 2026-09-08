const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

/**
 * All-in-one tiers, one package per term.
 *
 * `type: 'bundle'` with an explicit entitlement list, since one `quantity` cannot
 * describe a package granting three different things — and all three are required,
 * so a tier that left one out would be rejected by the API.
 *
 * Prices are listed per term rather than scaled from a monthly rate, so the longer
 * terms come out as round numbers that read like a discount.
 */
const BUNDLE_TIERS = [
  {
    label: 'Starter',
    entitlements: [
      { kind: 'ad_slots', quantity: 10 },
      { kind: 'featured_ads', quantity: 2 },
      { kind: 'shorts', quantity: 1 },
    ],
    pricePerDuration: { 7: 600, 15: 1100, 30: 1800, 60: 3200, 90: 4500 },
  },
  {
    label: 'Pro',
    entitlements: [
      { kind: 'ad_slots', quantity: 25 },
      { kind: 'featured_ads', quantity: 10 },
      { kind: 'shorts', quantity: 5 },
    ],
    pricePerDuration: { 7: 1500, 15: 2700, 30: 4500, 60: 8000, 90: 11000 },
  },
];

/** Terms all-in-one packages are sold on. Mirrors BUNDLE_PACKAGE_DURATIONS. */
const BUNDLE_DURATIONS = (process.env.BUNDLE_PACKAGE_DURATIONS || '7,15,30,60,90')
  .split(',')
  .map((d) => parseInt(d.trim(), 10))
  .filter((d) => d > 0);

function buildBundles() {
  const now = new Date();
  return BUNDLE_TIERS.flatMap((tier) =>
    BUNDLE_DURATIONS.filter((duration) => tier.pricePerDuration[duration] !== undefined).map(
      (duration) => ({
        name: `All in One ${tier.label} - ${duration} Days`,
        type: 'bundle',
        duration,
        // Headline figure only; spending is tracked per entitlement.
        quantity: tier.entitlements.reduce((sum, e) => sum + e.quantity, 0),
        entitlements: tier.entitlements.map((e) => ({ ...e })),
        defaultPrice: tier.pricePerDuration[duration],
        categoryPricing: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );
}

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
  ...buildBundles(),
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
