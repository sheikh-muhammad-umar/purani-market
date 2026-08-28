/**
 * Seeds the advertising module with realistic test data.
 *
 * Covers every placement, every campaign lifecycle state, and each targeting
 * dimension (category, province/city, device) so the serving path, the admin
 * screens and the performance report all have something to show.
 *
 * Replaces the contents of advertisers / ad_campaigns / ad_creatives / ad_events
 * on every run so repeated runs stay predictable. Nothing outside those four
 * collections is touched.
 *
 *   node scripts/seed-ads.js
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

const DAY_MS = 86400000;

/** Labelled banner, so it is obvious on screen which slot an ad landed in. */
const banner = (label, placement, w, h, bg) =>
  `https://placehold.co/${w}x${h}/${bg}/ffffff?text=${encodeURIComponent(`${label} | ${placement}`)}`;

/** Product-style photo for native cards, which must look like a listing. */
const photo = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

const advertisers = [
  {
    key: 'zameen',
    name: 'Zameen Homes',
    contactName: 'Ayesha Siddiqui',
    contactEmail: 'ayesha@zameenhomes.example',
    contactPhone: '+92 300 1234567',
    website: 'https://zameenhomes.example',
    logoUrl: 'https://placehold.co/200x80/1e3a8a/ffffff?text=Zameen',
    notes: 'Direct client. Quarterly retainer, invoiced via head office.',
    status: 'active',
  },
  {
    key: 'bykea',
    name: 'Bykea Rides',
    contactName: 'Hamza Tariq',
    contactEmail: 'hamza@bykearides.example',
    contactPhone: '+92 321 7654321',
    website: 'https://bykearides.example',
    logoUrl: 'https://placehold.co/200x80/047857/ffffff?text=Bykea',
    notes: 'Booked through Mediacom. City-level targeting only.',
    status: 'active',
  },
  {
    key: 'daraz',
    name: 'Daraz Express',
    contactName: 'Sana Malik',
    contactEmail: 'sana@darazexpress.example',
    contactPhone: '+92 333 2223344',
    website: 'https://darazexpress.example',
    logoUrl: 'https://placehold.co/200x80/b91c1c/ffffff?text=Daraz',
    notes: 'Biggest spender. Wants category-level reporting every Monday.',
    status: 'active',
  },
  {
    key: 'hbl',
    name: 'HBL MobileBank',
    contactName: 'Bilal Ahmed',
    contactEmail: 'bilal@hblmobile.example',
    contactPhone: '+92 345 9876543',
    website: 'https://hblmobile.example',
    logoUrl: 'https://placehold.co/200x80/065f46/ffffff?text=HBL',
    notes: 'Compliance requires creative approval before any change goes live.',
    status: 'active',
  },
  {
    key: 'house',
    name: 'Marketplace House Ads',
    contactName: 'Growth Team',
    contactEmail: 'growth@marketplace.example',
    website: 'https://marketplace.example',
    logoUrl: 'https://placehold.co/200x80/4338ca/ffffff?text=House',
    notes:
      'Internal promos. Fills unsold inventory, always priced flat at zero.',
    status: 'active',
  },
  {
    key: 'telenor',
    name: 'Telenor Pakistan',
    contactName: 'Fatima Raza',
    contactEmail: 'fatima@telenor.example',
    contactPhone: '+92 311 4445566',
    website: 'https://telenor.example',
    logoUrl: 'https://placehold.co/200x80/0284c7/ffffff?text=Telenor',
    notes: 'Run-of-network buy. No targeting, fills any slot on any device.',
    status: 'active',
  },
  {
    key: 'dormant',
    name: 'Kohinoor Textiles',
    contactName: 'Imran Sheikh',
    contactEmail: 'imran@kohinoor.example',
    contactPhone: '+92 302 5556677',
    website: 'https://kohinoor.example',
    notes: 'Lapsed after Eid 2025. Kept for reporting history.',
    status: 'inactive',
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const now = new Date();

    // Real ids, so category and location targeting can actually be exercised.
    const catBySlug = {};
    for (const c of await db
      .collection('categories')
      .find({ level: 1 })
      .project({ slug: 1 })
      .toArray()) {
      catBySlug[c.slug] = c._id;
    }
    const provByName = {};
    for (const p of await db
      .collection('provinces')
      .find({})
      .project({ name: 1 })
      .toArray()) {
      provByName[p.name] = p._id;
    }
    const cityByName = {};
    for (const c of await db
      .collection('cities')
      .find({ name: { $in: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi'] } })
      .project({ name: 1 })
      .toArray()) {
      cityByName[c.name] = c._id;
    }
    const catIds = (...slugs) => slugs.map((s) => catBySlug[s]).filter(Boolean);
    const provIds = (...names) =>
      names.map((n) => provByName[n]).filter(Boolean);
    const cityIds = (...names) =>
      names.map((n) => cityByName[n]).filter(Boolean);

    if (!Object.keys(catBySlug).length) {
      console.log(
        'No level-1 categories found — category targeting will be left unrestricted.',
      );
    }

    // ---------------------------------------------------------------- advertisers
    const advertiserDocs = advertisers.map(({ key, ...rest }) => ({
      _id: new ObjectId(),
      ...rest,
      createdAt: new Date(now.getTime() - 120 * DAY_MS),
      updatedAt: now,
    }));
    const advId = {};
    advertisers.forEach((a, i) => {
      advId[a.key] = advertiserDocs[i]._id;
    });

    // ------------------------------------------------------------------ campaigns
    const at = (days) => new Date(now.getTime() + days * DAY_MS);

    /**
     * `live` marks campaigns that should currently serve, which is what the
     * event generator below uses to decide where to attribute traffic.
     */
    const campaigns = [
      {
        key: 'zameen-summer',
        advertiserId: advId.zameen,
        name: 'Zameen Summer Launch',
        status: 'active',
        startAt: at(-21),
        endAt: at(30),
        priority: 8,
        pricingModel: 'cpm',
        budgetAmount: 450000,
        maxImpressions: 2000000,
        targeting: {
          placements: ['home_top', 'search_top', 'listing_detail'],
          categoryIds: catIds('property-sale', 'property-rent'),
        },
        live: true,
      },
      {
        key: 'bykea-city',
        advertiserId: advId.bykea,
        name: 'Bykea City Push — Punjab & Sindh',
        status: 'active',
        startAt: at(-14),
        endAt: at(16),
        priority: 5,
        pricingModel: 'cpc',
        budgetAmount: 180000,
        maxClicks: 50000,
        targeting: {
          placements: ['home_mid', 'sidebar'],
          provinceIds: provIds('Punjab', 'Sindh'),
          cityIds: cityIds('Lahore', 'Karachi'),
        },
        live: true,
      },
      {
        key: 'daraz-electronics',
        advertiserId: advId.daraz,
        name: 'Daraz Electronics Days',
        status: 'active',
        startAt: at(-7),
        endAt: at(9),
        priority: 9,
        pricingModel: 'cpm',
        budgetAmount: 900000,
        maxImpressions: 5000000,
        dailyImpressionCap: 25000,
        targeting: {
          placements: ['in_feed', 'search_top'],
          categoryIds: catIds('mobiles', 'electronics'),
        },
        live: true,
      },
      {
        key: 'hbl-wallet',
        advertiserId: advId.hbl,
        name: 'HBL Wallet — Mobile Only',
        status: 'active',
        startAt: at(-10),
        endAt: at(20),
        priority: 6,
        pricingModel: 'cpm',
        budgetAmount: 300000,
        targeting: {
          placements: ['home_top', 'shorts_feed'],
          devices: ['mobile'],
        },
        live: true,
      },
      {
        key: 'house-fill',
        advertiserId: advId.house,
        name: 'House Ads — Sell Faster',
        status: 'active',
        startAt: at(-30),
        endAt: at(90),
        priority: 2,
        pricingModel: 'flat',
        budgetAmount: 0,
        targeting: { placements: ['home_mid', 'in_feed'] },
        live: true,
      },
      {
        // Untargeted on purpose: every dimension empty means no restriction, so
        // this one fills any slot for any visitor. Without it most slots look
        // empty on a plain desktop visit, because the frontend only sends a
        // category or location when the surrounding page has one.
        key: 'telenor-ron',
        advertiserId: advId.telenor,
        name: 'Telenor Always-On — run of network',
        status: 'active',
        startAt: at(-14),
        endAt: at(60),
        priority: 3,
        pricingModel: 'cpm',
        budgetAmount: 600000,
        targeting: {
          placements: [
            'home_top',
            'home_mid',
            'search_top',
            'in_feed',
            'listing_detail',
            'sidebar',
            'shorts_feed',
          ],
        },
        live: true,
      },
      {
        key: 'zameen-winter',
        advertiserId: advId.zameen,
        name: 'Zameen Winter Teaser',
        status: 'scheduled',
        startAt: at(7),
        endAt: at(45),
        priority: 7,
        pricingModel: 'cpm',
        budgetAmount: 250000,
        targeting: { placements: ['home_top'] },
        live: false,
      },
      {
        key: 'daraz-paused',
        advertiserId: advId.daraz,
        name: 'Daraz Ramzan Warm-up (paused)',
        status: 'paused',
        startAt: at(-5),
        endAt: at(25),
        priority: 4,
        pricingModel: 'cpc',
        budgetAmount: 120000,
        targeting: { placements: ['search_top'] },
        live: false,
      },
      {
        key: 'bykea-past',
        advertiserId: advId.bykea,
        name: 'Bykea Eid 2026 (finished)',
        status: 'completed',
        startAt: at(-60),
        endAt: at(-12),
        priority: 5,
        pricingModel: 'cpc',
        budgetAmount: 160000,
        targeting: { placements: ['home_mid'] },
        live: false,
      },
      {
        key: 'kohinoor-draft',
        advertiserId: advId.dormant,
        name: 'Kohinoor Lawn Volume 3 (draft)',
        status: 'draft',
        startAt: at(14),
        endAt: at(44),
        priority: 5,
        pricingModel: 'flat',
        budgetAmount: 90000,
        targeting: {
          placements: ['home_top', 'in_feed'],
          categoryIds: catIds('fashion-beauty'),
        },
        live: false,
      },
    ];

    const campaignDocs = campaigns.map((c) => ({
      _id: new ObjectId(),
      advertiserId: c.advertiserId,
      name: c.name,
      status: c.status,
      startAt: c.startAt,
      endAt: c.endAt,
      priority: c.priority,
      pricingModel: c.pricingModel,
      budgetAmount: c.budgetAmount,
      currency: 'PKR',
      maxImpressions: c.maxImpressions ?? 0,
      maxClicks: c.maxClicks ?? 0,
      dailyImpressionCap: c.dailyImpressionCap ?? 0,
      targeting: {
        placements: c.targeting.placements ?? [],
        categoryIds: c.targeting.categoryIds ?? [],
        provinceIds: c.targeting.provinceIds ?? [],
        cityIds: c.targeting.cityIds ?? [],
        devices: c.targeting.devices ?? [],
      },
      metrics: { impressions: 0, clicks: 0 },
      createdAt: new Date(c.startAt.getTime() - 3 * DAY_MS),
      updatedAt: now,
    }));
    const campId = {};
    campaigns.forEach((c, i) => {
      campId[c.key] = campaignDocs[i]._id;
    });
    const campaignByKey = {};
    campaigns.forEach((c, i) => {
      campaignByKey[c.key] = { spec: c, doc: campaignDocs[i] };
    });

    // ------------------------------------------------------------------ creatives
    // Every creative's placement must appear in its campaign's targeting.
    const creatives = [
      // Two creatives in one placement, so weighted rotation is observable.
      {
        campaign: 'zameen-summer',
        placement: 'home_top',
        title: 'Zameen Homes — DHA Phase 8 launch',
        imageUrl: banner('Zameen Homes', 'home_top', 1200, 150, '1e3a8a'),
        mobileImageUrl: banner('Zameen', 'home_top', 640, 160, '1e3a8a'),
        altText: 'Zameen Homes advertisement for the DHA Phase 8 launch',
        destinationUrl: 'https://zameenhomes.example/dha-phase-8',
        weight: 3,
      },
      {
        campaign: 'zameen-summer',
        placement: 'home_top',
        title: 'Zameen Homes — 0% down payment',
        imageUrl: banner('Zameen Offer B', 'home_top', 1200, 150, '312e81'),
        altText:
          'Zameen Homes advertisement offering zero percent down payment',
        destinationUrl: 'https://zameenhomes.example/easy-instalments',
        weight: 1,
      },
      {
        campaign: 'zameen-summer',
        placement: 'search_top',
        title: 'Zameen Homes — verified plots',
        imageUrl: banner('Zameen Homes', 'search_top', 1200, 150, '1e40af'),
        altText: 'Zameen Homes advertisement for verified plots',
        destinationUrl: 'https://zameenhomes.example/plots',
        weight: 2,
      },
      {
        campaign: 'zameen-summer',
        placement: 'listing_detail',
        title: 'Zameen Homes — book a viewing',
        imageUrl: banner('Zameen Homes', 'listing_detail', 970, 250, '1d4ed8'),
        altText:
          'Zameen Homes advertisement inviting you to book a property viewing',
        destinationUrl: 'https://zameenhomes.example/viewings',
        weight: 1,
      },
      {
        campaign: 'bykea-city',
        placement: 'home_mid',
        title: 'Bykea — flat Rs 99 rides',
        imageUrl: banner('Bykea Rides', 'home_mid', 1200, 200, '047857'),
        altText: 'Bykea advertisement for flat ninety nine rupee rides',
        destinationUrl: 'https://bykearides.example/promo',
        weight: 1,
      },
      {
        campaign: 'bykea-city',
        placement: 'sidebar',
        title: 'Bykea — deliver anything',
        imageUrl: banner('Bykea', 'sidebar', 300, 600, '065f46'),
        altText: 'Bykea advertisement for its parcel delivery service',
        destinationUrl: 'https://bykearides.example/delivery',
        weight: 1,
      },
      {
        campaign: 'daraz-electronics',
        placement: 'search_top',
        title: 'Daraz Express — up to 60% off electronics',
        imageUrl: banner('Daraz Express', 'search_top', 1200, 150, 'b91c1c'),
        mobileImageUrl: banner('Daraz', 'search_top', 640, 160, 'b91c1c'),
        altText:
          'Daraz Express advertisement offering up to sixty percent off electronics',
        destinationUrl: 'https://darazexpress.example/electronics-days',
        weight: 4,
      },
      {
        campaign: 'daraz-electronics',
        placement: 'in_feed',
        title: 'Redmi Note 13 Pro — Rs 62,999',
        body: 'Official warranty, free delivery nationwide. Ends Sunday.',
        imageUrl: photo('daraz-redmi'),
        altText: 'Redmi Note 13 Pro smartphone on a plain background',
        destinationUrl: 'https://darazexpress.example/redmi-note-13-pro',
        ctaLabel: 'Shop now',
        weight: 3,
      },
      {
        campaign: 'daraz-electronics',
        placement: 'in_feed',
        title: 'Haier 1.5 Ton Inverter AC — Rs 134,500',
        body: '10 year compressor warranty. Installation included.',
        imageUrl: photo('daraz-ac'),
        altText: 'Haier inverter air conditioner indoor unit',
        destinationUrl: 'https://darazexpress.example/haier-inverter-ac',
        ctaLabel: 'View deal',
        weight: 2,
      },
      {
        campaign: 'hbl-wallet',
        placement: 'home_top',
        title: 'HBL MobileBank — send money free',
        imageUrl: banner('HBL MobileBank', 'home_top', 1200, 150, '065f46'),
        mobileImageUrl: banner('HBL', 'home_top', 640, 160, '065f46'),
        altText: 'HBL MobileBank advertisement for free money transfers',
        destinationUrl: 'https://hblmobile.example/transfers',
        weight: 2,
      },
      {
        campaign: 'hbl-wallet',
        placement: 'shorts_feed',
        title: 'HBL MobileBank — open an account in 5 minutes',
        imageUrl: banner('HBL', 'shorts_feed', 720, 1280, '064e3b'),
        altText:
          'HBL MobileBank advertisement about opening an account in five minutes',
        destinationUrl: 'https://hblmobile.example/open-account',
        weight: 1,
      },
      // House ads use an internal route instead of an outbound URL.
      {
        campaign: 'house-fill',
        placement: 'home_mid',
        title: 'Sell faster with a Featured listing',
        imageUrl: banner('Featured Listings', 'home_mid', 1200, 200, '4338ca'),
        altText: 'House advertisement promoting featured listings',
        routeLink: '/packages',
        weight: 1,
      },
      {
        campaign: 'house-fill',
        placement: 'in_feed',
        title: 'Post your ad free in 60 seconds',
        body: 'Reach thousands of buyers across Pakistan today.',
        imageUrl: photo('house-post-ad'),
        altText: 'House advertisement encouraging you to post a listing',
        routeLink: '/listings/create',
        ctaLabel: 'Post an ad',
        weight: 1,
      },
      // Run-of-network filler: one creative per placement, so no slot is ever bare.
      {
        campaign: 'telenor-ron',
        placement: 'home_top',
        title: 'Telenor — 50GB for Rs 999',
        imageUrl: banner('Telenor', 'home_top', 1200, 150, '0284c7'),
        mobileImageUrl: banner('Telenor', 'home_top', 640, 160, '0284c7'),
        altText:
          'Telenor advertisement offering fifty gigabytes for nine hundred ninety nine rupees',
        destinationUrl: 'https://telenor.example/data-bundles',
        weight: 2,
      },
      {
        campaign: 'telenor-ron',
        placement: 'home_mid',
        title: 'Telenor — unlimited weekend minutes',
        imageUrl: banner('Telenor', 'home_mid', 1200, 200, '0369a1'),
        altText: 'Telenor advertisement for unlimited weekend minutes',
        destinationUrl: 'https://telenor.example/weekend',
        weight: 1,
      },
      {
        campaign: 'telenor-ron',
        placement: 'search_top',
        title: 'Telenor — switch and keep your number',
        imageUrl: banner('Telenor', 'search_top', 1200, 150, '075985'),
        mobileImageUrl: banner('Telenor', 'search_top', 640, 160, '075985'),
        altText:
          'Telenor advertisement about switching networks and keeping your number',
        destinationUrl: 'https://telenor.example/mnp',
        weight: 1,
      },
      {
        campaign: 'telenor-ron',
        placement: 'in_feed',
        title: 'Telenor 4G MiFi device — Rs 4,999',
        body: 'Portable WiFi for up to 10 devices. Free 10GB on activation.',
        imageUrl: photo('telenor-mifi'),
        altText: 'Telenor portable 4G MiFi router',
        destinationUrl: 'https://telenor.example/mifi',
        ctaLabel: 'Get yours',
        weight: 1,
      },
      {
        campaign: 'telenor-ron',
        placement: 'listing_detail',
        title: 'Telenor — easy monthly instalments',
        imageUrl: banner('Telenor', 'listing_detail', 970, 250, '0c4a6e'),
        altText: 'Telenor advertisement about easy monthly instalments',
        destinationUrl: 'https://telenor.example/instalments',
        weight: 1,
      },
      {
        campaign: 'telenor-ron',
        placement: 'sidebar',
        title: 'Telenor — double data offer',
        imageUrl: banner('Telenor', 'sidebar', 300, 600, '0284c7'),
        altText: 'Telenor advertisement for its double data offer',
        destinationUrl: 'https://telenor.example/double-data',
        weight: 1,
      },
      {
        campaign: 'telenor-ron',
        placement: 'shorts_feed',
        title: 'Telenor — stream more, pay less',
        imageUrl: banner('Telenor', 'shorts_feed', 720, 1280, '0369a1'),
        altText: 'Telenor advertisement about streaming more for less',
        destinationUrl: 'https://telenor.example/streaming',
        weight: 1,
      },
      // Belongs to a scheduled campaign: ready, but must not serve yet.
      {
        campaign: 'zameen-winter',
        placement: 'home_top',
        title: 'Zameen Homes — winter launch coming soon',
        imageUrl: banner('Zameen Winter', 'home_top', 1200, 150, '0f172a'),
        altText: 'Zameen Homes teaser advertisement for its winter launch',
        destinationUrl: 'https://zameenhomes.example/winter',
        weight: 1,
      },
      {
        campaign: 'daraz-paused',
        placement: 'search_top',
        title: 'Daraz Ramzan warm-up',
        imageUrl: banner('Daraz Ramzan', 'search_top', 1200, 150, '9f1239'),
        altText: 'Daraz Express advertisement for its Ramzan warm-up sale',
        destinationUrl: 'https://darazexpress.example/ramzan',
        weight: 1,
      },
      {
        campaign: 'bykea-past',
        placement: 'home_mid',
        title: 'Bykea Eid offer',
        imageUrl: banner('Bykea Eid', 'home_mid', 1200, 200, '134e4a'),
        altText: 'Bykea advertisement for its Eid ride offer',
        destinationUrl: 'https://bykearides.example/eid',
        weight: 1,
      },
      // Inactive creative under a live campaign: exercises the isActive filter.
      {
        campaign: 'zameen-summer',
        placement: 'search_top',
        title: 'Zameen Homes — retired creative',
        imageUrl: banner('Zameen Retired', 'search_top', 1200, 150, '525252'),
        altText: 'Retired Zameen Homes advertisement kept for reporting',
        destinationUrl: 'https://zameenhomes.example/old',
        weight: 1,
        isActive: false,
      },
      {
        campaign: 'kohinoor-draft',
        placement: 'in_feed',
        title: 'Kohinoor Lawn Volume 3',
        body: 'Unstitched three piece, 42 designs.',
        imageUrl: photo('kohinoor-lawn'),
        altText: 'Kohinoor unstitched lawn fabric in three colours',
        destinationUrl: 'https://kohinoor.example/lawn-v3',
        ctaLabel: 'See collection',
        weight: 1,
      },
    ];

    const creativeDocs = creatives.map((c) => ({
      _id: new ObjectId(),
      campaignId: campId[c.campaign],
      placement: c.placement,
      title: c.title,
      ...(c.body ? { body: c.body } : {}),
      imageUrl: c.imageUrl,
      ...(c.mobileImageUrl ? { mobileImageUrl: c.mobileImageUrl } : {}),
      altText: c.altText,
      ...(c.destinationUrl ? { destinationUrl: c.destinationUrl } : {}),
      ...(c.routeLink ? { routeLink: c.routeLink } : {}),
      ...(c.ctaLabel ? { ctaLabel: c.ctaLabel } : {}),
      weight: c.weight,
      isActive: c.isActive !== false,
      metrics: { impressions: 0, clicks: 0 },
      createdAt: campaignByKey[c.campaign].doc.createdAt,
      updatedAt: now,
    }));

    // Fail loudly rather than seeding data the admin UI would reject on save.
    creativeDocs.forEach((doc, i) => {
      const allowed =
        campaignByKey[creatives[i].campaign].spec.targeting.placements ?? [];
      if (!allowed.includes(doc.placement)) {
        throw new Error(
          `creative "${doc.title}" targets ${doc.placement}, which its campaign does not sell`,
        );
      }
      if (!!doc.destinationUrl === !!doc.routeLink) {
        throw new Error(
          `creative "${doc.title}" needs exactly one of destinationUrl / routeLink`,
        );
      }
    });

    // --------------------------------------------------------------------- events
    // History only: nothing is dated today, so daily caps start clear and every
    // live campaign is immediately servable when you open the app.
    const events = [];
    const rand = (min, max) =>
      min + Math.floor(Math.random() * (max - min + 1));

    creativeDocs.forEach((doc, i) => {
      const spec = creatives[i];
      const campaign = campaignByKey[spec.campaign];
      if (!campaign.spec.live || doc.isActive === false) return;

      const startedDaysAgo = Math.min(
        14,
        Math.round((now.getTime() - campaign.doc.startAt.getTime()) / DAY_MS),
      );
      for (let daysAgo = startedDaysAgo; daysAgo >= 1; daysAgo--) {
        // Weight drives share of delivery, so heavier creatives get more rows.
        const impressions = rand(18, 40) * doc.weight;
        const clicks = Math.max(
          1,
          Math.round((impressions * rand(6, 24)) / 1000),
        );
        const dayStart = new Date(now.getTime() - daysAgo * DAY_MS);
        dayStart.setHours(9, 0, 0, 0);

        for (let n = 0; n < impressions; n++) {
          events.push({
            creativeId: doc._id,
            campaignId: doc.campaignId,
            type: 'impression',
            placement: doc.placement,
            sessionId: `seed-${doc._id.toHexString().slice(-6)}-${daysAgo}-${n}`,
            createdAt: new Date(dayStart.getTime() + rand(0, 10 * 3600) * 1000),
          });
        }
        for (let n = 0; n < clicks; n++) {
          events.push({
            creativeId: doc._id,
            campaignId: doc.campaignId,
            type: 'click',
            placement: doc.placement,
            sessionId: `seed-${doc._id.toHexString().slice(-6)}-${daysAgo}-${n}`,
            createdAt: new Date(dayStart.getTime() + rand(0, 10 * 3600) * 1000),
          });
        }

        doc.metrics.impressions += impressions;
        doc.metrics.clicks += clicks;
        campaign.doc.metrics.impressions += impressions;
        campaign.doc.metrics.clicks += clicks;
      }
    });

    // ---------------------------------------------------------------------- write
    for (const name of [
      'ad_events',
      'ad_creatives',
      'ad_campaigns',
      'advertisers',
    ]) {
      const removed = await db.collection(name).deleteMany({});
      if (removed.deletedCount)
        console.log(`Cleared ${removed.deletedCount} from ${name}`);
    }

    await db.collection('advertisers').insertMany(advertiserDocs);
    await db.collection('ad_campaigns').insertMany(campaignDocs);
    await db.collection('ad_creatives').insertMany(creativeDocs);
    await db.collection('ad_events').insertMany(events);

    const liveCampaigns = campaigns.filter((c) => c.live).length;
    const servable = creativeDocs.filter(
      (d, i) => campaignByKey[creatives[i].campaign].spec.live && d.isActive,
    ).length;

    console.log('');
    console.log(`Advertisers  ${advertiserDocs.length}`);
    console.log(
      `Campaigns    ${campaignDocs.length} (${liveCampaigns} active and in-window)`,
    );
    console.log(
      `Creatives    ${creativeDocs.length} (${servable} servable right now)`,
    );
    console.log(`Ad events    ${events.length} across the last 14 days`);
    console.log('');
    const byPlacement = {};
    creativeDocs.forEach((d, i) => {
      if (!campaignByKey[creatives[i].campaign].spec.live || !d.isActive)
        return;
      byPlacement[d.placement] = (byPlacement[d.placement] || 0) + 1;
    });
    console.log('Servable creatives per placement:');
    for (const [placement, count] of Object.entries(byPlacement).sort()) {
      console.log(`  ${placement.padEnd(16)} ${count}`);
    }
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
