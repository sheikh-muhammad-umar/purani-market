const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const ES_URL = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const INDEX = 'product_listings';
const SHORTS_INDEX = 'short_videos';

async function sync() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const listings = await db.collection('product_listings').find({ status: 'active' }).toArray();

    console.log(`Found ${listings.length} active listings to sync`);

    // ── Step 1: Delete the old index to remove orphaned documents ──
    const existsRes = await fetch(`${ES_URL}/${INDEX}`, { method: 'HEAD' });
    if (existsRes.ok) {
      console.log('Deleting existing index to clear orphaned documents...');
      await fetch(`${ES_URL}/${INDEX}`, { method: 'DELETE' });
    }

    // ── Step 2: Recreate index with proper settings from compiled code ──
    try {
      const { listingsIndexSettings, listingsIndexMapping } = require('../dist/search/search-index.service.js');
      const createRes = await fetch(`${ES_URL}/${INDEX}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: listingsIndexSettings, mappings: listingsIndexMapping }),
      });
      const createResult = await createRes.json();
      if (createResult.error) {
        console.error('Failed to create index with settings:', createResult.error.reason);
        return;
      }
      console.log('Created index with custom analyzers and mappings');
    } catch (e) {
      console.warn('Could not load index settings from dist — creating index without custom settings');
    }

    if (listings.length === 0) {
      console.log('No active listings — index cleared');
      return;
    }

    // ── Step 2: Recreate the index (ES will auto-create with defaults) ──

    // ── Step 3: Bulk-index active listings ──
    const body = [];
    for (const doc of listings) {
      body.push(JSON.stringify({ index: { _index: INDEX, _id: doc._id.toString() } }));

      const esDoc = {
        title: doc.title,
        description: doc.description,
        price: { amount: doc.price?.amount, currency: doc.price?.currency || 'PKR' },
        categoryId: doc.categoryId?.toString(),
        categoryPath: (doc.categoryPath || []).map(id => id.toString()),
        condition: doc.condition,
        categoryAttributes: doc.categoryAttributes || {},
        images: (doc.images || []).map(img => ({
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          sortOrder: img.sortOrder ?? 0,
        })),
        sellerVerified: doc.sellerVerified || false,
        isFeatured: doc.isFeatured || false,
        viewCount: doc.viewCount || 0,
        favoriteCount: doc.favoriteCount || 0,
        status: doc.status,
        sellerId: doc.sellerId?.toString(),
        createdAt: doc.createdAt,
        brandId: doc.brandId?.toString(),
        brandName: doc.brandName,
        vehicleBrandId: doc.vehicleBrandId?.toString(),
        vehicleBrandName: doc.vehicleBrandName,
        modelId: doc.modelId?.toString(),
        modelName: doc.modelName,
        variantId: doc.variantId?.toString(),
        variantName: doc.variantName,
        selectedFeatures: doc.selectedFeatures || [],
      };

      // Geo-point for distance queries
      if (doc.location?.coordinates?.length === 2) {
        esDoc.location = { lat: doc.location.coordinates[1], lon: doc.location.coordinates[0] };
      }

      // Text location fields for display and filtering
      esDoc.location_text = {
        province: doc.location?.province,
        city: doc.location?.city,
        area: doc.location?.area,
        blockPhase: doc.location?.blockPhase,
        provinceId: doc.location?.provinceId?.toString(),
        cityId: doc.location?.cityId?.toString(),
        areaId: doc.location?.areaId?.toString(),
      };

      body.push(JSON.stringify(esDoc));
    }

    const bulkBody = body.join('\n') + '\n';

    const res = await fetch(`${ES_URL}/_bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body: bulkBody,
    });

    const result = await res.json();
    const errors = result.items?.filter(i => i.index?.error) || [];
    console.log(`Indexed ${result.items?.length || 0} documents, ${errors.length} errors`);

    if (errors.length > 0) {
      console.log('First error:', JSON.stringify(errors[0].index.error, null, 2));
    }

    // ── Step 4: Sync active shorts into their own index ──
    await syncShorts(db);
  } finally {
    await client.close();
  }
}

/**
 * Mirrors listing sync for the shorts index. The document shape matches
 * SearchSyncService.indexShort so the search query (searchShorts) finds the
 * same fields it expects. Kept in this script because sync-es previously only
 * covered listings, which left short_videos empty and the search-page shorts
 * rail blank even when active shorts existed in Mongo.
 */
async function syncShorts(db) {
  const shorts = await db.collection('short_videos').find({ status: 'active' }).toArray();
  console.log(`\nFound ${shorts.length} active shorts to sync`);

  // Recreate the index so orphaned/renamed docs don't linger.
  const existsRes = await fetch(`${ES_URL}/${SHORTS_INDEX}`, { method: 'HEAD' });
  if (existsRes.ok) {
    await fetch(`${ES_URL}/${SHORTS_INDEX}`, { method: 'DELETE' });
  }
  try {
    const { shortsIndexMapping } = require('../dist/search/search-index.service.js');
    const createRes = await fetch(`${ES_URL}/${SHORTS_INDEX}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings: shortsIndexMapping }),
    });
    const createResult = await createRes.json();
    if (createResult.error) {
      console.error('Failed to create shorts index:', createResult.error.reason);
      return;
    }
    console.log('Created shorts index with mapping');
  } catch (e) {
    console.warn('Could not load shorts mapping from dist — creating index without it');
    await fetch(`${ES_URL}/${SHORTS_INDEX}`, { method: 'PUT' });
  }

  if (shorts.length === 0) {
    console.log('No active shorts — shorts index cleared');
    return;
  }

  const body = [];
  for (const doc of shorts) {
    body.push(JSON.stringify({ index: { _index: SHORTS_INDEX, _id: doc._id.toString() } }));
    body.push(
      JSON.stringify({
        title: doc.title,
        description: doc.description,
        categoryId: doc.categoryId?.toString(),
        categoryName: doc.categoryName,
        sellerId: doc.sellerId?.toString(),
        status: doc.status,
        price: doc.price,
        viewCount: doc.viewCount || 0,
        favoriteCount: doc.favoriteCount || 0,
        location_text: {
          province: doc.location?.province,
          city: doc.location?.city,
          area: doc.location?.area,
          provinceId: doc.location?.provinceId?.toString(),
          cityId: doc.location?.cityId?.toString(),
          areaId: doc.location?.areaId?.toString(),
        },
        thumbnailUrl: doc.video?.thumbnailUrl,
        videoUrl: doc.video?.url,
        createdAt: doc.createdAt,
      }),
    );
  }

  const res = await fetch(`${ES_URL}/_bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    body: body.join('\n') + '\n',
  });
  const result = await res.json();
  const errors = result.items?.filter((i) => i.index?.error) || [];
  console.log(`Indexed ${result.items?.length || 0} shorts, ${errors.length} errors`);
  if (errors.length > 0) {
    console.log('First shorts error:', JSON.stringify(errors[0].index.error, null, 2));
  }
}

sync().catch(console.error);
