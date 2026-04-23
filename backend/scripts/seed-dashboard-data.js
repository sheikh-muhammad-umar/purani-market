/* eslint-disable */
// Seed dashboard analytics data — run with: node backend/scripts/seed-dashboard-data.js
// This populates user_activities with realistic data for all dashboard sections.
// It does NOT clear existing data — it only inserts new activity records.

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const now = new Date();
const DAY = 86400000;

function daysAgo(n) {
  return new Date(now.getTime() - n * DAY);
}

function hoursAgo(n) {
  return new Date(now.getTime() - n * 3600000);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');

    // Fetch existing users, listings, categories
    const users = await db.collection('users').find({}).toArray();
    const listings = await db.collection('product_listings').find({}).toArray();
    const categories = await db.collection('categories').find({}).toArray();

    if (!users.length || !listings.length || !categories.length) {
      console.error('No users/listings/categories found. Run seed.js first.');
      process.exit(1);
    }

    const userIds = users.map(u => u._id);
    const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'super_admin');
    const regularUsers = users.filter(u => u.role === 'user');
    const listingIds = listings.map(l => l._id);
    const categoryIds = categories.filter(c => c.level >= 2).map(c => c._id);
    const categoryMap = new Map(categories.map(c => [c._id.toString(), c.name]));

    const activities = [];
    const devices = ['desktop', 'mobile', 'tablet'];
    const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
    const cities = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];
    const searchTerms = [
      'toyota corolla', 'iphone 15', 'honda civic', 'samsung galaxy',
      'macbook pro', 'suzuki alto', 'apartment lahore', 'house dha',
      'laptop dell', 'motorcycle yamaha', 'furniture sofa', 'ac inverter',
      'plot bahria town', 'camera canon', 'ps5', 'ipad pro',
      'washing machine', 'generator', 'bicycle', 'gold ring',
    ];
    const platforms = ['ios', 'android', 'huawei'];

    function makeMetadata(extra = {}) {
      return {
        deviceType: pick(devices),
        browser: pick(browsers),
        os: pick(['Windows', 'macOS', 'iOS', 'Android', 'Linux']),
        ...extra,
      };
    }

    // ── 1. Views (auth + guest) ─────────────────────────────
    console.log('Generating view events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(15, 50);
      for (let i = 0; i < count; i++) {
        const isGuest = Math.random() < 0.6;
        const listing = pick(listings);
        activities.push({
          userId: isGuest ? undefined : pick(userIds),
          action: 'view',
          productListingId: listing._id,
          categoryId: listing.categoryId,
          metadata: makeMetadata({ title: listing.title }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 2. Searches (auth + guest) ──────────────────────────
    console.log('Generating search events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(8, 25);
      for (let i = 0; i < count; i++) {
        const isGuest = Math.random() < 0.5;
        activities.push({
          userId: isGuest ? undefined : pick(userIds),
          action: 'search',
          searchQuery: pick(searchTerms),
          metadata: makeMetadata(),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 3. Category Browse (auth + guest) ───────────────────
    console.log('Generating category browse events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(5, 15);
      for (let i = 0; i < count; i++) {
        const isGuest = Math.random() < 0.55;
        const catId = pick(categoryIds);
        activities.push({
          userId: isGuest ? undefined : pick(userIds),
          action: 'category_browse',
          categoryId: catId,
          metadata: makeMetadata({ name: categoryMap.get(catId.toString()) }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 4. Page Views (auth + guest) ────────────────────────
    console.log('Generating page view events...');
    const pages = ['/home', '/search', '/categories', '/listings', '/profile', '/packages'];
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(10, 30);
      for (let i = 0; i < count; i++) {
        const isGuest = Math.random() < 0.65;
        activities.push({
          userId: isGuest ? undefined : pick(userIds),
          action: 'page_view',
          metadata: makeMetadata({ page: pick(pages) }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 5. Favorites / Unfavorites ──────────────────────────
    console.log('Generating favorite events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(3, 10);
      for (let i = 0; i < count; i++) {
        const listing = pick(listings);
        const userId = pick(regularUsers.length ? regularUsers.map(u => u._id) : userIds);
        activities.push({
          userId,
          action: 'favorite',
          productListingId: listing._id,
          metadata: makeMetadata({ title: listing.title, previousState: 'unfavorited', newState: 'favorited' }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
        if (Math.random() < 0.3) {
          activities.push({
            userId,
            action: 'unfavorite',
            productListingId: listing._id,
            metadata: makeMetadata({ previousState: 'favorited', newState: 'unfavorited' }),
            createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
            updatedAt: now,
          });
        }
      }
    }

    // ── 6. Login / Logout ───────────────────────────────────
    console.log('Generating login/logout events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(5, 15);
      for (let i = 0; i < count; i++) {
        const userId = pick(userIds);
        activities.push({
          userId,
          action: 'login',
          metadata: makeMetadata({ method: pick(['email', 'phone']) }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
        if (Math.random() < 0.5) {
          activities.push({
            userId,
            action: 'logout',
            metadata: makeMetadata(),
            createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
            updatedAt: now,
          });
        }
      }
    }

    // ── 7. Login Failures ───────────────────────────────────
    console.log('Generating login failure events...');
    for (let d = 0; d < 14; d++) {
      const count = randomBetween(2, 12);
      for (let i = 0; i < count; i++) {
        activities.push({
          action: 'login_failed',
          metadata: makeMetadata({
            identifier: pick(['test@test.com', 'hacker@evil.com', 'forgot@pass.com', '+923001111111', 'admin@marketplace.com']),
            reason: pick(['invalid_password', 'user_not_found', 'account_locked']),
          }),
          ip: `192.168.${randomBetween(1, 255)}.${randomBetween(1, 255)}`,
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 8. Listing Create / Edit / Delete / Status Change ───
    console.log('Generating listing action events...');
    for (let d = 0; d < 30; d++) {
      // Creates
      const creates = randomBetween(1, 4);
      for (let i = 0; i < creates; i++) {
        const listing = pick(listings);
        activities.push({
          userId: pick(regularUsers.length ? regularUsers.map(u => u._id) : userIds),
          action: 'listing_create',
          productListingId: listing._id,
          categoryId: listing.categoryId,
          metadata: makeMetadata({ title: listing.title, condition: listing.condition }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
      // Edits
      if (Math.random() < 0.6) {
        const listing = pick(listings);
        activities.push({
          userId: listing.sellerId,
          action: 'listing_edit',
          productListingId: listing._id,
          categoryId: listing.categoryId,
          metadata: makeMetadata({
            title: listing.title,
            changes: { price: { from: listing.price.amount, to: listing.price.amount + randomBetween(-50000, 50000) } },
          }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
      // Status changes
      if (Math.random() < 0.3) {
        const listing = pick(listings);
        const statuses = ['active', 'sold', 'reserved', 'inactive'];
        const prev = pick(statuses);
        const next = pick(statuses.filter(s => s !== prev));
        activities.push({
          userId: listing.sellerId,
          action: 'listing_status_change',
          productListingId: listing._id,
          metadata: makeMetadata({ title: listing.title, previousStatus: prev, newStatus: next }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 9. Price Changes (for Price Trends section) ─────────
    console.log('Generating price change events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(2, 8);
      for (let i = 0; i < count; i++) {
        const listing = pick(listings);
        const catId = listing.categoryId;
        const catName = categoryMap.get(catId?.toString()) || 'Unknown';
        const oldPrice = listing.price.amount;
        const direction = Math.random() < 0.55 ? 1 : -1; // slight bias toward increases
        const changeAmt = randomBetween(5000, Math.max(10000, Math.round(oldPrice * 0.15)));
        const newPrice = Math.max(1000, oldPrice + direction * changeAmt);
        activities.push({
          userId: listing.sellerId,
          action: 'listing_price_change',
          productListingId: listing._id,
          categoryId: catId,
          metadata: makeMetadata({
            title: listing.title,
            categoryName: catName,
            condition: listing.condition,
            previousPrice: oldPrice,
            newPrice: newPrice,
            priceDiff: newPrice - oldPrice,
            city: listing.location?.city || 'Unknown',
          }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 10. Messages / Conversations ────────────────────────
    console.log('Generating messaging events...');
    for (let d = 0; d < 30; d++) {
      const count = randomBetween(2, 8);
      for (let i = 0; i < count; i++) {
        const listing = pick(listings);
        const userId = pick(regularUsers.length ? regularUsers.map(u => u._id) : userIds);
        if (Math.random() < 0.4) {
          activities.push({
            userId,
            action: 'conversation_start',
            productListingId: listing._id,
            metadata: makeMetadata({ title: listing.title }),
            createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
            updatedAt: now,
          });
        }
        activities.push({
          userId,
          action: 'message_sent',
          productListingId: listing._id,
          metadata: makeMetadata({ conversationId: new ObjectId().toString() }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 11. Share / Contact ─────────────────────────────────
    console.log('Generating share/contact events...');
    for (let d = 0; d < 30; d++) {
      if (Math.random() < 0.5) {
        const listing = pick(listings);
        activities.push({
          userId: pick(userIds),
          action: 'share',
          productListingId: listing._id,
          metadata: makeMetadata({ title: listing.title }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
      if (Math.random() < 0.4) {
        const listing = pick(listings);
        activities.push({
          userId: pick(userIds),
          action: 'contact',
          productListingId: listing._id,
          metadata: makeMetadata({ title: listing.title }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 12. Package Purchase / Payment Attempt ──────────────
    console.log('Generating payment events...');
    for (let d = 0; d < 30; d++) {
      if (Math.random() < 0.35) {
        activities.push({
          userId: pick(regularUsers.length ? regularUsers.map(u => u._id) : userIds),
          action: 'package_purchase',
          metadata: makeMetadata({
            packageName: pick(['Featured 5', 'Featured 10', 'Ad Slots 10']),
            amount: pick([500, 900, 1500, 800]),
            paymentMethod: pick(['jazzcash', 'easypaisa', 'card']),
          }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
      if (Math.random() < 0.25) {
        activities.push({
          userId: pick(userIds),
          action: 'payment_attempt',
          metadata: makeMetadata({
            paymentMethod: pick(['jazzcash', 'easypaisa', 'card']),
            status: pick(['success', 'failed', 'pending']),
          }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── 13. App Banner Events ───────────────────────────────
    console.log('Generating app banner events...');
    for (let d = 0; d < 30; d++) {
      const shownCount = randomBetween(5, 20);
      for (let i = 0; i < shownCount; i++) {
        const platform = pick(platforms);
        activities.push({
          action: 'app_banner_shown',
          metadata: { deviceType: 'mobile', platform },
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
        if (Math.random() < 0.15) {
          activities.push({
            action: 'app_banner_click',
            metadata: { deviceType: 'mobile', platform },
            createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
            updatedAt: now,
          });
        }
        if (Math.random() < 0.25) {
          activities.push({
            action: 'app_banner_dismiss',
            metadata: { deviceType: 'mobile', platform },
            createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
            updatedAt: now,
          });
        }
      }
    }

    // ── 14. Location Change ─────────────────────────────────
    console.log('Generating location change events...');
    for (let d = 0; d < 30; d++) {
      if (Math.random() < 0.3) {
        const prev = pick(cities);
        const next = pick(cities.filter(c => c !== prev));
        activities.push({
          userId: pick(userIds),
          action: 'location_change',
          metadata: makeMetadata({ previousLocation: prev, newLocation: next }),
          createdAt: new Date(daysAgo(d).getTime() + randomBetween(0, DAY)),
          updatedAt: now,
        });
      }
    }

    // ── Insert all ──────────────────────────────────────────
    console.log(`\nInserting ${activities.length} activity records...`);
    // Insert in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      await db.collection('user_activities').insertMany(batch);
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(activities.length / batchSize)}`);
    }

    console.log(`\n✅ Dashboard seed complete!`);
    console.log(`   Total activities: ${activities.length}`);
    console.log(`   Date range: last 30 days`);
    console.log(`   Sections covered:`);
    console.log(`     - Views, Searches, Category Browse, Page Views (guest + auth)`);
    console.log(`     - Favorites / Unfavorites`);
    console.log(`     - Login / Logout / Login Failures`);
    console.log(`     - Listing Create / Edit / Status Change`);
    console.log(`     - Price Changes (per category)`);
    console.log(`     - Messages / Conversations`);
    console.log(`     - Share / Contact`);
    console.log(`     - Package Purchase / Payment Attempt`);
    console.log(`     - App Banner (shown / click / dismiss)`);
    console.log(`     - Location Change`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
