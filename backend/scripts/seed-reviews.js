/**
 * Seed sample reviews/ratings for testing.
 *
 * Creates reviews from real buyers against real sellers' listings, each with a
 * 1–5 rating, a required comment, and 0–2 photos. It also upserts the matching
 * conversation the app requires before a review is allowed, and denormalizes
 * the seller rating onto users + listings exactly like ReviewsService does — so
 * seeded data behaves identically to data created through the app.
 *
 * Usage:  node scripts/seed-reviews.js
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

/** Comments grouped by sentiment so they match the star rating. */
const COMMENTS_BY_RATING = {
  1: [
    'Very disappointing. The item was not as described and the seller stopped replying.',
    'Would not recommend. Product had defects that were never disclosed.',
  ],
  2: [
    'Below my expectation. Seller was slow to respond and the item had issues.',
    'Not great. There were problems with the product that were not mentioned.',
  ],
  3: [
    'Okay overall. Delivery was a bit slow but the item was genuine.',
    'Average experience. A few minor issues but the seller was cooperative.',
  ],
  4: [
    'Good experience. Item as described and the seller was responsive and polite.',
    'Solid deal. Fair price and neat packaging. Would consider buying again.',
  ],
  5: [
    'Absolutely fantastic! Genuine product, fast handover, very trustworthy seller.',
    'Excellent communication and a smooth transaction from start to finish. Thank you!',
  ],
};

function commentForRating(rating, i) {
  const pool = COMMENTS_BY_RATING[rating] || COMMENTS_BY_RATING[3];
  return pool[i % pool.length];
}

/** A couple of stable placeholder photos for a subset of reviews. */
const photo = (seed) => ({
  url: `https://picsum.photos/seed/review-${seed}/600/450`,
  key: `reviews/seed-${seed}.jpg`,
});

function round1(n) {
  return Math.round(n * 10) / 10;
}

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    const buyers = await db
      .collection('users')
      .find({ role: 'user' })
      .limit(30)
      .toArray();

    // Sellers are users who actually have listings.
    const listings = await db
      .collection('product_listings')
      .find({ status: { $in: ['active', 'sold', 'reserved'] } })
      .limit(60)
      .toArray();

    if (buyers.length < 2) {
      console.log('Not enough users found. Run seed.js first.');
      return;
    }
    if (listings.length === 0) {
      console.log('No listings found. Run a listings seed first.');
      return;
    }

    // Start clean so re-running is idempotent.
    await db.collection('reviews').deleteMany({});
    console.log('Cleared existing reviews.');

    // Group listings by seller — a review is about the seller, and one of
    // their listings is only kept as optional context.
    const listingsBySeller = new Map(); // sellerId string -> listing[]
    for (const listing of listings) {
      if (!listing.sellerId) continue;
      const key = listing.sellerId.toString();
      const arr = listingsBySeller.get(key) || [];
      arr.push(listing);
      listingsBySeller.set(key, arr);
    }

    const now = Date.now();
    const reviews = [];
    const conversations = [];
    // Track ratings per seller to denormalize afterwards.
    const sellerRatings = new Map(); // sellerId -> number[]

    let commentIdx = 0;
    for (const [sellerKey, sellerListings] of listingsBySeller) {
      const sellerId = sellerListings[0].sellerId;

      // Up to a handful of reviews per seller, each from a DISTINCT buyer
      // (the unique key is now {reviewerId, sellerId} — one per buyer/seller).
      const eligibleBuyers = buyers.filter((b) => !b._id.equals(sellerId));
      const reviewCount = Math.min(
        eligibleBuyers.length,
        2 + Math.floor(Math.random() * 6),
      );

      for (let i = 0; i < reviewCount; i++) {
        const buyer = eligibleBuyers[i];

        // Skew toward positive ratings, as real marketplaces do.
        const ratingRoll = Math.random();
        const rating =
          ratingRoll > 0.75 ? 5 : ratingRoll > 0.45 ? 4 : ratingRoll > 0.25 ? 3 : ratingRoll > 0.1 ? 2 : 1;
        const daysAgo = 1 + Math.floor(Math.random() * 90);
        const createdAt = new Date(now - daysAgo * 86400000);
        const comment = commentForRating(rating, commentIdx);
        commentIdx++;

        // Optional listing context: one of this seller's listings.
        const contextListing = sellerListings[i % sellerListings.length];

        // Roughly a third of reviews carry photos.
        let images = [];
        const roll = Math.random();
        if (roll > 0.85) images = [photo(reviews.length + 'a'), photo(reviews.length + 'b')];
        else if (roll > 0.66) images = [photo(reviews.length + 'a')];

        // Leave ~15% pending so the admin moderation queue has data. Pending
        // reviews are excluded from the seller's average (as in the app).
        const status = Math.random() < 0.15 ? 'pending' : 'approved';

        // The app requires a prior conversation between buyer and seller.
        // Upsert one so seeded reviews match that invariant.
        conversations.push({
          updateOne: {
            filter: {
              buyerId: buyer._id,
              sellerId: sellerId,
              productListingId: contextListing._id,
            },
            update: {
              $setOnInsert: {
                buyerId: buyer._id,
                sellerId: sellerId,
                productListingId: contextListing._id,
                createdAt,
              },
            },
            upsert: true,
          },
        });

        reviews.push({
          reviewerId: buyer._id,
          sellerId: sellerId,
          productListingId: contextListing._id,
          rating,
          text: status === 'pending'
            ? 'Pending moderation sample — awaiting admin review before it goes live.'
            : comment,
          images,
          status,
          createdAt,
          updatedAt: createdAt,
        });

        // Only APPROVED reviews contribute to the denormalized average.
        if (status === 'approved') {
          const arr = sellerRatings.get(sellerKey) || [];
          arr.push(rating);
          sellerRatings.set(sellerKey, arr);
        }
      }
    }

    if (conversations.length > 0) {
      await db.collection('conversations').bulkWrite(conversations, {
        ordered: false,
      });
      console.log(`Ensured ${conversations.length} conversations exist.`);
    }

    if (reviews.length > 0) {
      await db.collection('reviews').insertMany(reviews);
      console.log(`Inserted ${reviews.length} reviews.`);
    }

    // Denormalize seller rating onto users + their listings (mirrors
    // ReviewsService.refreshSellerRating).
    let sellersUpdated = 0;
    for (const [sellerId, ratings] of sellerRatings) {
      const reviewCount = ratings.length;
      const averageRating = round1(
        ratings.reduce((a, b) => a + b, 0) / reviewCount,
      );
      const oid = new ObjectId(sellerId);

      await db
        .collection('users')
        .updateOne({ _id: oid }, { $set: { averageRating, reviewCount } });
      await db
        .collection('product_listings')
        .updateMany(
          { sellerId: oid },
          { $set: { sellerRating: averageRating, sellerReviewCount: reviewCount } },
        );
      sellersUpdated++;
    }
    console.log(`Denormalized ratings onto ${sellersUpdated} sellers + their listings.`);

    const pendingCount = reviews.filter((r) => r.status === 'pending').length;
    console.log(
      `(${reviews.length - pendingCount} approved, ${pendingCount} pending for the admin queue.)`,
    );

    console.log('\nDone. Review/ratings test data seeded.');
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
