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

    if (listings.length === 0) {
      console.log('No listings to sync');
      return;
    }

    // Build bulk body
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
        isFeatured: doc.isFeatured || false,
        status: doc.status,
        sellerId: doc.sellerId?.toString(),
        createdAt: doc.createdAt,
      };

      if (doc.location?.coordinates?.length === 2) {
        esDoc.location = { lat: doc.location.coordinates[1], lon: doc.location.coordinates[0] };
      }

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
