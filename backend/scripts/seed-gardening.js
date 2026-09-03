/* eslint-disable */
// Additive seed for the "Gardening" category tree.
//
// Unlike seed-categories-full.js (which wipes the whole categories collection),
// this script is NON-destructive and idempotent: it inserts the Gardening
// top-level category and its subcategories only if they don't already exist,
// matching by slug. Safe to run against a populated database.
//
//   node scripts/seed-gardening.js
//   MONGODB_URI="mongodb://..." node scripts/seed-gardening.js
const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

// Icon file must exist at web/public/assets/category-icons/<icon>.
const gardening = {
  name: 'Gardening',
  slug: 'gardening',
  icon: 'gardening.png',
  sortOrder: 15,
  // Shared across every gardening subcategory (inherited). Children must NOT
  // reuse these keys.
  attributes: [
    { name: 'Condition', key: 'condition_detail', type: 'select', options: ['New', 'Like New', 'Used', 'Needs Repair'], required: false },
  ],
  children: [
    {
      name: 'Plants & Trees', slug: 'plants-trees', sortOrder: 1,
      attributes: [
        { name: 'Plant Type', key: 'plant_type', type: 'select', options: ['Indoor', 'Outdoor', 'Flowering', 'Fruit', 'Succulent & Cactus', 'Herb', 'Bonsai', 'Climber', 'Shrub', 'Tree', 'Other'], required: true },
        { name: 'Height', key: 'plant_height', type: 'number', unit: 'in', required: false },
        { name: 'Sunlight', key: 'sunlight', type: 'select', options: ['Full Sun', 'Partial Sun', 'Shade', 'Indoor Light'], required: false },
        { name: 'Color', key: 'color', type: 'text', required: false },
      ],
      features: ['Potted', 'With Soil', 'Organic', 'Air Purifying', 'Low Maintenance', 'Pet Friendly', 'Flowering'],
    },
    {
      name: 'Seeds & Bulbs', slug: 'seeds-bulbs', sortOrder: 2,
      attributes: [
        { name: 'Seed Type', key: 'seed_type', type: 'select', options: ['Vegetable', 'Fruit', 'Flower', 'Herb', 'Grass/Lawn', 'Tree', 'Bulb', 'Mixed'], required: true },
        { name: 'Quantity', key: 'quantity', type: 'text', required: false },
      ],
      features: ['Organic', 'Non-GMO', 'Hybrid', 'Sealed Pack', 'Imported', 'High Germination'],
    },
    {
      name: 'Garden Tools', slug: 'garden-tools', sortOrder: 3,
      attributes: [
        { name: 'Tool Type', key: 'tool_type', type: 'select', options: ['Shovel & Spade', 'Rake', 'Pruner & Shears', 'Trowel', 'Hoe', 'Watering Can', 'Wheelbarrow', 'Lawn Mower', 'Hedge Trimmer', 'Leaf Blower', 'Tool Set', 'Other'], required: true },
        { name: 'Power Source', key: 'power_source', type: 'select', options: ['Manual', 'Electric', 'Battery', 'Petrol'], required: false },
        { name: 'Brand', key: 'brand', type: 'text', required: false },
      ],
      features: ['Branded', 'Imported', 'Rust Proof', 'Ergonomic Handle', 'Cordless', 'With Warranty'],
    },
    {
      name: 'Pots & Planters', slug: 'pots-planters', sortOrder: 4,
      attributes: [
        { name: 'Material', key: 'pot_material', type: 'select', options: ['Plastic', 'Clay/Terracotta', 'Ceramic', 'Cement', 'Fiberglass', 'Metal', 'Wood', 'Hanging'], required: false },
        { name: 'Size', key: 'pot_size', type: 'select', options: ['Small', 'Medium', 'Large', 'Extra Large'], required: false },
      ],
      features: ['With Drainage', 'With Saucer', 'Self Watering', 'Set', 'Decorative', 'Frost Resistant'],
    },
    {
      name: 'Soil & Fertilizers', slug: 'soil-fertilizers', sortOrder: 5,
      attributes: [
        { name: 'Type', key: 'soil_type', type: 'select', options: ['Potting Mix', 'Compost', 'Organic Fertilizer', 'Chemical Fertilizer', 'Vermicompost', 'Peat Moss', 'Cocopeat', 'Manure', 'Perlite'], required: true },
        { name: 'Weight', key: 'weight', type: 'number', unit: 'kg', required: false },
      ],
      features: ['Organic', 'Chemical Free', 'Slow Release', 'Sealed Pack', 'All Purpose', 'Bulk Available'],
    },
    {
      name: 'Irrigation & Watering', slug: 'irrigation-watering', sortOrder: 6,
      attributes: [
        { name: 'Type', key: 'irrigation_type', type: 'select', options: ['Drip System', 'Sprinkler', 'Garden Hose', 'Watering Can', 'Nozzle', 'Timer', 'Water Pump', 'Other'], required: false },
      ],
      features: ['Automatic', 'Adjustable', 'Weather Resistant', 'Complete Kit', 'Water Saving'],
    },
    {
      name: 'Pest & Weed Control', slug: 'pest-weed-control', sortOrder: 7,
      attributes: [
        { name: 'Type', key: 'control_type', type: 'select', options: ['Insecticide', 'Fungicide', 'Herbicide', 'Organic Spray', 'Trap', 'Net', 'Repellent'], required: false },
      ],
      features: ['Organic', 'Pet Safe', 'Ready to Use', 'Concentrate', 'Odorless'],
    },
    {
      name: 'Outdoor & Garden Decor', slug: 'garden-decor', sortOrder: 8,
      attributes: [
        { name: 'Type', key: 'decor_type', type: 'select', options: ['Garden Statue', 'Fountain', 'Solar Light', 'Wind Chime', 'Bird Feeder', 'Artificial Grass', 'Garden Arch', 'Stepping Stone', 'Other'], required: false },
      ],
      features: ['Weather Resistant', 'Solar Powered', 'Handmade', 'Set', 'LED', 'Rust Proof'],
    },
    {
      name: 'Greenhouses & Sheds', slug: 'greenhouses-sheds', sortOrder: 9,
      features: ['Foldable', 'UV Protected', 'Walk-In', 'With Shelves', 'Weatherproof'],
    },
    { name: 'Other Gardening', slug: 'other-gardening', sortOrder: 10 },
  ],
};

