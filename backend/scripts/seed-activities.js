/* eslint-disable */
// Seed script for user activities with previous/new state tracking
// Run with: node backend/scripts/seed-activities.js
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const searchQueries = [
  'Toyota Corolla 2020', 'iPhone 15 Pro', 'Samsung Galaxy S24', '5 Marla House DHA',
  'Honda Civic', 'MacBook Air M2', 'Plot Bahria Town', 'Suzuki Alto 2023',
  'Dell Laptop i7', '10 Marla House Lahore', 'furniture sofa', 'AC inverter 1.5 ton',
  'motorcycle Honda 125', 'apartment Karachi', 'gaming PC', 'washing machine',
  'Toyota Yaris', 'Xiaomi 14', 'land for sale', 'room for rent Islamabad',
];

const cities = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala'];
const ips = ['192.168.1.10', '103.25.140.5', '39.32.10.88', '182.176.45.12', '119.160.70.33', '203.99.55.21', '58.65.178.44'];
const userAgents = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/119.0.0.0 Mobile Safari/537.36',
];
const statuses = ['active', 'sold', 'reserved', 'inactive'];
const pages = ['/search', '/', '/categories', '/packages', '/profile', '/favorites', '/pages/about', '/pages/terms', '/pages/privacy', '/pages/contact', '/pages/selling-tips', '/pages/trust-safety'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDate(daysBack) { return new Date(Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000); }

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();

    const users = await db.collection('users').find({}).limit(20).toArray();
    const listings = await db.collection('product_listings').find({}).limit(50).toArray();
    const categories = await db.collection('categories').find({}).limit(20).toArray();

    if (users.length === 0) { console.log('No users found.'); return; }
    console.log(`Found ${users.length} users, ${listings.length} listings, ${categories.length} categories`);

    // Drop old test activities
    const deleted = await db.collection('user_activities').deleteMany({});
    console.log(`Cleared ${deleted.deletedCount} old activities`);

    const activities = [];

    for (const user of users) {
      const uid = user._id;
      const numEvents = randomInt(80, 150);

      for (let i = 0; i < numEvents; i++) {
        const createdAt = randomDate(30);
        const ip = randomItem(ips);
        const ua = randomItem(userAgents);
        const listing = listings.length > 0 ? randomItem(listings) : null;
        const category = categories.length > 0 ? randomItem(categories) : null;

        const base = { _id: new ObjectId(), userId: uid, createdAt, updatedAt: createdAt, ip, userAgent: ua };

        // Weighted random action selection
        const roll = Math.random();
        let activity;

        if (roll < 0.20) {
          // VIEW — most common
          activity = { ...base, action: 'view',
            productListingId: listing?._id,
            categoryId: listing?.categoryId || category?._id,
            metadata: { title: listing?.title, city: listing?.location?.city || randomItem(cities), price: listing?.price?.amount, source: randomItem(['search', 'homepage', 'category', 'recommendation', 'direct']) },
          };
        } else if (roll < 0.35) {
          // SEARCH
          activity = { ...base, action: 'search',
            searchQuery: randomItem(searchQueries),
            categoryId: category?._id,
            metadata: { resultsCount: randomInt(0, 200), page: randomInt(1, 5), sort: randomItem(['relevance', 'price_asc', 'price_desc', 'newest']), filters: randomItem([null, { condition: 'used' }, { minPrice: 50000 }, { maxPrice: 500000 }]) },
          };
        } else if (roll < 0.42) {
          // FAVORITE
          activity = { ...base, action: 'favorite',
            productListingId: listing?._id,
            metadata: { title: listing?.title, previousState: 'unfavorited', newState: 'favorited' },
          };
        } else if (roll < 0.47) {
          // UNFAVORITE
          activity = { ...base, action: 'unfavorite',
            productListingId: listing?._id,
            metadata: { previousState: 'favorited', newState: 'unfavorited' },
          };
        } else if (roll < 0.54) {
          // CONTACT
          const contactType = randomItem(['message', 'call']);
          activity = { ...base, action: 'contact',
            productListingId: listing?._id,
            metadata: { type: contactType, title: listing?.title },
          };
        } else if (roll < 0.60) {
          // CATEGORY BROWSE
          activity = { ...base, action: 'category_browse',
            categoryId: category?._id,
            metadata: { name: category?.name, level: category?.level },
          };
        } else if (roll < 0.66) {
          // PAGE VIEW
          activity = { ...base, action: 'page_view',
            metadata: { page: randomItem(pages), referrer: randomItem(['direct', 'google', 'facebook', 'internal']) },
          };
        } else if (roll < 0.71) {
          // LISTING STATUS CHANGE
          const prev = randomItem(statuses);
          let next = randomItem(statuses);
          while (next === prev) next = randomItem(statuses);
          activity = { ...base, action: 'listing_status_change',
            productListingId: listing?._id,
            metadata: { title: listing?.title, previousStatus: prev, newStatus: next },
          };
        } else if (roll < 0.75) {
          // LISTING CREATE
          activity = { ...base, action: 'listing_create',
            productListingId: listing?._id,
            categoryId: listing?.categoryId || category?._id,
            metadata: { title: listing?.title, price: listing?.price?.amount, city: listing?.location?.city || randomItem(cities), condition: randomItem(['new', 'used', 'refurbished']) },
          };
        } else if (roll < 0.78) {
          // LISTING EDIT
          const oldPrice = randomInt(10000, 500000);
          const newPrice = oldPrice + randomInt(-50000, 50000);
          activity = { ...base, action: 'listing_edit',
            productListingId: listing?._id,
            metadata: { title: listing?.title, changes: { price: { from: oldPrice, to: Math.max(1000, newPrice) } } },
          };
        } else if (roll < 0.80) {
          // LISTING DELETE
          activity = { ...base, action: 'listing_delete',
            productListingId: listing?._id,
            metadata: { previousStatus: randomItem(statuses) },
          };
        } else if (roll < 0.83) {
          // LISTING FEATURE
          activity = { ...base, action: 'listing_feature',
            productListingId: listing?._id,
            metadata: { title: listing?.title, previousFeatured: false, newFeatured: true },
          };
        } else if (roll < 0.87) {
          // MESSAGE SENT
          activity = { ...base, action: 'message_sent',
            productListingId: listing?._id,
            metadata: { conversationId: new ObjectId().toString(), listingTitle: listing?.title },
          };
        } else if (roll < 0.89) {
          // CONVERSATION START
          activity = { ...base, action: 'conversation_start',
            productListingId: listing?._id,
            metadata: { listingTitle: listing?.title, sellerName: 'Seller' },
          };
        } else if (roll < 0.92) {
          // LOGIN
          activity = { ...base, action: 'login',
            metadata: { method: randomItem(['email', 'phone', 'google']), device: randomItem(['mobile', 'desktop', 'tablet']) },
          };
        } else if (roll < 0.93) {
          // LOGOUT
          activity = { ...base, action: 'logout', metadata: {} };
        } else if (roll < 0.95) {
          // LOCATION CHANGE
          const prevLoc = randomItem(cities);
          let newLoc = randomItem(cities);
          while (newLoc === prevLoc) newLoc = randomItem(cities);
          activity = { ...base, action: 'location_change',
            metadata: { previousLocation: prevLoc, newLocation: newLoc, source: randomItem(['header', 'search_filter', 'create_listing']) },
          };
        } else if (roll < 0.97) {
          // PACKAGE PURCHASE
          const amount = randomItem([500, 1000, 1500, 2000, 3000, 5000]);
          activity = { ...base, action: 'package_purchase',
            metadata: { packageType: randomItem(['featured_ads', 'ad_slots']), packageName: randomItem(['Basic', 'Premium', 'Pro']), amount, paymentMethod: randomItem(['jazzcash', 'easypaisa', 'card']) },
          };
        } else if (roll < 0.99) {
          // PAYMENT ATTEMPT
          activity = { ...base, action: 'payment_attempt',
            metadata: { amount: randomItem([500, 1000, 2000, 3000]), paymentMethod: randomItem(['jazzcash', 'easypaisa', 'card']), status: randomItem(['completed', 'failed', 'pending']) },
          };
        } else {
          // RECOMMENDATION CLICK
          activity = { ...base, action: 'recommendation_click',
            productListingId: listing?._id,
            metadata: { title: listing?.title, source: randomItem(['homepage', 'listing_detail']) },
          };
        }

        activities.push(activity);
      }
    }

    // Shuffle for realistic timeline
    activities.sort(() => Math.random() - 0.5);

    // Insert in batches of 500
    for (let i = 0; i < activities.length; i += 500) {
      await db.collection('user_activities').insertMany(activities.slice(i, i + 500));
    }

    console.log(`\nInserted ${activities.length} activities for ${users.length} users`);

    // Summary
    const counts = {};
    activities.forEach(a => { counts[a.action] = (counts[a.action] || 0) + 1; });
    console.log('\nBreakdown:');
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    // Sample state-change events
    const stateChanges = activities.filter(a => a.metadata?.previousStatus || a.metadata?.previousState || a.metadata?.previousLocation || a.metadata?.changes);
    console.log(`\nEvents with previous/new state: ${stateChanges.length}`);

    console.log('\nDone!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
