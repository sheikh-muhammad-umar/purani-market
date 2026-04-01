/* eslint-disable */
// Seed 3-level categories — run with: node backend/scripts/seed-categories.js
const { MongoClient, ObjectId } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const now = new Date();

// Helper
const cat = (name, slug, level, parentId, sortOrder, attributes = [], filters = []) => ({
  _id: new ObjectId(), name, slug, level, parentId, isActive: true, sortOrder, attributes, filters, createdAt: now, updatedAt: now,
});

// ── Level 1 ─────────────────────────────────────────────
const vehicles   = cat('Vehicles', 'vehicles', 1, null, 0);
const electronics = cat('Electronics', 'electronics', 1, null, 1);
const property   = cat('Property', 'property', 1, null, 2);
const fashion    = cat('Fashion', 'fashion', 1, null, 3);
const furniture  = cat('Furniture', 'furniture', 1, null, 4);
const jobs       = cat('Jobs', 'jobs', 1, null, 5);
const services   = cat('Services', 'services', 1, null, 6);
const kids       = cat('Kids & Baby', 'kids-baby', 1, null, 7);
const sports     = cat('Sports & Hobbies', 'sports-hobbies', 1, null, 8);
const pets       = cat('Pets & Animals', 'pets-animals', 1, null, 9);

const L1 = [vehicles, electronics, property, fashion, furniture, jobs, services, kids, sports, pets];

// ── Level 2 ─────────────────────────────────────────────
const cars = cat('Cars', 'cars', 2, vehicles._id, 0,
  [
    { name: 'Make', key: 'make', type: 'select', options: ['Toyota','Honda','Suzuki','Hyundai','KIA','BMW','Mercedes','Audi','Nissan','Mitsubishi'], required: true },
    { name: 'Model', key: 'model', type: 'text', required: true },
    { name: 'Year', key: 'year', type: 'number', required: true },
    { name: 'Mileage', key: 'mileage', type: 'number', unit: 'km', required: false },
    { name: 'Fuel Type', key: 'fuel_type', type: 'select', options: ['Petrol','Diesel','CNG','Hybrid','Electric'], required: false },
    { name: 'Transmission', key: 'transmission', type: 'select', options: ['Automatic','Manual'], required: false },
  ],
  [
    { name: 'Make', key: 'make', type: 'select', options: ['Toyota','Honda','Suzuki','Hyundai','KIA'] },
    { name: 'Price', key: 'price', type: 'range', rangeMin: 0, rangeMax: 50000000 },
    { name: 'Year', key: 'year', type: 'range', rangeMin: 2000, rangeMax: 2026 },
    { name: 'Transmission', key: 'transmission', type: 'select', options: ['Automatic','Manual'] },
  ]);
const motorcycles = cat('Motorcycles', 'motorcycles', 2, vehicles._id, 1,
  [
    { name: 'Make', key: 'make', type: 'select', options: ['Honda','Yamaha','Suzuki','Kawasaki','United','Road Prince'], required: true },
    { name: 'Engine CC', key: 'engine_cc', type: 'number', unit: 'cc', required: true },
  ], []);
const buses      = cat('Buses & Vans', 'buses-vans', 2, vehicles._id, 2);
const trucks     = cat('Trucks', 'trucks', 2, vehicles._id, 3);
const autoparts  = cat('Auto Parts', 'auto-parts', 2, vehicles._id, 4);

const phones = cat('Mobile Phones', 'mobile-phones', 2, electronics._id, 0,
  [
    { name: 'Brand', key: 'brand', type: 'select', options: ['Apple','Samsung','Xiaomi','OnePlus','Oppo','Vivo','Realme','Google','Huawei'], required: true },
    { name: 'Storage', key: 'storage', type: 'select', options: ['32GB','64GB','128GB','256GB','512GB','1TB'], required: true },
    { name: 'RAM', key: 'ram', type: 'select', options: ['2GB','3GB','4GB','6GB','8GB','12GB','16GB'], required: false },
    { name: 'PTA Status', key: 'pta_status', type: 'select', options: ['PTA Approved','Non-PTA','JV'], required: false },
  ],
  [
    { name: 'Brand', key: 'brand', type: 'select', options: ['Apple','Samsung','Xiaomi','OnePlus'] },
    { name: 'Storage', key: 'storage', type: 'multiselect', options: ['64GB','128GB','256GB','512GB'] },
  ]);
