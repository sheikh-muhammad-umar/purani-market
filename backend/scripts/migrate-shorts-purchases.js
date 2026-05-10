/**
 * Migration script: Merge shorts_package_purchases into package_purchases
 *
 * This script copies all documents from the `shorts_package_purchases` collection
 * into the unified `package_purchases` collection with the `purchaseType: 'shorts'`
 * discriminator field, mapping field names to the unified schema.
 *
 * Run: node scripts/migrate-shorts-purchases.js
 *
 * After verifying the migration, you can drop the old collection:
 *   db.shorts_package_purchases.drop()
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    const oldCollection = db.collection('shorts_package_purchases');
    const newCollection = db.collection('package_purchases');

    const count = await oldCollection.countDocuments();
    console.log(
      `Found ${count} documents in shorts_package_purchases to migrate`,
    );

    if (count === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    const cursor = oldCollection.find({});
    let migrated = 0;
    let skipped = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();

      // Check if already migrated (by original _id)
      const existing = await newCollection.findOne({ _id: doc._id });
      if (existing) {
        skipped++;
        continue;
      }

      // Map fields to unified schema
      const unified = {
        _id: doc._id,
        purchaseType: 'shorts',
        sellerId: doc.sellerId,
        packageId: doc.packageId,
        quantity: doc.quantity,
        remainingQuantity: doc.remainingQuantity,
        duration: doc.duration,
        price: doc.amountPaid, // renamed: amountPaid → price
        paymentMethod: doc.paymentMethod,
        paymentStatus: doc.paymentStatus,
        paymentTransactionId: doc.transactionId || null, // renamed: transactionId → paymentTransactionId
        activatedAt:
          doc.paymentStatus === 'completed' ? doc.createdAt : null,
        expiresAt: doc.expiresAt || null,
        currency: doc.currency,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };

      await newCollection.insertOne(unified);
      migrated++;
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped (already exist)`);
    console.log(
      '\nTo drop the old collection after verifying:\n  db.shorts_package_purchases.drop()',
    );
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
