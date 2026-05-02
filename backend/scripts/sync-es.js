const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const ES_URL = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const INDEX = 'product_listings';

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
  } finally {
    await client.close();
  }
}

sync().catch(console.error);
