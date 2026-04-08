const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    // Get users and packages
    const users = await db.collection('users').find({ role: 'user' }).toArray();
    const packages = await db.collection('ad_packages').find({}).toArray();
    const categories = await db.collection('categories').find({ level: 1 }).limit(5).toArray();

    if (users.length === 0) { console.log('No users found'); return; }
    if (packages.length === 0) { console.log('No packages found. Run seed-packages.js first'); return; }

    // Seed package purchases / payment transactions
    const methods = ['jazzcash', 'easypaisa', 'card'];
    const statuses = ['completed', 'completed', 'completed', 'pending', 'failed', 'refunded'];
    const purchases = [];
    const now = new Date();

    for (let i = 0; i < 15; i++) {
      const user = users[i % users.length];
      const pkg = packages[i % packages.length];
      const daysAgo = Math.floor(Math.random() * 60);
      const createdAt = new Date(now.getTime() - daysAgo * 86400000);
      const status = statuses[i % statuses.length];
      const method = methods[i % methods.length];
      const price = pkg.defaultPrice + Math.floor(Math.random() * 500);

      purchases.push({
        sellerId: user._id,
        packageId: pkg._id,
        categoryId: categories.length > 0 ? categories[i % categories.length]._id : null,
        type: pkg.type || 'featured_ads',
        quantity: pkg.quantity || 5,
        remainingQuantity: status === 'completed' ? Math.floor(Math.random() * 5) : 0,
        duration: pkg.duration || 30,
        price,
        paymentMethod: method,
        paymentStatus: status,
        paymentTransactionId: `TXN-${Date.now()}-${i}`,
        activatedAt: status === 'completed' ? createdAt : null,
        expiresAt: status === 'completed' ? new Date(createdAt.getTime() + (pkg.duration || 30) * 86400000) : null,
        createdAt,
        updatedAt: createdAt,
      });
    }

    await db.collection('package_purchases').deleteMany({});
    if (purchases.length > 0) {
      await db.collection('package_purchases').insertMany(purchases);
      console.log(`Inserted ${purchases.length} payment transactions`);
    }

    // Seed some pending_review listings with rich data
    const allCategories = await db.collection('categories').find({ level: { $gte: 2 } }).limit(10).toArray();

    // Sample placeholder images (using picsum.photos for real images)
    const img = (id, w, h) => ({
      url: `https://picsum.photos/seed/${id}/${w}/${h}`,
      thumbnailUrl: `https://picsum.photos/seed/${id}/300/300`,
      sortOrder: 0,
    });

    const pendingListings = [
      {
        title: 'Samsung Galaxy A54 - Brand New Sealed',
        description: 'Brand new Samsung Galaxy A54 with box and all accessories.\n\n- 8GB RAM / 128GB Storage\n- Super AMOLED Display\n- 50MP Triple Camera\n- 5000mAh Battery\n- PTA Approved\n\nSealed pack, never opened. Warranty card included.\nShop: Mobile Hub, Hall Road, Lahore',
        price: 65000, condition: 'new',
        categoryAttributes: { brand: 'Samsung', model: 'Galaxy A54', storage: '128GB', ram: '8GB', pta_status: 'PTA Approved', color: 'Black' },
        selectedFeatures: ['Charger', 'Box', 'Earphones', 'Screen Protector', 'Receipt/Warranty Card'],
        images: [img('phone1', 800, 600), img('phone1b', 800, 600), img('phone1c', 800, 600)],
      },
      {
        title: 'Honda City 2019 - Excellent Condition',
        description: 'Honda City 1.5L Aspire CVT 2019 model.\n\nSingle owner, company maintained. All documents clear.\n- Mileage: 45,000 km\n- Automatic Transmission\n- Sunroof\n- Multimedia with Navigation\n- Alloy Rims\n\nSerious buyers only. No exchange.',
        price: 3200000, condition: 'used',
        categoryAttributes: { make: 'Honda', model: 'City', year: 2019, mileage: 45000, fuel_type: 'Petrol', transmission: 'Automatic', color: 'White', body_type: 'Sedan', engine_cc: 1500, assembly: 'Local' },
        selectedFeatures: ['Air Conditioning', 'Power Windows', 'Power Steering', 'ABS', 'Air Bags', 'Alloy Rims', 'Navigation System', 'Sun Roof', 'Rear Camera', 'Keyless Entry'],
        images: [img('car1', 800, 600), img('car1b', 800, 600), img('car1c', 800, 600), img('car1d', 800, 600)],
      },
      {
        title: 'MacBook Air M2 2023 - Like New',
        description: 'MacBook Air M2 chip, 2023 model.\n\n- 8GB Unified Memory\n- 256GB SSD\n- 13.6" Liquid Retina Display\n- Midnight Color\n- Battery cycle count: 32\n\nBarely used, in perfect condition. Comes with original charger and box.',
        price: 280000, condition: 'used',
        categoryAttributes: { brand: 'Apple', model: 'MacBook Air M2' },
        selectedFeatures: ['Charger', 'Box'],
        images: [img('laptop1', 800, 600), img('laptop1b', 800, 600)],
      },
      {
        title: 'Premium Leather Sofa Set - 7 Seater',
        description: 'Imported premium leather sofa set.\n\n- 7 seater (3+2+1+1)\n- Dark brown genuine leather\n- Solid wood frame\n- Foam cushions\n- 2 years old, excellent condition\n\nSelling due to relocation. Price is slightly negotiable.',
        price: 95000, condition: 'used',
        categoryAttributes: { seating_type: 'Sofa Set', seating_capacity: '7 Seater', material: 'Leather' },
        selectedFeatures: ['With Cushions', 'Solid Wood Frame'],
        images: [img('sofa1', 800, 600), img('sofa1b', 800, 600)],
      },
      {
        title: 'Persian Cat - Triple Coat White',
        description: 'Beautiful Persian cat for sale.\n\n- Breed: Persian (Triple Coat)\n- Age: 6 months\n- Color: Pure White\n- Gender: Female\n- Vaccinated and dewormed\n- Litter trained\n\nVery friendly and playful. Comes with food and litter box.',
        price: 15000, condition: 'new',
        categoryAttributes: { breed: 'Persian', color: 'White', gender: 'Female', age: '6 months' },
        selectedFeatures: ['Vaccinated', 'Litter Trained', 'Dewormed', 'With Accessories'],
        images: [img('cat1', 800, 600), img('cat1b', 800, 600), img('cat1c', 800, 600)],
      },
      {
        title: 'iPhone 14 Pro - 128GB Deep Purple',
        description: 'iPhone 14 Pro 128GB in Deep Purple color.\n\n- PTA Approved\n- Battery Health: 94%\n- All original accessories included\n- No scratches, used with case and screen protector\n- Face ID working perfectly\n\nReason for selling: Upgraded to iPhone 16.',
        price: 185000, condition: 'used',
        categoryAttributes: { brand: 'Apple', model: 'iPhone 14 Pro', storage: '128GB', pta_status: 'PTA Approved', battery_health: '94%', color: 'Deep Purple' },
        selectedFeatures: ['Charger', 'Box', 'Back Cover', 'Screen Protector'],
        images: [img('iphone1', 800, 600), img('iphone1b', 800, 600)],
      },
      {
        title: 'Toyota Yaris 2022 ATIV CVT - White',
        description: 'Toyota Yaris ATIV 1.5 CVT 2022.\n\n- Automatic Transmission\n- White Color\n- 25,000 km driven\n- First owner\n- Islamabad registered\n- Company maintained\n\nAll documents complete. Token paid till Dec 2026.',
        price: 4500000, condition: 'used',
        categoryAttributes: { make: 'Toyota', model: 'Yaris', year: 2022, mileage: 25000, fuel_type: 'Petrol', transmission: 'Automatic', color: 'White', engine_cc: 1500, registration_city: 'Islamabad', assembly: 'Local' },
        selectedFeatures: ['Air Conditioning', 'Power Windows', 'Power Steering', 'ABS', 'Air Bags', 'Rear Camera', 'USB & Auxillary Cable', 'Immobilizer Key'],
        images: [img('yaris1', 800, 600), img('yaris1b', 800, 600), img('yaris1c', 800, 600)],
      },
      {
        title: 'Custom Gaming PC - RTX 4060 Ti',
        description: 'High-end custom gaming PC build.\n\nSpecs:\n- CPU: Intel Core i5-13400F\n- GPU: NVIDIA RTX 4060 Ti 8GB\n- RAM: 16GB DDR5 5200MHz\n- SSD: 512GB NVMe\n- PSU: 650W 80+ Bronze\n- Case: Cooler Master with RGB fans\n\nBuilt 3 months ago. Runs all AAA games at 1440p 60fps+.\nIncludes keyboard and mouse.',
        price: 175000, condition: 'new',
        categoryAttributes: {},
        selectedFeatures: [],
        images: [img('pc1', 800, 600), img('pc1b', 800, 600)],
      },
    ];

    // Remove old pending listings
    await db.collection('product_listings').deleteMany({ status: 'pending_review' });

    const pendingDocs = pendingListings.map((item, i) => {
      const user = users[i % users.length];
      const cat = allCategories.length > 0 ? allCategories[i % allCategories.length] : null;
      const daysAgo = Math.floor(Math.random() * 10) + 1;
      return {
        sellerId: user._id,
        title: item.title,
        description: item.description,
        price: { amount: item.price, currency: 'PKR' },
        categoryId: cat ? cat._id : new ObjectId(),
        categoryPath: cat ? [cat._id] : [],
        condition: item.condition,
        categoryAttributes: item.categoryAttributes || {},
        selectedFeatures: item.selectedFeatures || [],
        images: item.images || [],
        location: { city: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi'][i % 4], area: ['DHA Phase 5', 'Gulberg', 'F-10', 'Bahria Town'][i % 4] },
        contactInfo: { phone: user.phone || '', email: user.email || '' },
        status: 'pending_review',
        isFeatured: false,
        viewCount: 0,
        favoriteCount: 0,
        createdAt: new Date(now.getTime() - daysAgo * 86400000),
        updatedAt: new Date(now.getTime() - daysAgo * 86400000),
      };
    });

    const inserted = await db.collection('product_listings').insertMany(pendingDocs);
    console.log(`Inserted ${inserted.insertedCount} pending review listings`);

  } finally {
    await client.close();
  }
}

seed().catch(console.error);