const laptops    = cat('Laptops', 'laptops', 2, electronics._id, 1,
  [
    { name: 'Brand', key: 'brand', type: 'select', options: ['Apple','Dell','HP','Lenovo','Asus','Acer','MSI'], required: true },
    { name: 'RAM', key: 'ram', type: 'select', options: ['4GB','8GB','16GB','32GB','64GB'], required: false },
    { name: 'Processor', key: 'processor', type: 'text', required: false },
  ], []);
const tablets    = cat('Tablets', 'tablets', 2, electronics._id, 2);
const tvs        = cat('TVs & Monitors', 'tvs-monitors', 2, electronics._id, 3);
const cameras    = cat('Cameras', 'cameras', 2, electronics._id, 4);
const gaming     = cat('Gaming', 'gaming', 2, electronics._id, 5);
const accessories = cat('Accessories', 'accessories', 2, electronics._id, 6);

const houses     = cat('Houses', 'houses', 2, property._id, 0,
  [
    { name: 'Bedrooms', key: 'bedrooms', type: 'number', required: true },
    { name: 'Bathrooms', key: 'bathrooms', type: 'number', required: true },
    { name: 'Area', key: 'area', type: 'number', unit: 'sqft', required: true },
    { name: 'Furnishing', key: 'furnishing', type: 'select', options: ['Furnished','Semi-Furnished','Unfurnished'], required: false },
  ],
  [
    { name: 'Bedrooms', key: 'bedrooms', type: 'range', rangeMin: 1, rangeMax: 10 },
    { name: 'Area', key: 'area', type: 'range', rangeMin: 500, rangeMax: 10000 },
    { name: 'Furnishing', key: 'furnishing', type: 'select', options: ['Furnished','Semi-Furnished','Unfurnished'] },
  ]);
const apartments = cat('Apartments', 'apartments', 2, property._id, 1,
  [
    { name: 'Bedrooms', key: 'bedrooms', type: 'number', required: true },
    { name: 'Floor', key: 'floor', type: 'number', required: false },
    { name: 'Area', key: 'area', type: 'number', unit: 'sqft', required: true },
  ], []);
const plots      = cat('Plots & Land', 'plots-land', 2, property._id, 2);
const commercial = cat('Commercial', 'commercial', 2, property._id, 3);
const rooms      = cat('Rooms', 'rooms', 2, property._id, 4);

const menClothing   = cat("Men's Clothing", 'mens-clothing', 2, fashion._id, 0);
const womenClothing = cat("Women's Clothing", 'womens-clothing', 2, fashion._id, 1);
const shoes         = cat('Shoes', 'shoes', 2, fashion._id, 2);
const watches       = cat('Watches', 'watches', 2, fashion._id, 3);
const bags          = cat('Bags & Luggage', 'bags-luggage', 2, fashion._id, 4);
const jewelry       = cat('Jewelry', 'jewelry', 2, fashion._id, 5);

const sofas      = cat('Sofas & Chairs', 'sofas-chairs', 2, furniture._id, 0);
const beds       = cat('Beds & Mattresses', 'beds-mattresses', 2, furniture._id, 1);
const tables     = cat('Tables & Dining', 'tables-dining', 2, furniture._id, 2);
const garden     = cat('Garden & Outdoor', 'garden-outdoor', 2, furniture._id, 3);
const office     = cat('Office Furniture', 'office-furniture', 2, furniture._id, 4);

const itJobs     = cat('IT & Software', 'it-software', 2, jobs._id, 0);
const marketing  = cat('Marketing & Sales', 'marketing-sales', 2, jobs._id, 1);
const education  = cat('Education & Teaching', 'education-teaching', 2, jobs._id, 2);
const healthcare = cat('Healthcare', 'healthcare', 2, jobs._id, 3);

