/**
 * Promote an existing admin user to super_admin.
 * Usage: node scripts/promote-super-admin.js <email>
 * Example: node scripts/promote-super-admin.js admin@marketplace.com
 */
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/promote-super-admin.js <email>');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const result = await db.collection('users').findOneAndUpdate(
    { email },
    { $set: { role: 'super_admin', permissions: [] } },
    { returnDocument: 'after' },
  );

  if (!result) {
    console.error(`User with email "${email}" not found.`);
  } else {
    console.log(`✅ ${result.email} promoted to super_admin`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
