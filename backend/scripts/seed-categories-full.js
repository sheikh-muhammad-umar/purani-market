const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

// Category data — attributes serve as both form fields AND search filters.
// Features are optional toggles (chips) shown when posting/viewing.
const categoriesData = [
  // ===== MOBILES =====
  {
    name: 'Mobiles', slug: 'mobiles', parent: null, level: 1, sortOrder: 1, icon: '📱', color: '#FFD658',
    attributes: [
      { name: 'Condition', key: 'condition_detail', type: 'select', options: ['New', 'Used', 'Refurbished', 'Open Box'], required: false },
      { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Oppo', 'Vivo', 'Realme', 'Google', 'Motorola', 'Huawei', 'Nokia', 'Infinix', 'Tecno'], required: false },
    ],
    children: [
      {
        name: 'Mobile Phones', slug: 'mobile-phones', sortOrder: 1,
        attributes: [
          { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Oppo', 'Vivo', 'Realme', 'Google', 'Motorola', 'Huawei', 'Nokia', 'Infinix', 'Tecno'], required: true },
          { name: 'Model', key: 'model', type: 'text', required: true },
          { name: 'Storage', key: 'storage', type: 'select', options: ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: true },
          { name: 'RAM', key: 'ram', type: 'select', options: ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'], required: false },
          { name: 'PTA Status', key: 'pta_status', type: 'select', options: ['PTA Approved', 'Non-PTA', 'JV', 'CPID Not Generated'], required: false },
          { name: 'Battery Health', key: 'battery_health', type: 'text', required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
        ],
        features: ['Charger', 'Box', 'Earphones', 'Screen Protector', 'Back Cover', 'Receipt/Warranty Card'],
      },
      {
        name: 'Accessories', slug: 'mobile-accessories', sortOrder: 2,
        children: [
          { name: 'Earphones', slug: 'earphones', sortOrder: 1 },
          { name: 'Headphones', slug: 'headphones', sortOrder: 2 },
          { name: 'Chargers', slug: 'chargers', sortOrder: 3 },
          { name: 'Covers & Cases', slug: 'covers-cases', sortOrder: 4 },
          { name: 'Power Banks', slug: 'power-banks', sortOrder: 5 },
          { name: 'Charging Cables', slug: 'charging-cables', sortOrder: 6 },
          { name: 'Screen Protectors', slug: 'screen-protectors', sortOrder: 7 },
          { name: 'Mobile Stands', slug: 'mobile-stands', sortOrder: 8 },
          { name: 'Selfie Sticks', slug: 'selfie-sticks', sortOrder: 9 },
          { name: 'Ring Lights', slug: 'ring-lights', sortOrder: 10 },
          { name: 'External Memory', slug: 'external-memory', sortOrder: 11 },
          { name: 'Converters', slug: 'converters', sortOrder: 12 },
          { name: 'Screens', slug: 'screens', sortOrder: 13 },
          { name: 'Other Accessories', slug: 'other-mobile-accessories', sortOrder: 14 },
        ],
      },
      { name: 'Smart Watches', slug: 'smart-watches', sortOrder: 3,
        attributes: [
          { name: 'Brand', key: 'brand', type: 'text', required: false },
          { name: 'Connectivity', key: 'connectivity', type: 'select', options: ['Bluetooth', 'WiFi', 'Cellular'], required: false },
        ],
      },
      { name: 'Tablets', slug: 'tablets', sortOrder: 4,
        attributes: [
          { name: 'Brand', key: 'brand', type: 'select', options: ['Apple', 'Samsung', 'Huawei', 'Lenovo', 'Amazon'], required: false },
          { name: 'Storage', key: 'storage', type: 'select', options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'], required: false },
        ],
      },
    ],
  },

  // ===== VEHICLES =====
  {
    name: 'Vehicles', slug: 'vehicles', parent: null, level: 1, sortOrder: 2, icon: '🚗', color: '#FE7500',
    attributes: [],
    children: [
      {
        name: 'Cars', slug: 'cars', sortOrder: 1,
        attributes: [
          { name: 'Make', key: 'make', type: 'select', options: ['Toyota', 'Honda', 'Suzuki', 'Hyundai', 'KIA', 'BMW', 'Mercedes', 'Audi', 'Nissan', 'Mitsubishi', 'Daihatsu', 'Changan', 'MG', 'Proton', 'FAW', 'Prince', 'United'], required: true },
          { name: 'Model', key: 'model', type: 'text', required: true },
          { name: 'Year', key: 'year', type: 'number', required: true },
          { name: 'Mileage', key: 'mileage', type: 'number', unit: 'km', required: false },
          { name: 'Fuel Type', key: 'fuel_type', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Hybrid', 'Electric', 'LPG'], required: false },
          { name: 'Transmission', key: 'transmission', type: 'select', options: ['Automatic', 'Manual'], required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
          { name: 'Body Type', key: 'body_type', type: 'select', options: ['Sedan', 'Hatchback', 'SUV', 'MPV', 'Pickup', 'Coupe', 'Crossover', 'Van', 'Wagon'], required: false },
          { name: 'Engine Capacity', key: 'engine_cc', type: 'number', unit: 'cc', required: false },
          { name: 'Number of Owners', key: 'owners', type: 'number', required: false },
          { name: 'Registration City', key: 'registration_city', type: 'text', required: false },
          { name: 'Assembly', key: 'assembly', type: 'select', options: ['Local', 'Imported'], required: false },
        ],
        features: ['ABS', 'Air Bags', 'Air Conditioning', 'Alloy Rims', 'AM/FM Radio', 'CD Player', 'Cool Box', 'Cruise Control', 'Climate Control', 'DVD Player', 'Front Camera', 'Heated Seats', 'Immobilizer Key', 'Keyless Entry', 'Navigation System', 'Power Locks', 'Power Mirrors', 'Power Steering', 'Power Windows', 'Rear AC Vent', 'Rear Camera', 'Sun Roof', 'Steering Switches', 'USB & Auxillary Cable'],
      },
      { name: 'Cars Accessories', slug: 'cars-accessories', sortOrder: 2 },
      { name: 'Spare Parts', slug: 'car-spare-parts', sortOrder: 3 },
      { name: 'Buses, Vans & Trucks', slug: 'buses-vans-trucks', sortOrder: 4 },
      { name: 'Rickshaw & Chingchi', slug: 'rickshaw-chingchi', sortOrder: 5 },
      { name: 'Tractors & Trailers', slug: 'tractors-trailers', sortOrder: 6 },
      { name: 'Cars on Installments', slug: 'cars-installments', sortOrder: 7 },
      { name: 'Boats', slug: 'boats', sortOrder: 8 },
      { name: 'Other Vehicles', slug: 'other-vehicles', sortOrder: 9 },
    ],
  },

  // ===== PROPERTY FOR SALE =====
  {
    name: 'Property for Sale', slug: 'property-sale', parent: null, level: 1, sortOrder: 3, icon: '🏠', color: '#0CC0DF',
    attributes: [
      { name: 'Area Size', key: 'area_size', type: 'number', unit: 'sq ft', required: false },
      { name: 'Area Unit', key: 'area_unit', type: 'select', options: ['Marla', 'Kanal', 'Sq. Ft.', 'Sq. Yd.', 'Sq. M.'], required: false },
    ],
    children: [
      { name: 'Land & Plots', slug: 'land-plots-sale', sortOrder: 1 },
      { name: 'Houses', slug: 'houses-sale', sortOrder: 2,
        attributes: [
          { name: 'Bedrooms', key: 'bedrooms', type: 'number', required: false },
          { name: 'Bathrooms', key: 'bathrooms', type: 'number', required: false },
        ],
        features: ['Parking', 'Lawn/Garden', 'Servant Quarter', 'Drawing Room', 'Dining Room', 'Store Room', 'Laundry Room', 'Study Room', 'Powder Room', 'Gym', 'Swimming Pool', 'Security', 'CCTV', 'Boundary Wall', 'Electricity Backup', 'Gas', 'Water Supply', 'Sewerage'],
      },
      { name: 'Apartments & Flats', slug: 'apartments-sale', sortOrder: 3,
        attributes: [
          { name: 'Bedrooms', key: 'bedrooms', type: 'number', required: false },
          { name: 'Bathrooms', key: 'bathrooms', type: 'number', required: false },
          { name: 'Floor', key: 'floor', type: 'number', required: false },
        ],
        features: ['Lift/Elevator', 'Parking', 'Security', 'CCTV', 'Intercom', 'Electricity Backup', 'Gas', 'Central Heating', 'Central Cooling'],
      },
      { name: 'Shops - Offices - Commercial', slug: 'commercial-sale', sortOrder: 4 },
      { name: 'Portions & Floors', slug: 'portions-sale', sortOrder: 5 },
    ],
  },

  // ===== PROPERTY FOR RENT =====
  {
    name: 'Property for Rent', slug: 'property-rent', parent: null, level: 1, sortOrder: 4, icon: '🏢', color: '#B6D84C',
    attributes: [
      { name: 'Area Size', key: 'area_size', type: 'number', unit: 'sq ft', required: false },
    ],
    children: [
      { name: 'Houses', slug: 'houses-rent', sortOrder: 1 },
      { name: 'Apartments & Flats', slug: 'apartments-rent', sortOrder: 2 },
      { name: 'Portions & Floors', slug: 'portions-rent', sortOrder: 3 },
      { name: 'Rooms', slug: 'rooms-rent', sortOrder: 4 },
      { name: 'Shops - Offices - Commercial', slug: 'commercial-rent', sortOrder: 5 },
      { name: 'Roommates & Paying Guests', slug: 'roommates', sortOrder: 6 },
      { name: 'Vacation Rentals', slug: 'vacation-rentals', sortOrder: 7 },
    ],
  },

  // ===== ELECTRONICS =====
  {
    name: 'Electronics & Home Appliances', slug: 'electronics', parent: null, level: 1, sortOrder: 5, icon: '💻', color: '#F35145',
    attributes: [],
    children: [
      { name: 'Computers & Accessories', slug: 'computers', sortOrder: 1 },
      { name: 'TV - Video - Audio', slug: 'tv-video-audio', sortOrder: 2 },
      { name: 'AC & Coolers', slug: 'ac-coolers', sortOrder: 3 },
      { name: 'Kitchen Appliances', slug: 'kitchen-appliances', sortOrder: 4 },
      { name: 'Fridges & Freezers', slug: 'fridges-freezers', sortOrder: 5 },
      { name: 'Washing Machines & Dryers', slug: 'washing-machines', sortOrder: 6 },
      { name: 'Cameras & Accessories', slug: 'cameras', sortOrder: 7 },
      { name: 'Games & Entertainment', slug: 'games-entertainment', sortOrder: 8 },
      { name: 'Generators & UPS', slug: 'generators-ups', sortOrder: 9 },
      { name: 'Other Home Appliances', slug: 'other-appliances', sortOrder: 10 },
    ],
  },

  // ===== BIKES =====
  {
    name: 'Bikes', slug: 'bikes', parent: null, level: 1, sortOrder: 6, icon: '🏍️', color: '#0097B2',
    attributes: [
      { name: 'Make', key: 'make', type: 'text', required: false },
      { name: 'Model', key: 'model', type: 'text', required: false },
      { name: 'Year', key: 'year', type: 'number', required: false },
      { name: 'Engine Capacity', key: 'engine_cc', type: 'number', unit: 'cc', required: false },
      { name: 'Mileage', key: 'mileage', type: 'number', unit: 'km', required: false },
    ],
    children: [
      {
        name: 'Motorcycles', slug: 'motorcycles', sortOrder: 1,
        features: ['Self Start', 'Alloy Rims', 'Front Disc Brake', 'Rear Disc Brake', 'Wind Shield', 'Back Rest'],
        children: [
          { name: 'Standard', slug: 'standard-bikes', sortOrder: 1 },
          { name: 'Sports & Heavy Bikes', slug: 'sports-heavy-bikes', sortOrder: 2 },
          { name: 'Electric Bikes', slug: 'electric-bikes', sortOrder: 3 },
          { name: 'Cafe Racers', slug: 'cafe-racers', sortOrder: 4 },
          { name: 'Cruisers', slug: 'cruisers', sortOrder: 5 },
          { name: 'Trail', slug: 'trail-bikes', sortOrder: 6 },
          { name: 'Others', slug: 'other-motorcycles', sortOrder: 7 },
        ],
      },
      {
        name: 'Bicycles', slug: 'bicycles', sortOrder: 2,
        children: [
          { name: 'Road Bikes', slug: 'road-bikes', sortOrder: 1 },
          { name: 'Mountain Bikes', slug: 'mountain-bikes', sortOrder: 2 },
          { name: 'Hybrid Bikes', slug: 'hybrid-bikes', sortOrder: 3 },
          { name: 'BMX Bikes', slug: 'bmx-bikes', sortOrder: 4 },
          { name: 'Folding Bikes', slug: 'folding-bikes', sortOrder: 5 },
          { name: 'Electric Bicycles', slug: 'electric-bicycles', sortOrder: 6 },
        ],
      },
      { name: 'Scooters', slug: 'scooters', sortOrder: 3 },
      { name: 'ATV & Quads', slug: 'atv-quads', sortOrder: 4 },
      {
        name: 'Spare Parts', slug: 'bike-spare-parts', sortOrder: 5,
        children: [
          { name: 'Tyres & Tubes', slug: 'bike-tyres', sortOrder: 1 },
          { name: 'Exhausts', slug: 'bike-exhausts', sortOrder: 2 },
          { name: 'Brakes', slug: 'bike-brakes', sortOrder: 3 },
          { name: 'Batteries', slug: 'bike-batteries', sortOrder: 4 },
          { name: 'Lighting', slug: 'bike-lighting', sortOrder: 5 },
          { name: 'Other Spare Parts', slug: 'other-bike-parts', sortOrder: 6 },
        ],
      },
      {
        name: 'Bikes Accessories', slug: 'bikes-accessories', sortOrder: 6,
        children: [
          { name: 'Helmets', slug: 'helmets', sortOrder: 1 },
          { name: 'Bike Covers', slug: 'bike-covers', sortOrder: 2 },
          { name: 'Bike Locks', slug: 'bike-locks', sortOrder: 3 },
          { name: 'Oils & Lubricants', slug: 'oils-lubricants', sortOrder: 4 },
          { name: 'Bike Gloves', slug: 'bike-gloves', sortOrder: 5 },
        ],
      },
    ],
  },

  // ===== BUSINESS =====
  {
    name: 'Business & Agriculture', slug: 'business', parent: null, level: 1, sortOrder: 7, icon: '🏭', color: '#00BF63',
    children: [
      { name: 'Food & Restaurants', slug: 'food-restaurants', sortOrder: 1 },
      { name: 'Medical & Pharma', slug: 'medical-pharma', sortOrder: 2 },
      { name: 'Trade & Industrial', slug: 'trade-industrial', sortOrder: 3 },
      { name: 'Construction & Machinery', slug: 'construction-machinery', sortOrder: 4 },
      { name: 'Business for Sale', slug: 'business-for-sale', sortOrder: 5 },
      { name: 'Agriculture', slug: 'agriculture', sortOrder: 6 },
      { name: 'Other Business', slug: 'other-business', sortOrder: 7 },
    ],
  },

  // ===== FASHION & BEAUTY =====
  {
    name: 'Fashion & Beauty', slug: 'fashion-beauty', parent: null, level: 1, sortOrder: 8, icon: '👗', color: '#E91E8C',
    attributes: [
      { name: 'Condition', key: 'condition_detail', type: 'select', options: ['New with Tags', 'New without Tags', 'Like New', 'Gently Used', 'Used'], required: false },
      { name: 'Gender', key: 'gender', type: 'select', options: ['Men', 'Women', 'Unisex', 'Boys', 'Girls'], required: false },
      { name: 'Brand', key: 'brand', type: 'text', required: false },
    ],
    children: [
      {
        name: 'Clothes', slug: 'clothes', sortOrder: 1,
        attributes: [
          { name: 'Type', key: 'clothing_type', type: 'select', options: ['Eastern', 'Western', 'Casual', 'Formal', 'Sports', 'Sleepwear', 'Innerwear'], required: false },
          { name: 'Size', key: 'size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size'], required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
          { name: 'Fabric', key: 'fabric', type: 'select', options: ['Cotton', 'Silk', 'Chiffon', 'Lawn', 'Linen', 'Polyester', 'Denim', 'Wool', 'Velvet', 'Organza', 'Net'], required: false },
        ],
        features: ['Stitched', 'Unstitched', 'Ready to Wear', 'Handmade', 'Embroidered', 'Printed', 'Branded', 'Imported'],
      },
      {
        name: 'Watches', slug: 'watches', sortOrder: 2,
        attributes: [
          { name: 'Brand', key: 'brand', type: 'select', options: ['Rolex', 'Casio', 'Seiko', 'Citizen', 'Fossil', 'Tissot', 'Omega', 'Tag Heuer', 'Apple', 'Samsung', 'Rado', 'Other'], required: false },
          { name: 'Type', key: 'watch_type', type: 'select', options: ['Analog', 'Digital', 'Smart Watch', 'Chronograph', 'Automatic'], required: false },
          { name: 'Strap Material', key: 'strap_material', type: 'select', options: ['Leather', 'Metal', 'Rubber', 'Silicone', 'Fabric', 'Ceramic'], required: false },
        ],
        features: ['Original', 'Box Included', 'Warranty Card', 'Water Resistant', 'Luminous', 'Date Display'],
      },
      {
        name: 'Skin & Hair', slug: 'skin-hair', sortOrder: 3,
        attributes: [
          { name: 'Type', key: 'product_type', type: 'select', options: ['Skincare', 'Haircare', 'Face Wash', 'Serum', 'Moisturizer', 'Sunscreen', 'Shampoo', 'Conditioner', 'Hair Oil', 'Hair Tool'], required: false },
        ],
        features: ['Organic', 'Paraben Free', 'Cruelty Free', 'Dermatologist Tested', 'Imported', 'Sealed/New'],
      },
      {
        name: 'Wedding', slug: 'wedding', sortOrder: 4,
        attributes: [
          { name: 'Category', key: 'wedding_category', type: 'select', options: ['Bridal Dress', 'Groom Sherwani', 'Mehndi Dress', 'Walima Dress', 'Baraat Dress', 'Decor', 'Jewellery Set', 'Accessories'], required: false },
          { name: 'Size', key: 'size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom'], required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
        ],
        features: ['Handmade', 'Embroidered', 'Heavy Work', 'Dabka', 'Zardozi', 'Sequins', 'Stone Work', 'Custom Stitched', 'Once Worn', 'Brand New'],
      },
      {
        name: 'Footwear', slug: 'footwear', sortOrder: 5,
        attributes: [
          { name: 'Type', key: 'footwear_type', type: 'select', options: ['Sneakers', 'Sandals', 'Heels', 'Flats', 'Boots', 'Loafers', 'Slippers', 'Khussas', 'Formal Shoes', 'Sports Shoes'], required: false },
          { name: 'Size', key: 'shoe_size', type: 'text', required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
        ],
        features: ['Branded', 'Imported', 'Handmade', 'Leather', 'Comfortable', 'Non-Slip Sole', 'Box Included'],
      },
      {
        name: 'Jewellery', slug: 'jewellery', sortOrder: 6,
        attributes: [
          { name: 'Type', key: 'jewellery_type', type: 'select', options: ['Necklace', 'Earrings', 'Bracelet', 'Ring', 'Anklet', 'Brooch', 'Set', 'Nose Pin', 'Bangles', 'Pendant'], required: false },
          { name: 'Material', key: 'material', type: 'select', options: ['Gold', 'Silver', 'Artificial', 'Platinum', 'Rose Gold', 'Stainless Steel', 'Copper', 'Pearl'], required: false },
        ],
        features: ['Handmade', 'Branded', 'Imported', 'Hypoallergenic', 'Tarnish Free', 'Gift Box Included', 'Adjustable'],
      },
      {
        name: 'Bags', slug: 'bags', sortOrder: 7,
        attributes: [
          { name: 'Type', key: 'bag_type', type: 'select', options: ['Handbag', 'Backpack', 'Clutch', 'Tote', 'Crossbody', 'Shoulder Bag', 'Wallet', 'Laptop Bag', 'Travel Bag', 'Pouch'], required: false },
          { name: 'Material', key: 'material', type: 'select', options: ['Leather', 'Faux Leather', 'Canvas', 'Nylon', 'Fabric', 'PU'], required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
        ],
        features: ['Branded', 'Imported', 'Handmade', 'Waterproof', 'Multiple Compartments', 'Adjustable Strap', 'Dust Bag Included'],
      },
      {
        name: 'Fragrance', slug: 'fragrance', sortOrder: 8,
        attributes: [
          { name: 'Type', key: 'fragrance_type', type: 'select', options: ['Perfume', 'Body Spray', 'Attar', 'Deodorant', 'Gift Set', 'Roll-On'], required: false },
          { name: 'Volume', key: 'volume', type: 'text', required: false },
          { name: 'Brand', key: 'brand', type: 'text', required: false },
        ],
        features: ['Original', 'Sealed', 'Long Lasting', 'Imported', 'Box Included', 'Tester'],
      },
      {
        name: 'Makeup', slug: 'makeup', sortOrder: 9,
        attributes: [
          { name: 'Type', key: 'makeup_type', type: 'select', options: ['Foundation', 'Lipstick', 'Mascara', 'Eyeliner', 'Blush', 'Concealer', 'Primer', 'Setting Spray', 'Palette', 'Brush Set', 'Nail Polish'], required: false },
          { name: 'Brand', key: 'brand', type: 'text', required: false },
        ],
        features: ['Original', 'Sealed', 'Imported', 'Cruelty Free', 'Waterproof', 'Long Lasting', 'Matte', 'Glossy'],
      },
      {
        name: 'Bath & Body', slug: 'bath-body', sortOrder: 10,
        attributes: [
          { name: 'Type', key: 'bath_type', type: 'select', options: ['Body Wash', 'Body Lotion', 'Soap', 'Scrub', 'Bath Bomb', 'Body Mist', 'Hand Cream', 'Gift Set'], required: false },
        ],
        features: ['Organic', 'Paraben Free', 'Imported', 'Sealed', 'Gift Set', 'Cruelty Free'],
      },
      {
        name: 'Fashion Accessories', slug: 'fashion-accessories', sortOrder: 11,
        attributes: [
          { name: 'Type', key: 'accessory_type', type: 'select', options: ['Sunglasses', 'Belt', 'Scarf', 'Hat/Cap', 'Tie', 'Cufflinks', 'Hair Accessories', 'Socks', 'Gloves', 'Dupatta'], required: false },
        ],
        features: ['Branded', 'Imported', 'Handmade', 'UV Protection', 'Adjustable'],
      },
      { name: 'Other Fashion', slug: 'other-fashion', sortOrder: 12 },
      {
        name: 'DIY Jewellery', slug: 'diy-jewellery', sortOrder: 13,
        attributes: [
          { name: 'Type', key: 'diy_type', type: 'select', options: ['Beads', 'Findings', 'Wire', 'Tools', 'Charms', 'Chains', 'Stones', 'Thread', 'Kit'], required: false },
        ],
        features: ['Bulk Pack', 'Starter Kit', 'Premium Quality', 'Imported', 'Mixed Lot'],
      },
    ],
  },

  // ===== ANIMALS =====
  {
    name: 'Animals', slug: 'animals', parent: null, level: 1, sortOrder: 9, icon: '🐾', color: '#8B5E3C',
    attributes: [
      { name: 'Age', key: 'age', type: 'text', required: false },
      { name: 'Gender', key: 'gender', type: 'select', options: ['Male', 'Female', 'Pair', 'Unknown'], required: false },
    ],
    children: [
      {
        name: 'Hens', slug: 'hens', sortOrder: 1,
        attributes: [
          { name: 'Breed', key: 'breed', type: 'select', options: ['Desi', 'Golden Misri', 'Australorp', 'Rhode Island Red', 'Fayoumi', 'Silkie', 'Aseel', 'Other'], required: false },
          { name: 'Quantity', key: 'quantity', type: 'number', required: false },
        ],
        features: ['Vaccinated', 'Laying Eggs', 'Healthy', 'Home Bred', 'Farm Bred'],
      },
      {
        name: 'Cats', slug: 'cats', sortOrder: 2,
        attributes: [
          { name: 'Breed', key: 'breed', type: 'select', options: ['Persian', 'Siamese', 'Maine Coon', 'British Shorthair', 'Ragdoll', 'Bengal', 'Semi Punch', 'Triple Coat', 'Doll Face', 'Other'], required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
        ],
        features: ['Vaccinated', 'Trained', 'Litter Trained', 'Dewormed', 'Neutered/Spayed', 'With Accessories', 'Pedigree Certificate'],
      },
      {
        name: 'Parrots', slug: 'parrots', sortOrder: 3,
        attributes: [
          { name: 'Species', key: 'species', type: 'select', options: ['Cockatiel', 'Budgerigar', 'African Grey', 'Macaw', 'Lovebird', 'Conure', 'Ringneck', 'Alexandrine', 'Eclectus', 'Other'], required: false },
        ],
        features: ['Tame', 'Talking', 'Hand Fed', 'With Cage', 'DNA Tested', 'Healthy'],
      },
      {
        name: 'Pet Food & Accessories', slug: 'pet-food-accessories', sortOrder: 4,
        attributes: [
          { name: 'Type', key: 'pet_item_type', type: 'select', options: ['Food', 'Cage', 'Leash', 'Collar', 'Bed', 'Toy', 'Bowl', 'Grooming', 'Medicine', 'Aquarium', 'Other'], required: false },
          { name: 'For Animal', key: 'for_animal', type: 'select', options: ['Cat', 'Dog', 'Bird', 'Fish', 'Rabbit', 'Other'], required: false },
        ],
        features: ['Branded', 'Imported', 'New', 'Sealed'],
      },
      {
        name: 'Dogs', slug: 'dogs', sortOrder: 5,
        attributes: [
          { name: 'Breed', key: 'breed', type: 'select', options: ['German Shepherd', 'Labrador', 'Golden Retriever', 'Husky', 'Rottweiler', 'Poodle', 'Bulldog', 'Doberman', 'Pitbull', 'Pomeranian', 'Other'], required: false },
          { name: 'Color', key: 'color', type: 'text', required: false },
        ],
        features: ['Vaccinated', 'Trained', 'Dewormed', 'Neutered/Spayed', 'Pedigree Certificate', 'Microchipped', 'Guard Dog'],
      },
      {
        name: 'Livestock', slug: 'livestock', sortOrder: 6,
        attributes: [
          { name: 'Type', key: 'livestock_type', type: 'select', options: ['Cow', 'Buffalo', 'Goat', 'Sheep', 'Camel', 'Donkey', 'Other'], required: false },
          { name: 'Weight', key: 'weight', type: 'text', required: false },
        ],
        features: ['Vaccinated', 'Healthy', 'Pregnant', 'Milking', 'Qurbani Ready'],
      },
      { name: 'Pigeons', slug: 'pigeons', sortOrder: 7,
        attributes: [
          { name: 'Breed', key: 'breed', type: 'text', required: false },
        ],
        features: ['Pair', 'Breeder', 'Fancy', 'High Flyer', 'Healthy'],
      },
      { name: 'Rabbits', slug: 'rabbits', sortOrder: 8,
        attributes: [
          { name: 'Breed', key: 'breed', type: 'text', required: false },
        ],
        features: ['Vaccinated', 'Tame', 'Pair', 'With Cage'],
      },
      { name: 'Finches', slug: 'finches', sortOrder: 9 },
      {
        name: 'Fish', slug: 'fish', sortOrder: 10,
        attributes: [
          { name: 'Type', key: 'fish_type', type: 'select', options: ['Goldfish', 'Guppy', 'Betta', 'Arowana', 'Oscar', 'Flowerhorn', 'Koi', 'Angel Fish', 'Other'], required: false },
        ],
        features: ['With Tank', 'Pair', 'Imported', 'Healthy'],
      },
      { name: 'Fertile Eggs', slug: 'fertile-eggs', sortOrder: 11 },
      { name: 'Other Birds', slug: 'other-birds', sortOrder: 12 },
      { name: 'Ducks', slug: 'ducks', sortOrder: 13 },
      { name: 'Other Animals', slug: 'other-animals', sortOrder: 14 },
      { name: 'Doves', slug: 'doves', sortOrder: 15 },
      { name: 'Peacocks', slug: 'peacocks', sortOrder: 16 },
      {
        name: 'Horses', slug: 'horses', sortOrder: 17,
        attributes: [
          { name: 'Breed', key: 'breed', type: 'text', required: false },
          { name: 'Height', key: 'height', type: 'text', required: false },
        ],
        features: ['Trained', 'Vaccinated', 'Racing', 'Riding', 'With Saddle'],
      },
    ],
  },

  // ===== FURNITURE & HOME DECOR =====
  {
    name: 'Furniture & Home Decor', slug: 'furniture-home-decor', parent: null, level: 1, sortOrder: 10, icon: '🛋️', color: '#A0522D',
    attributes: [
      { name: 'Condition', key: 'condition_detail', type: 'select', options: ['New', 'Like New', 'Gently Used', 'Used', 'Needs Repair'], required: false },
      { name: 'Material', key: 'material', type: 'select', options: ['Wood', 'Metal', 'Plastic', 'Glass', 'Fabric', 'Leather', 'Rattan', 'MDF', 'Particle Board', 'Other'], required: false },
    ],
    children: [
      {
        name: 'Beds & Wardrobes', slug: 'beds-wardrobes', sortOrder: 1,
        attributes: [
          { name: 'Type', key: 'furniture_type', type: 'select', options: ['Single Bed', 'Double Bed', 'King Size', 'Bunk Bed', 'Wardrobe', 'Dressing Table', 'Side Table', 'Bedroom Set'], required: false },
        ],
        features: ['With Mattress', 'Storage', 'Branded', 'Imported', 'Solid Wood', 'Assembly Required'],
      },
      {
        name: 'Sofa & Chairs', slug: 'sofa-chairs', sortOrder: 2,
        attributes: [
          { name: 'Type', key: 'seating_type', type: 'select', options: ['Sofa Set', 'L-Shape Sofa', 'Recliner', 'Bean Bag', 'Office Chair', 'Rocking Chair', 'Dining Chair', 'Stool'], required: false },
          { name: 'Seating Capacity', key: 'seating_capacity', type: 'select', options: ['1 Seater', '2 Seater', '3 Seater', '5 Seater', '7 Seater', '9 Seater'], required: false },
        ],
        features: ['With Cushions', 'Washable Covers', 'Reclining', 'Branded', 'Imported', 'Solid Wood Frame'],
      },
      { name: 'Other Household Items', slug: 'other-household', sortOrder: 3 },
      {
        name: 'Tables & Dining', slug: 'tables-dining', sortOrder: 4,
        attributes: [
          { name: 'Type', key: 'table_type', type: 'select', options: ['Dining Table', 'Coffee Table', 'Study Table', 'Console Table', 'Center Table', 'Dining Set'], required: false },
        ],
        features: ['With Chairs', 'Extendable', 'Glass Top', 'Solid Wood', 'Foldable'],
      },
      {
        name: 'Office Furniture', slug: 'office-furniture', sortOrder: 5,
        attributes: [
          { name: 'Type', key: 'office_type', type: 'select', options: ['Office Desk', 'Office Chair', 'Filing Cabinet', 'Bookshelf', 'Conference Table', 'Workstation', 'Reception Desk'], required: false },
        ],
        features: ['Ergonomic', 'Adjustable Height', 'With Drawers', 'Branded', 'Assembly Required'],
      },
      {
        name: 'Home Decoration', slug: 'home-decoration', sortOrder: 6,
        attributes: [
          { name: 'Type', key: 'decor_type', type: 'select', options: ['Wall Art', 'Vase', 'Candle', 'Photo Frame', 'Clock', 'Showpiece', 'Artificial Plants', 'Wall Shelf', 'Other'], required: false },
        ],
        features: ['Handmade', 'Imported', 'Branded', 'Set'],
      },
      {
        name: 'Garden & Outdoor', slug: 'garden-outdoor', sortOrder: 7,
        attributes: [
          { name: 'Type', key: 'garden_type', type: 'select', options: ['Garden Chair', 'Swing', 'Planter', 'Lawn Mower', 'BBQ Grill', 'Umbrella', 'Fountain', 'Garden Tools', 'Other'], required: false },
        ],
        features: ['Weather Resistant', 'Foldable', 'With Cushions', 'Rust Proof'],
      },
      { name: 'Home DIY & Renovations', slug: 'home-diy-renovations', sortOrder: 8 },
      { name: 'Kitchen Essentials', slug: 'kitchen-essentials', sortOrder: 9,
        features: ['Non-Stick', 'Stainless Steel', 'Branded', 'Set', 'Dishwasher Safe'],
      },
      { name: 'Bathroom Accessories', slug: 'bathroom-accessories', sortOrder: 10 },
      { name: 'Painting & Mirrors', slug: 'painting-mirrors', sortOrder: 11,
        features: ['Framed', 'Handmade', 'Canvas', 'Wall Mounted', 'Full Length'],
      },
      { name: 'Lighting', slug: 'lighting', sortOrder: 12,
        features: ['LED', 'Chandelier', 'Dimmable', 'Smart', 'Solar', 'Energy Saving'],
      },
      { name: 'Curtains & Blinds', slug: 'curtains-blinds', sortOrder: 13,
        features: ['Blackout', 'Sheer', 'Thermal', 'With Rod', 'Custom Size'],
      },
      { name: 'Rugs & Carpets', slug: 'rugs-carpets', sortOrder: 14,
        features: ['Handwoven', 'Machine Made', 'Washable', 'Anti-Slip', 'Imported'],
      },
      { name: 'Home Essentials', slug: 'home-essentials', sortOrder: 15 },
    ],
  },

  // ===== BOOKS, SPORTS & HOBBIES =====
  {
    name: 'Books, Sports & Hobbies', slug: 'books-sports-hobbies', parent: null, level: 1, sortOrder: 11, icon: '📚', color: '#6A5ACD',
    attributes: [
      { name: 'Condition', key: 'condition_detail', type: 'select', options: ['New', 'Like New', 'Good', 'Acceptable'], required: false },
    ],
    children: [
      {
        name: 'Books & Magazines', slug: 'books-magazines', sortOrder: 1,
        attributes: [
          { name: 'Genre', key: 'genre', type: 'select', options: ['Fiction', 'Non-Fiction', 'Academic', 'Religious', 'Self-Help', 'Children', 'Comics', 'Magazines', 'Novels', 'Other'], required: false },
          { name: 'Language', key: 'language', type: 'select', options: ['English', 'Urdu', 'Arabic', 'Other'], required: false },
        ],
        features: ['Hardcover', 'Paperback', 'First Edition', 'Signed', 'Set/Collection', 'Imported'],
      },
      {
        name: 'Gym & Fitness', slug: 'gym-fitness', sortOrder: 2,
        attributes: [
          { name: 'Type', key: 'fitness_type', type: 'select', options: ['Treadmill', 'Dumbbells', 'Bench Press', 'Exercise Bike', 'Elliptical', 'Resistance Bands', 'Yoga Mat', 'Weight Plates', 'Multi Gym', 'Other'], required: false },
        ],
        features: ['Commercial Grade', 'Foldable', 'With Display', 'Adjustable', 'Branded', 'Home Use'],
      },
      {
        name: 'Sports Equipment', slug: 'sports-equipment', sortOrder: 3,
        attributes: [
          { name: 'Sport', key: 'sport', type: 'select', options: ['Cricket', 'Football', 'Badminton', 'Tennis', 'Table Tennis', 'Basketball', 'Swimming', 'Boxing', 'Hockey', 'Other'], required: false },
        ],
        features: ['Branded', 'Professional', 'Beginner', 'With Bag/Case', 'Imported'],
      },
      { name: 'Arts & Crafts', slug: 'arts-crafts', sortOrder: 4,
        features: ['Handmade', 'Kit', 'Professional Grade', 'Beginner Friendly'],
      },
      { name: 'Other Hobbies', slug: 'other-hobbies', sortOrder: 5 },
      {
        name: 'Musical Instruments', slug: 'musical-instruments', sortOrder: 6,
        attributes: [
          { name: 'Type', key: 'instrument_type', type: 'select', options: ['Guitar', 'Piano/Keyboard', 'Drums', 'Violin', 'Flute', 'Harmonium', 'Tabla', 'Ukulele', 'Dholak', 'Other'], required: false },
        ],
        features: ['Branded', 'With Case', 'Acoustic', 'Electric', 'Beginner', 'Professional'],
      },
      { name: 'Camping & Hiking', slug: 'camping-hiking', sortOrder: 7,
        features: ['Waterproof', 'Lightweight', 'Branded', 'Complete Kit'],
      },
      { name: 'Collectables', slug: 'collectables', sortOrder: 8,
        features: ['Rare', 'Antique', 'Limited Edition', 'Mint Condition', 'With Certificate'],
      },
      { name: 'Crafts & DIY Supplies', slug: 'crafts-diy-supplies', sortOrder: 9 },
      { name: 'Calendars', slug: 'calendars', sortOrder: 10 },
    ],
  },

  // ===== KIDS =====
  {
    name: 'Kids', slug: 'kids', parent: null, level: 1, sortOrder: 12, icon: '🧸', color: '#FF69B4',
    attributes: [
      { name: 'Condition', key: 'condition_detail', type: 'select', options: ['New', 'Like New', 'Gently Used', 'Used'], required: false },
      { name: 'Age Group', key: 'age_group', type: 'select', options: ['0-6 Months', '6-12 Months', '1-2 Years', '2-4 Years', '4-8 Years', '8-12 Years', '12+ Years'], required: false },
    ],
    children: [
      {
        name: 'Toys', slug: 'toys', sortOrder: 1,
        attributes: [
          { name: 'Type', key: 'toy_type', type: 'select', options: ['Action Figures', 'Dolls', 'Building Blocks', 'Board Games', 'Puzzles', 'Remote Control', 'Stuffed Animals', 'Educational', 'Outdoor', 'Other'], required: false },
        ],
        features: ['Branded', 'Imported', 'Battery Operated', 'Educational', 'Safe/Non-Toxic', 'With Box'],
      },
      {
        name: 'Kids Vehicles', slug: 'kids-vehicles', sortOrder: 2,
        attributes: [
          { name: 'Type', key: 'vehicle_type', type: 'select', options: ['Bicycle', 'Tricycle', 'Electric Car', 'Scooter', 'Walker', 'Ride-On', 'Other'], required: false },
        ],
        features: ['With Training Wheels', 'Rechargeable', 'With Remote', 'Adjustable Seat', 'With Music/Lights'],
      },
      {
        name: 'Baby Gear', slug: 'baby-gear', sortOrder: 3,
        attributes: [
          { name: 'Type', key: 'gear_type', type: 'select', options: ['Stroller', 'Car Seat', 'High Chair', 'Baby Carrier', 'Crib', 'Bouncer', 'Play Mat', 'Baby Monitor', 'Other'], required: false },
        ],
        features: ['Branded', 'Foldable', 'Adjustable', 'With Canopy', 'Washable', 'Safety Certified'],
      },
      { name: 'Kids Accessories', slug: 'kids-accessories', sortOrder: 4,
        features: ['Branded', 'Imported', 'Safe/Non-Toxic'],
      },
      { name: 'Swings & Slides', slug: 'swings-slides', sortOrder: 5,
        features: ['Indoor', 'Outdoor', 'Foldable', 'With Safety Belt', 'Multi-Activity'],
      },
      { name: 'Kids Furniture', slug: 'kids-furniture', sortOrder: 6,
        features: ['With Storage', 'Adjustable', 'Themed', 'Safety Edges'],
      },
      {
        name: 'Kids Clothing', slug: 'kids-clothing', sortOrder: 7,
        attributes: [
          { name: 'Size', key: 'size', type: 'text', required: false },
          { name: 'Gender', key: 'gender', type: 'select', options: ['Boy', 'Girl', 'Unisex'], required: false },
        ],
        features: ['Branded', 'Imported', 'Cotton', 'Set', 'Party Wear', 'Casual'],
      },
      { name: 'Bath & Diapers', slug: 'bath-diapers', sortOrder: 8,
        features: ['Organic', 'Hypoallergenic', 'Branded', 'Bulk Pack', 'Sealed'],
      },
    ],
  },

  // ===== SERVICES =====
  {
    name: 'Services', slug: 'services', parent: null, level: 1, sortOrder: 13, icon: '🔧', color: '#4682B4',
    attributes: [
      { name: 'Service Type', key: 'service_type', type: 'select', options: ['One-Time', 'Recurring', 'Contract', 'Hourly', 'Project Based'], required: false },
      { name: 'Availability', key: 'availability', type: 'select', options: ['Available Now', 'By Appointment', 'Weekdays Only', 'Weekends Only', '24/7'], required: false },
    ],
    children: [
      { name: 'Other Services', slug: 'other-services', sortOrder: 1 },
      { name: 'Car Rental', slug: 'car-rental', sortOrder: 2,
        features: ['With Driver', 'Self Drive', 'AC', 'Insurance Included', 'Airport Pickup'],
      },
      { name: 'Home & Office Repair', slug: 'home-office-repair', sortOrder: 3,
        features: ['Electrician', 'Plumber', 'Carpenter', 'Painter', 'AC Repair', 'Appliance Repair'],
      },
      { name: 'Tuitions & Academies', slug: 'tuitions-academies', sortOrder: 4,
        features: ['Home Tuition', 'Online', 'Group Class', 'One-on-One', 'Certified Teacher'],
      },
      { name: 'Domestic Help', slug: 'domestic-help', sortOrder: 5,
        features: ['Full Time', 'Part Time', 'Live-In', 'Experienced', 'References Available'],
      },
      { name: 'Web Development', slug: 'web-development', sortOrder: 6,
        features: ['WordPress', 'Custom Development', 'E-Commerce', 'Mobile App', 'SEO', 'Maintenance'],
      },
      { name: 'Electronics & Computer Repair', slug: 'electronics-computer-repair', sortOrder: 7,
        features: ['Mobile Repair', 'Laptop Repair', 'Data Recovery', 'Software', 'Hardware', 'Home Service'],
      },
      { name: 'Drivers & Taxi', slug: 'drivers-taxi', sortOrder: 8 },
      { name: 'Event Services', slug: 'event-services', sortOrder: 9,
        features: ['Wedding', 'Birthday', 'Corporate', 'Sound System', 'Catering', 'Decoration'],
      },
      { name: 'Construction Services', slug: 'construction-services', sortOrder: 10 },
      { name: 'Travel & Visa', slug: 'travel-visa', sortOrder: 11,
        features: ['Visa Assistance', 'Tour Package', 'Hotel Booking', 'Flight Booking', 'Umrah/Hajj'],
      },
      { name: 'Health & Beauty', slug: 'health-beauty-services', sortOrder: 12 },
      { name: 'Consultancy Services', slug: 'consultancy-services', sortOrder: 13 },
      { name: 'Farm & Fresh Food', slug: 'farm-fresh-food', sortOrder: 14 },
      { name: 'Architecture & Interior Design', slug: 'architecture-interior-design', sortOrder: 15 },
      { name: 'Movers & Packers', slug: 'movers-packers', sortOrder: 16,
        features: ['Local', 'Intercity', 'International', 'Packing Included', 'Insurance'],
      },
      { name: 'Video & Photography', slug: 'video-photography', sortOrder: 17,
        features: ['Wedding', 'Event', 'Product', 'Drone', 'Editing', 'Studio'],
      },
      { name: 'Renting Services', slug: 'renting-services', sortOrder: 18 },
      { name: 'Camera Installation', slug: 'camera-installation', sortOrder: 19 },
      { name: 'Car Services', slug: 'car-services', sortOrder: 20 },
      { name: 'Tailor Services', slug: 'tailor-services', sortOrder: 21 },
      { name: 'Catering & Restaurant', slug: 'catering-restaurant', sortOrder: 22 },
      { name: 'Insurance Services', slug: 'insurance-services', sortOrder: 23 },
    ],
  },

  // ===== JOBS =====
  {
    name: 'Jobs', slug: 'jobs', parent: null, level: 1, sortOrder: 14, icon: '💼', color: '#2E8B57',
    attributes: [
      { name: 'Job Type', key: 'job_type', type: 'select', options: ['Full Time', 'Part Time', 'Contract', 'Freelance', 'Internship', 'Remote'], required: false },
      { name: 'Salary Range', key: 'salary_range', type: 'select', options: ['10K-25K', '25K-50K', '50K-100K', '100K-200K', '200K-500K', '500K+', 'Negotiable'], required: false },
      { name: 'Experience', key: 'experience', type: 'select', options: ['Fresh', '1-2 Years', '2-5 Years', '5-10 Years', '10+ Years'], required: false },
      { name: 'Education', key: 'education', type: 'select', options: ['Matric', 'Intermediate', 'Bachelors', 'Masters', 'PhD', 'Any'], required: false },
    ],
    children: [
      { name: 'Other Jobs', slug: 'other-jobs', sortOrder: 1 },
      { name: 'Online', slug: 'online-jobs', sortOrder: 2,
        features: ['Work from Home', 'Flexible Hours', 'No Experience Required', 'Training Provided'],
      },
      { name: 'Restaurants & Hospitality', slug: 'restaurants-hospitality-jobs', sortOrder: 3 },
      { name: 'Sales', slug: 'sales-jobs', sortOrder: 4,
        features: ['Commission Based', 'Target Based', 'Field Work', 'Office Based'],
      },
      { name: 'Part Time', slug: 'part-time-jobs', sortOrder: 5,
        features: ['Flexible Hours', 'Student Friendly', 'Weekend Only', 'Evening Shift'],
      },
      { name: 'Customer Service', slug: 'customer-service-jobs', sortOrder: 6 },
      { name: 'Domestic Staff', slug: 'domestic-staff-jobs', sortOrder: 7 },
      { name: 'Marketing', slug: 'marketing-jobs', sortOrder: 8 },
      { name: 'Medical', slug: 'medical-jobs', sortOrder: 9 },
      { name: 'Delivery Riders', slug: 'delivery-riders-jobs', sortOrder: 10 },
      { name: 'Education', slug: 'education-jobs', sortOrder: 11 },
      { name: 'Accounting & Finance', slug: 'accounting-finance-jobs', sortOrder: 12 },
      { name: 'IT & Networking', slug: 'it-networking-jobs', sortOrder: 13 },
      { name: 'Graphic Design', slug: 'graphic-design-jobs', sortOrder: 14 },
      { name: 'Hotels & Tourism', slug: 'hotels-tourism-jobs', sortOrder: 15 },
      { name: 'Engineering', slug: 'engineering-jobs', sortOrder: 16 },
      { name: 'Clerical & Administration', slug: 'clerical-admin-jobs', sortOrder: 17 },
      { name: 'Manufacturing', slug: 'manufacturing-jobs', sortOrder: 18 },
      { name: 'Content Writing', slug: 'content-writing-jobs', sortOrder: 19 },
      { name: 'Security', slug: 'security-jobs', sortOrder: 20 },
      { name: 'Real Estate', slug: 'real-estate-jobs', sortOrder: 21 },
      { name: 'Human Resources', slug: 'human-resources-jobs', sortOrder: 22 },
      { name: 'Advertising & PR', slug: 'advertising-pr-jobs', sortOrder: 23 },
      { name: 'Internships', slug: 'internships', sortOrder: 24,
        features: ['Paid', 'Unpaid', 'Certificate Provided', 'Remote', 'On-Site'],
      },
      { name: 'Architecture & Interior Design', slug: 'architecture-interior-design-jobs', sortOrder: 25 },
    ],
  },
];

async function seed() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('categories');

    // Drop existing categories
    await col.deleteMany({});
    console.log('Cleared existing categories');

    let count = 0;

    async function insertCategory(cat, parentId, level) {
      const doc = {
        name: cat.name,
        slug: cat.slug,
        parentId: parentId,
        level: level,
        isActive: true,
        sortOrder: cat.sortOrder || 1,
        attributes: (cat.attributes || []).map(a => ({
          ...a,
          options: a.options || [],
          required: a.required || false,
        })),
        features: cat.features || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await col.insertOne(doc);
      count++;
      const id = result.insertedId;

      if (cat.children) {
        for (const child of cat.children) {
          await insertCategory(child, id, level + 1);
        }
      }

      return id;
    }

    for (const cat of categoriesData) {
      await insertCategory(cat, null, 1);
    }

    console.log(`Inserted ${count} categories`);

    // Also remove the old 'filters' field from any existing docs
    await col.updateMany({}, { $unset: { filters: '' } });
    console.log('Removed legacy filters field');

    // Clear Redis cache
    try {
      const Redis = require('ioredis');
      const redis = new Redis();
      await redis.del('categories:tree');
      console.log('Cleared Redis cache');
      await redis.quit();
    } catch (e) {
      console.log('Redis cache clear skipped:', e.message);
    }

  } finally {
    await client.close();
  }
}

seed().catch(console.error);