const homeServices = cat('Home Services', 'home-services', 2, services._id, 0);
const repair       = cat('Repair & Maintenance', 'repair-maintenance', 2, services._id, 1);
const events       = cat('Events & Catering', 'events-catering', 2, services._id, 2);

const babyClothing = cat('Baby Clothing', 'baby-clothing', 2, kids._id, 0);
const toys         = cat('Toys', 'toys', 2, kids._id, 1);
const strollers    = cat('Strollers & Carriers', 'strollers-carriers', 2, kids._id, 2);

const gym          = cat('Gym & Fitness', 'gym-fitness', 2, sports._id, 0);
const bicycles     = cat('Bicycles', 'bicycles', 2, sports._id, 1);
const outdoor      = cat('Outdoor Sports', 'outdoor-sports', 2, sports._id, 2);
const musical      = cat('Musical Instruments', 'musical-instruments', 2, sports._id, 3);

const dogs         = cat('Dogs', 'dogs', 2, pets._id, 0);
const cats_        = cat('Cats', 'cats', 2, pets._id, 1);
const birds        = cat('Birds', 'birds', 2, pets._id, 2);
const petFood      = cat('Pet Food & Accessories', 'pet-food-accessories', 2, pets._id, 3);

const L2 = [
  cars, motorcycles, buses, trucks, autoparts,
  phones, laptops, tablets, tvs, cameras, gaming, accessories,
  houses, apartments, plots, commercial, rooms,
  menClothing, womenClothing, shoes, watches, bags, jewelry,
  sofas, beds, tables, garden, office,
  itJobs, marketing, education, healthcare,
  homeServices, repair, events,
  babyClothing, toys, strollers,
  gym, bicycles, outdoor, musical,
  dogs, cats_, birds, petFood,
];