function toDoc(node, parentId, level) {
  return {
    name: node.name,
    slug: node.slug,
    icon: node.icon || '',
    hasBrands: node.hasBrands || false,
    parentId,
    level,
    isActive: true,
    sortOrder: node.sortOrder || 1,
    attributes: (node.attributes || []).map((a) => ({
      ...a,
      options: a.options || [],
      required: a.required || false,
      allowOther: a.allowOther || false,
    })),
    features: node.features || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col = client.db().collection('categories');

    let inserted = 0;
    let skipped = 0;

    // insertIfAbsent returns the id of the (existing or new) category so
    // children can link to the right parent even on a partial re-run.
    async function insertIfAbsent(node, parentId, level) {
      const existing = await col.findOne({ slug: node.slug });
      let id;
      if (existing) {
        id = existing._id;
        skipped++;
        console.log(`skip  (exists) L${level}  ${node.slug}`);
      } else {
        const res = await col.insertOne(toDoc(node, parentId, level));
        id = res.insertedId;
        inserted++;
        console.log(`insert         L${level}  ${node.slug}`);
      }
      for (const child of node.children || []) {
        await insertIfAbsent(child, id, level + 1);
      }
      return id;
    }

    await insertIfAbsent(gardening, null, 1);

    console.log(`\nDone. inserted=${inserted}, skipped=${skipped}`);

    // Best-effort cache clear so the new tree shows up immediately.
    try {
      const Redis = require('ioredis');
      const redis = new Redis(process.env.REDIS_URL || undefined);
      await redis.del('categories:tree');
      await redis.quit();
      console.log('Cleared Redis categories:tree cache');
    } catch (e) {
      console.log('Redis cache clear skipped:', e.message);
    }
  } finally {
    await client.close();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
