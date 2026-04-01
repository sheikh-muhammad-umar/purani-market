/* eslint-disable */
// Seed script — run with: node backend/scripts/seed.js
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

const now = new Date();

// ── Categories ──────────────────────────────────────────
const categories = [
  { _id: new ObjectId(), name: 'Vehicles', slug: 'vehicles', level: 1, parentId: null, isActive: true, sortOrder: 0, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Electronics', slug: 'electronics', level: 1, parentId: null, isActive: true, sortOrder: 1, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Property', slug: 'property', level: 1, parentId: null, isActive: true, sortOrder: 2, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Fashion', slug: 'fashion', level: 1, parentId: null, isActive: true, sortOrder: 3, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Furniture', slug: 'furniture', level: 1, parentId: null, isActive: true, sortOrder: 4, attributes: [], filters: [], createdAt: now, updatedAt: now },
];

// Sub-categories
const subCategories = [
  { _id: new ObjectId(), name: 'Cars', slug: 'cars', level: 2, parentId: categories[0]._id, isActive: true, sortOrder: 0,
    attributes: [
      { name: 'Make', key: 'make', type: 'select', options: ['Toyota', 'Honda', 'Suzuki', 'Hyundai', 'KIA', 'BMW', 'Mercedes'], required: true },
      { name: 'Model', key: 'model', type: 'text', required: true },
      { name: 'Year', key: 'year', type: 'number', required: true },
      { name: 'Mileage', key: 'mileage', type: 'number', unit: 'km', required: false },
      { name: 'Fuel Type', key: 'fuel_type', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric'], required: false },
    ],
    filters: [
      { name: 'Make', key: 'make', type: 'select', options: ['Toyota', 'Honda', 'Suzuki', 'Hyundai', 'KIA'] },
      { name: 'Price Range', key: 'price', type: 'range', rangeMin: 0, rangeMax: 50000000 },
      { name: 'Year', key: 'year', type: 'range', rangeMin: 2000, rangeMax: 2026 },
    ],
    createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Motorcycles', slug: 'motorcycles', level: 2, parentId: categories[0]._id, isActive: true, sortOrder: 1, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Mobile Phones', slug: 'mobile-phones', level: 2, parentId: categories[1]._id, isActive: true, sortOrder: 0,
    attributes: [
      { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Oppo', 'Vivo', 'Realme'], required: true },
      { name: 'Storage', key: 'storage', type: 'select', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: true },
      { name: 'RAM', key: 'ram', type: 'select', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'], required: false },
    ],
    filters: [
      { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung', 'Xiaomi', 'OnePlus'] },
      { name: 'Storage', key: 'storage', type: 'multiselect', options: ['64GB', '128GB', '256GB', '512GB'] },
    ],
    createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Laptops', slug: 'laptops', level: 2, parentId: categories[1]._id, isActive: true, sortOrder: 1, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Houses', slug: 'houses', level: 2, parentId: categories[2]._id, isActive: true, sortOrder: 0, attributes: [], filters: [], createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Apartments', slug: 'apartments', level: 2, parentId: categories[2]._id, isActive: true, sortOrder: 1, attributes: [], filters: [], createdAt: now, updatedAt: now },
];

const allCategories = [...categories, ...subCategories];

// ── Users ───────────────────────────────────────────────
const adminId = new ObjectId();
const seller1Id = new ObjectId();
const seller2Id = new ObjectId();
const buyerId = new ObjectId();

const users = [
  {
    _id: adminId, email: 'admin@marketplace.com', passwordHash: hashPassword('admin123'),
    role: 'admin', profile: { firstName: 'Admin', lastName: 'User', avatar: '', location: { type: 'Point', coordinates: [74.35, 31.52] }, city: 'Lahore', postalCode: '54000' },
    emailVerified: true, phoneVerified: false, socialLogins: [], mfa: { enabled: false, failedAttempts: 0 },
    notificationPreferences: { messages: true, offers: true, productUpdates: true, promotions: true, packageAlerts: true },
    deviceTokens: [], adLimit: 10, activeAdCount: 0, status: 'active', createdAt: now, updatedAt: now,
  },
  {
    _id: seller1Id, email: 'ali@example.com', phone: '+923001234567', passwordHash: hashPassword('Testing123'),
    role: 'user', profile: { firstName: 'Ali', lastName: 'Khan', avatar: '', location: { type: 'Point', coordinates: [74.35, 31.52] }, city: 'Lahore', postalCode: '54000' },
    emailVerified: true, phoneVerified: true, socialLogins: [], mfa: { enabled: false, failedAttempts: 0 },
    notificationPreferences: { messages: true, offers: true, productUpdates: true, promotions: false, packageAlerts: true },
    deviceTokens: [], adLimit: 10, activeAdCount: 4, status: 'active', createdAt: now, updatedAt: now,
  },
  {
    _id: seller2Id, email: 'sara@example.com', passwordHash: hashPassword('Testing123'),
    role: 'user', profile: { firstName: 'Sara', lastName: 'Ahmed', avatar: '', location: { type: 'Point', coordinates: [67.0, 24.86] }, city: 'Karachi', postalCode: '75500' },
    emailVerified: true, phoneVerified: false, socialLogins: [], mfa: { enabled: false, failedAttempts: 0 },
    notificationPreferences: { messages: true, offers: true, productUpdates: true, promotions: true, packageAlerts: true },
    deviceTokens: [], adLimit: 10, activeAdCount: 2, status: 'active', createdAt: now, updatedAt: now,
  },
  {
    _id: buyerId, email: 'buyer@example.com', passwordHash: hashPassword('Testing123'),
    role: 'user', profile: { firstName: 'Ahmed', lastName: 'Raza', avatar: '', location: { type: 'Point', coordinates: [73.04, 33.72] }, city: 'Islamabad', postalCode: '44000' },
    emailVerified: true, phoneVerified: false, socialLogins: [], mfa: { enabled: false, failedAttempts: 0 },
    notificationPreferences: { messages: true, offers: true, productUpdates: true, promotions: true, packageAlerts: true },
    deviceTokens: [], adLimit: 10, activeAdCount: 0, status: 'active', createdAt: now, updatedAt: now,
  },
];

// ── Listings ────────────────────────────────────────────
const listings = [
  {
    _id: new ObjectId(), sellerId: seller1Id, title: 'Toyota Corolla 2020 - Excellent Condition',
    description: 'Well-maintained Toyota Corolla GLi 2020 with genuine parts. First owner, no accidents. Full service history available. AC, power windows, power steering all working perfectly.',
    price: { amount: 4500000, currency: 'PKR' }, categoryId: subCategories[0]._id, categoryPath: [categories[0]._id, subCategories[0]._id],
    condition: 'used', categoryAttributes: { make: 'Toyota', model: 'Corolla GLi', year: 2020, mileage: 45000, fuel_type: 'Petrol' },
    images: [
      { url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=300', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=300', sortOrder: 1 },
    ],
    location: { type: 'Point', coordinates: [74.35, 31.52], city: 'Lahore', area: 'DHA Phase 5' },
    contactInfo: { phone: '+923001234567', email: 'ali@example.com' },
    status: 'active', isFeatured: true, featuredUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    viewCount: 234, favoriteCount: 18, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), updatedAt: now,
  },
  {
    _id: new ObjectId(), sellerId: seller1Id, title: 'Honda Civic 2022 - Top of the Line',
    description: 'Honda Civic RS Turbo 2022. Fully loaded with sunroof, leather seats, and Honda Sensing. Only 15,000 km driven. Bank lease transfer available.',
    price: { amount: 8200000, currency: 'PKR' }, categoryId: subCategories[0]._id, categoryPath: [categories[0]._id, subCategories[0]._id],
    condition: 'used', categoryAttributes: { make: 'Honda', model: 'Civic RS Turbo', year: 2022, mileage: 15000, fuel_type: 'Petrol' },
    images: [
      { url: 'https://images.unsplash.com/photo-1606611013016-969c19ba27a5?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1606611013016-969c19ba27a5?w=300', sortOrder: 0 },
    ],
    location: { type: 'Point', coordinates: [74.35, 31.52], city: 'Lahore', area: 'Gulberg III' },
    contactInfo: { phone: '+923001234567', email: 'ali@example.com' },
    status: 'active', isFeatured: false, viewCount: 567, favoriteCount: 42, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), updatedAt: now,
  },
  {
    _id: new ObjectId(), sellerId: seller2Id, title: 'iPhone 15 Pro Max 256GB - Brand New',
    description: 'Brand new iPhone 15 Pro Max, Natural Titanium, 256GB. PTA approved. Complete box with all accessories. Apple warranty valid.',
    price: { amount: 520000, currency: 'PKR' }, categoryId: subCategories[2]._id, categoryPath: [categories[1]._id, subCategories[2]._id],
    condition: 'new', categoryAttributes: { brand: 'Apple', storage: '256GB', ram: '8GB' },
    images: [
      { url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300', sortOrder: 1 },
    ],
    location: { type: 'Point', coordinates: [67.0, 24.86], city: 'Karachi', area: 'Clifton' },
    contactInfo: { phone: '+923009876543', email: 'sara@example.com' },
    status: 'active', isFeatured: true, featuredUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    viewCount: 892, favoriteCount: 67, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), updatedAt: now,
  },
  {
    _id: new ObjectId(), sellerId: seller1Id, title: 'Samsung Galaxy S24 Ultra 512GB',
    description: 'Samsung Galaxy S24 Ultra, Titanium Black, 512GB/12GB RAM. PTA approved. 2 months used, mint condition. With original box and charger.',
    price: { amount: 380000, currency: 'PKR' }, categoryId: subCategories[2]._id, categoryPath: [categories[1]._id, subCategories[2]._id],
    condition: 'used', categoryAttributes: { brand: 'Samsung', storage: '512GB', ram: '12GB' },
    images: [
      { url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=300', sortOrder: 0 },
    ],
    location: { type: 'Point', coordinates: [74.35, 31.52], city: 'Lahore', area: 'Johar Town' },
    contactInfo: { phone: '+923001234567', email: 'ali@example.com' },
    status: 'active', isFeatured: false, viewCount: 345, favoriteCount: 28, createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), updatedAt: now,
  },
  {
    _id: new ObjectId(), sellerId: seller2Id, title: 'MacBook Pro M3 14" - Like New',
    description: 'MacBook Pro 14-inch with M3 chip, 16GB RAM, 512GB SSD. Space Black. Barely used, battery cycle count under 20. AppleCare+ until 2026.',
    price: { amount: 650000, currency: 'PKR' }, categoryId: subCategories[3]._id, categoryPath: [categories[1]._id, subCategories[3]._id],
    condition: 'used', categoryAttributes: {},
    images: [
      { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300', sortOrder: 0 },
    ],
    location: { type: 'Point', coordinates: [67.0, 24.86], city: 'Karachi', area: 'Defence' },
    contactInfo: { phone: '+923009876543', email: 'sara@example.com' },
    status: 'active', isFeatured: false, viewCount: 156, favoriteCount: 12, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), updatedAt: now,
  },
  {
    _id: new ObjectId(), sellerId: seller1Id, title: '10 Marla House in DHA Phase 6',
    description: 'Beautiful 10 Marla house in DHA Phase 6, Lahore. 5 bedrooms, 6 bathrooms, drawing room, lounge, kitchen, servant quarter. Fully furnished with imported fittings.',
    price: { amount: 45000000, currency: 'PKR' }, categoryId: subCategories[4]._id, categoryPath: [categories[2]._id, subCategories[4]._id],
    condition: 'used', categoryAttributes: {},
    images: [
      { url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300', sortOrder: 0 },
      { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300', sortOrder: 1 },
    ],
    location: { type: 'Point', coordinates: [74.38, 31.47], city: 'Lahore', area: 'DHA Phase 6' },
    contactInfo: { phone: '+923001234567', email: 'ali@example.com' },
    status: 'active', isFeatured: true, featuredUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    viewCount: 1023, favoriteCount: 89, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), updatedAt: now,
  },
];

// ── Ad Packages ─────────────────────────────────────────
const packages = [
  { _id: new ObjectId(), name: 'Featured 5', type: 'featured_ads', duration: 7, quantity: 5, defaultPrice: 500, categoryPricing: [], isActive: true, createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Featured 10', type: 'featured_ads', duration: 15, quantity: 10, defaultPrice: 900, categoryPricing: [], isActive: true, createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Featured 20', type: 'featured_ads', duration: 30, quantity: 20, defaultPrice: 1500, categoryPricing: [], isActive: true, createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Ad Slots 10', type: 'ad_slots', duration: 30, quantity: 10, defaultPrice: 800, categoryPricing: [], isActive: true, createdAt: now, updatedAt: now },
  { _id: new ObjectId(), name: 'Ad Slots 25', type: 'ad_slots', duration: 30, quantity: 25, defaultPrice: 1800, categoryPricing: [], isActive: true, createdAt: now, updatedAt: now },
];

// ── Main ────────────────────────────────────────────────
async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');

    // Clear existing data
    await db.collection('categories').deleteMany({});
    await db.collection('users').deleteMany({});
    await db.collection('product_listings').deleteMany({});
    await db.collection('ad_packages').deleteMany({});
    console.log('Cleared existing data');

    // Insert seed data
    await db.collection('categories').insertMany(allCategories);
    console.log(`Inserted ${allCategories.length} categories`);

    await db.collection('users').insertMany(users);
    console.log(`Inserted ${users.length} users`);

    await db.collection('product_listings').insertMany(listings);
    console.log(`Inserted ${listings.length} listings`);

    await db.collection('ad_packages').insertMany(packages);
    console.log(`Inserted ${packages.length} ad packages`);

    // Create indexes (ignore conflicts if backend already created them)
    const indexOps = [
      db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
      db.collection('users').createIndex({ phone: 1 }, { sparse: true }),
      db.collection('categories').createIndex({ slug: 1 }, { unique: true }),
      db.collection('categories').createIndex({ parentId: 1 }),
      db.collection('product_listings').createIndex({ sellerId: 1 }),
      db.collection('product_listings').createIndex({ categoryId: 1 }),
      db.collection('product_listings').createIndex({ status: 1 }),
      db.collection('product_listings').createIndex({ location: '2dsphere' }),
      db.collection('product_listings').createIndex({ isFeatured: -1, createdAt: -1 }),
    ];
    const results = await Promise.allSettled(indexOps);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      console.log(`Created indexes (${failed.length} skipped — already exist with different options)`);
    } else {
      console.log('Created indexes');
    }

    console.log('\n✅ Seed complete! You can now:');
    console.log('   - View data in MongoDB Compass at mongodb://localhost:27017/marketplace');
    console.log('   - Login as admin: admin@marketplace.com / admin123');
    console.log('   - Login as user: ali@example.com / Testing123');
    console.log('   - Login as user: buyer@example.com / Testing123');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
