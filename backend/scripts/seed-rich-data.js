const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    // Add more attributes to Cars category
    await db.collection('categories').updateOne(
      { name: 'Cars' },
      {
        $set: {
          attributes: [
            { name: 'Make', key: 'make', type: 'select', options: ['Toyota', 'Honda', 'Suzuki', 'Hyundai', 'KIA', 'BMW', 'Mercedes', 'Audi'], required: true },
            { name: 'Model', key: 'model', type: 'text', required: true },
            { name: 'Year', key: 'year', type: 'number', required: true },
            { name: 'Mileage', key: 'mileage', type: 'number', unit: 'km', required: false },
            { name: 'Fuel Type', key: 'fuel_type', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric'], required: false },
            { name: 'Transmission', key: 'transmission', type: 'select', options: ['Automatic', 'Manual'], required: false },
            { name: 'Color', key: 'color', type: 'text', required: false },
            { name: 'Body Type', key: 'body_type', type: 'select', options: ['Sedan', 'Hatchback', 'SUV', 'MPV', 'Pickup', 'Coupe'], required: false },
            { name: 'Number of Owners', key: 'owners', type: 'number', required: false },
            { name: 'Registration City', key: 'registration_city', type: 'text', required: false },
            { name: 'Assembly', key: 'assembly', type: 'select', options: ['Local', 'Imported'], required: false },
          ]
        }
      }
    );
    console.log('Updated Cars category attributes');

    // Add more attributes to Mobile Phones
    await db.collection('categories').updateOne(
      { name: 'Mobile Phones' },
      {
        $set: {
          attributes: [
            { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Oppo', 'Vivo', 'Realme', 'Google', 'Motorola'], required: true },
            { name: 'Model', key: 'model', type: 'text', required: true },
            { name: 'Storage', key: 'storage', type: 'select', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: true },
            { name: 'RAM', key: 'ram', type: 'select', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'], required: false },
            { name: 'PTA Status', key: 'pta_status', type: 'select', options: ['PTA Approved', 'Non-PTA', 'JV'], required: false },
            { name: 'Battery Health', key: 'battery_health', type: 'text', required: false },
          ]
        }
      }
    );
    console.log('Updated Mobile Phones category attributes');

    const sellerId = new ObjectId('69c6f2471c01acea72b7c32a');
    const carsId = (await db.collection('categories').findOne({ name: 'Cars' }))._id;
    const phonesId = (await db.collection('categories').findOne({ name: 'Mobile Phones' }))._id;
    const vehiclesId = (await db.collection('categories').findOne({ name: 'Vehicles' }))._id;
    const electronicsId = (await db.collection('categories').findOne({ name: 'Electronics' }))._id;

    // Rich car listing
    const car = {
      sellerId,
      title: 'Honda BR-V 2022 - S Package Automatic',
      description: `Honda BR-V S Package 2022 model in excellent condition.
First owner, no accidents. Full service history from Honda dealership.
All original documents available. Token paid till Dec 2026.
AC, power windows, power steering, multimedia all working perfectly.
Tyres are 80% with alloy rims. Interior is clean with no tears.
Serious buyers only. Price is slightly negotiable.`,
      price: { amount: 4200000, currency: 'PKR' },
      categoryId: carsId,
      categoryPath: [vehiclesId, carsId],
      condition: 'used',
      categoryAttributes: {
        make: 'Honda',
        model: 'BR-V',
        year: 2022,
        mileage: 44437,
        fuel_type: 'Petrol',
        transmission: 'Automatic',
        color: 'Silver',
        body_type: 'MPV',
        owners: 1,
        registration_city: 'Lahore',
        assembly: 'Local',
      },
      images: [
        { url: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=300', sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=300', sortOrder: 1 },
        { url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=300', sortOrder: 2 },
      ],
      location: { type: 'Point', coordinates: [74.35, 31.52], city: 'Lahore', area: 'DHA Phase 5' },
      contactInfo: { phone: '03001234567', email: 'ali@example.com' },
      status: 'active',
      isFeatured: true,
      viewCount: 342,
      favoriteCount: 28,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Rich phone listing
    const phone = {
      sellerId,
      title: 'iPhone 15 Pro Max 256GB - Natural Titanium',
      description: `Selling my iPhone 15 Pro Max in Natural Titanium. 256GB storage.
Phone is in absolutely perfect condition, no scratches or dents.
Kept in a case with a screen protector since day one. Battery health is at 96%.
Comes with original box, unused braided charging cable, and a Spigen clear case.
Only selling because I'm switching back to Android for work.
Unlocked for all carriers. Clean IMEI. No iCloud lock.
AppleCare+ active until Nov 2026.
Cash or JazzCash only. Will meet at a public place for safety.`,
      price: { amount: 420000, currency: 'PKR' },
      categoryId: phonesId,
      categoryPath: [electronicsId, phonesId],
      condition: 'used',
      categoryAttributes: {
        brand: 'Apple',
        model: 'iPhone 15 Pro Max',
        storage: '256GB',
        ram: '8GB',
        pta_status: 'PTA Approved',
        battery_health: '96%',
      },
      images: [
        { url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300', sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300', sortOrder: 1 },
        { url: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300', sortOrder: 2 },
      ],
      location: { type: 'Point', coordinates: [67.01, 24.86], city: 'Karachi', area: 'Defence' },
      contactInfo: { phone: '03001234567', email: 'ali@example.com' },
      status: 'active',
      isFeatured: false,
      viewCount: 189,
      favoriteCount: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Another car with different attributes
    const car2 = {
      sellerId,
      title: 'Toyota Corolla GLi 2021 - Automatic',
      description: `Toyota Corolla GLi Automatic 2021 in Pearl White.
Company maintained with complete service record.
Genuine parts, no accident history. First owner.
Multimedia with reverse camera installed.
New tyres, battery replaced recently.
Islamabad registered. Token valid.`,
      price: { amount: 5100000, currency: 'PKR' },
      categoryId: carsId,
      categoryPath: [vehiclesId, carsId],
      condition: 'used',
      categoryAttributes: {
        make: 'Toyota',
        model: 'Corolla GLi',
        year: 2021,
        mileage: 38000,
        fuel_type: 'Petrol',
        transmission: 'Automatic',
        color: 'Pearl White',
        body_type: 'Sedan',
        owners: 1,
        registration_city: 'Islamabad',
        assembly: 'Local',
      },
      images: [
        { url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=300', sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=300', sortOrder: 1 },
      ],
      location: { type: 'Point', coordinates: [73.04, 33.69], city: 'Islamabad', area: 'Blue Area' },
      contactInfo: { phone: '03001234567', email: 'ali@example.com' },
      status: 'active',
      isFeatured: false,
      viewCount: 95,
      favoriteCount: 7,
      createdAt: new Date(Date.now() - 2 * 86400000),
      updatedAt: new Date(),
    };

    // Samsung phone
    const phone2 = {
      sellerId,
      title: 'Samsung Galaxy S24 Ultra 512GB - Titanium Black',
      description: `Samsung Galaxy S24 Ultra with S-Pen. 512GB storage, 12GB RAM.
Bought from Samsung official store. Complete box with all accessories.
Screen has no scratches (always used with tempered glass).
Battery health excellent. Fast charging and wireless charging work perfectly.
PTA approved. Dual SIM.`,
      price: { amount: 350000, currency: 'PKR' },
      categoryId: phonesId,
      categoryPath: [electronicsId, phonesId],
      condition: 'used',
      categoryAttributes: {
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        storage: '512GB',
        ram: '12GB',
        pta_status: 'PTA Approved',
        battery_health: '98%',
      },
      images: [
        { url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=300', sortOrder: 0 },
        { url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800', thumbnailUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300', sortOrder: 1 },
      ],
      location: { type: 'Point', coordinates: [74.35, 31.52], city: 'Lahore', area: 'Gulberg' },
      contactInfo: { phone: '03001234567', email: 'ali@example.com' },
      status: 'active',
      isFeatured: true,
      viewCount: 267,
      favoriteCount: 22,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
    };

    const result = await db.collection('product_listings').insertMany([car, phone, car2, phone2]);
    console.log(`Inserted ${result.insertedCount} rich test listings`);

    // Sync to Elasticsearch
    const listings = await db.collection('product_listings').find({ _id: { $in: Object.values(result.insertedIds) } }).toArray();
    const body = [];
    for (const doc of listings) {
      body.push(JSON.stringify({ index: { _index: 'product_listings', _id: doc._id.toString() } }));
      body.push(JSON.stringify({
        title: doc.title,
        description: doc.description,
        price: doc.price,
        categoryId: doc.categoryId.toString(),
        categoryPath: doc.categoryPath.map(id => id.toString()),
        condition: doc.condition,
        categoryAttributes: doc.categoryAttributes,
        isFeatured: doc.isFeatured,
        status: doc.status,
        sellerId: doc.sellerId.toString(),
        createdAt: doc.createdAt,
        location: doc.location?.coordinates ? { lat: doc.location.coordinates[1], lon: doc.location.coordinates[0] } : undefined,
      }));
    }
    const res = await fetch('http://localhost:9200/_bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body: body.join('\n') + '\n',
    });
    const esResult = await res.json();
    console.log(`Synced ${esResult.items?.length || 0} to Elasticsearch`);

  } finally {
    await client.close();
  }
}

seed().catch(console.error);