// ── Level 3 ─────────────────────────────────────────────
const L3 = [
  // Vehicles > Cars
  cat('Sedans', 'sedans', 3, cars._id, 0),
  cat('SUVs', 'suvs', 3, cars._id, 1),
  cat('Hatchbacks', 'hatchbacks', 3, cars._id, 2),
  cat('Pickup Trucks', 'pickup-trucks', 3, cars._id, 3),
  cat('Luxury Cars', 'luxury-cars', 3, cars._id, 4),

  // Vehicles > Motorcycles
  cat('Sport Bikes', 'sport-bikes', 3, motorcycles._id, 0),
  cat('Cruisers', 'cruisers', 3, motorcycles._id, 1),
  cat('Scooters', 'scooters', 3, motorcycles._id, 2),
  cat('Electric Bikes', 'electric-bikes', 3, motorcycles._id, 3),

  // Electronics > Mobile Phones
  cat('Smartphones', 'smartphones', 3, phones._id, 0),
  cat('Feature Phones', 'feature-phones', 3, phones._id, 1),
  cat('Phone Accessories', 'phone-accessories', 3, phones._id, 2),

  // Electronics > Laptops
  cat('Gaming Laptops', 'gaming-laptops', 3, laptops._id, 0),
  cat('Business Laptops', 'business-laptops', 3, laptops._id, 1),
  cat('MacBooks', 'macbooks', 3, laptops._id, 2),
  cat('Chromebooks', 'chromebooks', 3, laptops._id, 3),

  // Electronics > Gaming
  cat('PlayStation', 'playstation', 3, gaming._id, 0),
  cat('Xbox', 'xbox', 3, gaming._id, 1),
  cat('Nintendo', 'nintendo', 3, gaming._id, 2),
  cat('PC Gaming', 'pc-gaming', 3, gaming._id, 3),

  // Property > Houses
  cat('Villas', 'villas', 3, houses._id, 0),
  cat('Townhouses', 'townhouses', 3, houses._id, 1),
  cat('Farm Houses', 'farm-houses', 3, houses._id, 2),

  // Property > Apartments
  cat('Studio Apartments', 'studio-apartments', 3, apartments._id, 0),
  cat('Penthouses', 'penthouses', 3, apartments._id, 1),
  cat('Serviced Apartments', 'serviced-apartments', 3, apartments._id, 2),

  // Property > Commercial
  cat('Offices', 'offices', 3, commercial._id, 0),
  cat('Shops', 'shops', 3, commercial._id, 1),
  cat('Warehouses', 'warehouses', 3, commercial._id, 2),

  // Fashion > Men's Clothing
  cat('Shirts', 'mens-shirts', 3, menClothing._id, 0),
  cat('Pants & Jeans', 'mens-pants', 3, menClothing._id, 1),
  cat('Suits & Blazers', 'suits-blazers', 3, menClothing._id, 2),
  cat('Traditional Wear', 'mens-traditional', 3, menClothing._id, 3),

  // Fashion > Women's Clothing
  cat('Dresses', 'dresses', 3, womenClothing._id, 0),
  cat('Tops & Blouses', 'tops-blouses', 3, womenClothing._id, 1),
  cat('Shalwar Kameez', 'shalwar-kameez', 3, womenClothing._id, 2),
  cat('Abayas & Hijabs', 'abayas-hijabs', 3, womenClothing._id, 3),

  // Fashion > Shoes
  cat('Sneakers', 'sneakers', 3, shoes._id, 0),
  cat('Formal Shoes', 'formal-shoes', 3, shoes._id, 1),
  cat('Sandals & Slippers', 'sandals-slippers', 3, shoes._id, 2),
  cat('Heels', 'heels', 3, shoes._id, 3),

  // Furniture > Sofas
  cat('L-Shape Sofas', 'l-shape-sofas', 3, sofas._id, 0),
  cat('Recliners', 'recliners', 3, sofas._id, 1),
  cat('Bean Bags', 'bean-bags', 3, sofas._id, 2),

  // Sports > Gym & Fitness
  cat('Treadmills', 'treadmills', 3, gym._id, 0),
  cat('Dumbbells & Weights', 'dumbbells-weights', 3, gym._id, 1),
  cat('Yoga & Pilates', 'yoga-pilates', 3, gym._id, 2),

  // Sports > Outdoor
  cat('Cricket', 'cricket', 3, outdoor._id, 0),
  cat('Football', 'football', 3, outdoor._id, 1),
  cat('Camping & Hiking', 'camping-hiking', 3, outdoor._id, 2),

  // Kids > Toys
  cat('Action Figures', 'action-figures', 3, toys._id, 0),
  cat('Board Games', 'board-games', 3, toys._id, 1),
  cat('Educational Toys', 'educational-toys', 3, toys._id, 2),
  cat('Remote Control', 'remote-control', 3, toys._id, 3),

  // Pets > Dogs
  cat('German Shepherd', 'german-shepherd', 3, dogs._id, 0),
  cat('Labrador', 'labrador', 3, dogs._id, 1),
  cat('Poodle', 'poodle', 3, dogs._id, 2),

  // Pets > Birds
  cat('Parrots', 'parrots', 3, birds._id, 0),
  cat('Pigeons', 'pigeons', 3, birds._id, 1),
  cat('Canaries', 'canaries', 3, birds._id, 2),
];

const allCategories = [...L1, ...L2, ...L3];

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');

    await db.collection('categories').deleteMany({});
    console.log('Cleared categories');

    await db.collection('categories').insertMany(allCategories);
    console.log(`Inserted ${allCategories.length} categories:`);
    console.log(`  Level 1: ${L1.length} root categories`);
    console.log(`  Level 2: ${L2.length} subcategories`);
    console.log(`  Level 3: ${L3.length} sub-subcategories`);

    await db.collection('categories').createIndex({ slug: 1 }, { unique: true });
    await db.collection('categories').createIndex({ parentId: 1 });
    await db.collection('categories').createIndex({ level: 1 });

    console.log('\n✅ Categories seeded! Tree structure:');
    for (const root of L1) {
      const children = L2.filter(c => c.parentId?.equals(root._id));
      console.log(`  ${root.name}`);
      for (const child of children) {
        const grandchildren = L3.filter(c => c.parentId?.equals(child._id));
        console.log(`    └─ ${child.name}${grandchildren.length ? '' : ''}`);
        for (const gc of grandchildren) {
          console.log(`        └─ ${gc.name}`);
        }
      }
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
