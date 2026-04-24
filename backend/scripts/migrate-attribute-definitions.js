/**
 * Migration script: Extract all unique attributes from existing categories
 * and populate the attribute_definitions collection.
 *
 * Usage: node scripts/migrate-attribute-definitions.js
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const categories = db.collection('categories');
    const definitions = db.collection('attribute_definitions');

    // Gather all unique attributes by key from every category
    const allCats = await categories.find({}, { projection: { attributes: 1 } }).toArray();
    const keyMap = new Map();

    for (const cat of allCats) {
      for (const attr of cat.attributes || []) {
        if (!attr.key) continue;
        if (!keyMap.has(attr.key)) {
          keyMap.set(attr.key, {
            name: attr.name,
            key: attr.key,
            type: attr.type || 'text',
            options: attr.options || [],
            unit: attr.unit || undefined,
            rangeMin: attr.rangeMin ?? undefined,
            rangeMax: attr.rangeMax ?? undefined,
            allowOther: attr.allowOther || false,
          });
        } else {
          // Merge options from different categories (union)
          const existing = keyMap.get(attr.key);
          if (attr.options?.length) {
            const merged = new Set([...(existing.options || []), ...attr.options]);
            existing.options = Array.from(merged);
          }
        }
      }
    }

    if (keyMap.size === 0) {
      console.log('No attributes found in categories. Nothing to migrate.');
      return;
    }

    console.log(`Found ${keyMap.size} unique attribute keys across all categories.`);

    // Insert into attribute_definitions (skip duplicates)
    let inserted = 0;
    let skipped = 0;
    const now = new Date();

    for (const def of keyMap.values()) {
      const exists = await definitions.findOne({ key: def.key });
      if (exists) {
        skipped++;
        continue;
      }
      await definitions.insertOne({
        ...def,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }

    console.log(`Migration complete: ${inserted} inserted, ${skipped} already existed.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
