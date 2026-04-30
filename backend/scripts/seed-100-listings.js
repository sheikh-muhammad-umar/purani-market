/* eslint-disable */
/**
 * Seed 100 listings for existing users with 'user' role.
 * - 90 listings: status 'active' (approved)
 * - 10 listings: other statuses (pending_review, sold, etc.)
 * - Reuses images from already-uploaded listings in uploads/
 * - Includes same-category listings with varied data for search/voice testing
 *
 * Usage:  cd backend && node scripts/seed-100-listings.js
 */
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';
const BASE_URL = 'http://localhost:3000/uploads';

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rand(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
function daysAgo(n) { return new Date(Date.now() - n * 864e5); }

// ── Collect already-uploaded images from disk ───────────
function collectExistingImages() {
  const uploadsDir = path.resolve(__dirname, '..', 'uploads', 'listings');
  const pool = [];
  if (!fs.existsSync(uploadsDir)) return pool;
  for (const dir of fs.readdirSync(uploadsDir)) {
    const imgsDir = path.join(uploadsDir, dir, 'images');
    const thumbDir = path.join(uploadsDir, dir, 'thumbs');
    if (!fs.existsSync(imgsDir)) continue;
    const imgs = fs.readdirSync(imgsDir).filter(f => /\.(jpg|png|webp)$/i.test(f));
    const thumbs = fs.existsSync(thumbDir) ? fs.readdirSync(thumbDir).filter(f => /\.(jpg|png|webp)$/i.test(f)) : [];
    for (let i = 0; i < imgs.length; i++) {
      pool.push({
        url: `${BASE_URL}/listings/${dir}/images/${imgs[i]}`,
        thumbnailUrl: `${BASE_URL}/listings/${dir}/thumbs/${thumbs[i] || imgs[i]}`,
      });
    }
  }
  return pool;
}

function pickImages(pool, n) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length)).map((img, i) => ({
    url: img.url, thumbnailUrl: img.thumbnailUrl, sortOrder: i,
  }));
}

// ── Location data ───────────────────────────────────────
const LOCATIONS = [
  { city: 'Lahore', province: 'Punjab', areas: ['DHA Phase 5', 'DHA Phase 6', 'Gulberg III', 'Johar Town', 'Model Town', 'Bahria Town', 'Garden Town', 'Cantt', 'Iqbal Town', 'Wapda Town'] },
  { city: 'Karachi', province: 'Sindh', areas: ['DHA Defence', 'Clifton', 'Gulshan-e-Iqbal', 'North Nazimabad', 'PECHS', 'Bahria Town', 'Malir', 'Korangi', 'Saddar', 'FB Area'] },
  { city: 'Islamabad', province: 'Islamabad Capital', areas: ['F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-9', 'G-10', 'G-11', 'Blue Area', 'Bahria Town'] },
  { city: 'Rawalpindi', province: 'Punjab', areas: ['Bahria Town', 'DHA', 'Satellite Town', 'Saddar', 'Chaklala', 'Westridge', 'Adiala Road', 'Committee Chowk'] },
  { city: 'Faisalabad', province: 'Punjab', areas: ['Peoples Colony', 'Madina Town', 'Gulberg', 'Jinnah Colony', 'Samanabad', 'D Ground'] },
  { city: 'Multan', province: 'Punjab', areas: ['Bosan Road', 'Cantt', 'Shah Rukn-e-Alam', 'Gulgasht Colony', 'Shalimar Colony'] },
  { city: 'Peshawar', province: 'Khyber Pakhtunkhwa', areas: ['Hayatabad', 'University Town', 'Saddar', 'Cantt', 'Board Bazaar'] },
];

function makeLocation(locData) {
  const loc = locData || pick(LOCATIONS);
  return { province: loc.province, city: loc.city, area: pick(loc.areas) };
}

// ── Cars listing templates (25 listings) ────────────────
const CAR_LISTINGS = [
  { title: 'Toyota Corolla Altis 2021 - Automatic', make: 'Toyota', model: 'Corolla Altis', year: 2021, mileage: 35000, fuel: 'Petrol', trans: 'Automatic', color: 'White', body: 'Sedan', cc: 1800, price: 5200000, desc: 'Toyota Corolla Altis Grande 1.8 CVT-i 2021 in Pearl White. Company maintained with full service record. First owner, no accident history. Multimedia with reverse camera. Alloy rims, fog lamps, climate control all working perfectly. Islamabad registered.' },
  { title: 'Honda Civic RS Turbo 2022 - Fully Loaded', make: 'Honda', model: 'Civic RS', year: 2022, mileage: 18000, fuel: 'Petrol', trans: 'Automatic', color: 'Black', body: 'Sedan', cc: 1500, price: 8500000, desc: 'Honda Civic RS Turbo 2022 in Crystal Black. Top of the line with sunroof, leather seats, Honda Sensing suite. Only 18,000 km driven. Bank lease can be transferred. All original documents available.' },
  { title: 'Suzuki Alto VXR 2023 - Like New', make: 'Suzuki', model: 'Alto VXR', year: 2023, mileage: 8000, fuel: 'Petrol', trans: 'Manual', color: 'Silver', body: 'Hatchback', cc: 660, price: 2350000, desc: 'Suzuki Alto VXR 2023 model in excellent condition. Barely driven, only 8000 km. Power steering, power windows, AC. First owner. Lahore registered. Genuine condition, no touch-up.' },
  { title: 'Toyota Yaris ATIV CVT 1.5 - 2022', make: 'Toyota', model: 'Yaris ATIV', year: 2022, mileage: 25000, fuel: 'Petrol', trans: 'Automatic', color: 'Red', body: 'Sedan', cc: 1500, price: 4600000, desc: 'Toyota Yaris ATIV X CVT 1.5 in Attitude Red. Excellent condition with all features working. Push start, alloy rims, multimedia. Company maintained. Karachi registered.' },
  { title: 'Hyundai Tucson 2023 - AWD', make: 'Hyundai', model: 'Tucson', year: 2023, mileage: 12000, fuel: 'Petrol', trans: 'Automatic', color: 'Grey', body: 'SUV', cc: 2000, price: 9800000, desc: 'Hyundai Tucson AWD 2023 in Shimmering Silver. Panoramic sunroof, ventilated seats, 360 camera, blind spot detection. Under warranty. Islamabad registered.' },
  { title: 'KIA Sportage Alpha 2024 - Brand New', make: 'KIA', model: 'Sportage Alpha', year: 2024, mileage: 3000, fuel: 'Petrol', trans: 'Automatic', color: 'White', body: 'SUV', cc: 2000, price: 7200000, desc: 'KIA Sportage Alpha FWD 2024 in Snow White Pearl. Almost brand new with only 3000 km. Full warranty remaining. Panoramic sunroof, smart key, wireless charging.' },
  { title: 'Suzuki Cultus VXL 2022 - Excellent', make: 'Suzuki', model: 'Cultus VXL', year: 2022, mileage: 22000, fuel: 'Petrol', trans: 'Manual', color: 'Blue', body: 'Hatchback', cc: 1000, price: 2800000, desc: 'Suzuki Cultus VXL 2022 in Cerulean Blue. Well maintained, genuine condition. Power steering, power windows, AC, multimedia. Lahore registered. Token paid.' },
  { title: 'Toyota Fortuner Sigma 4 - 2021', make: 'Toyota', model: 'Fortuner', year: 2021, mileage: 45000, fuel: 'Diesel', trans: 'Automatic', color: 'Black', body: 'SUV', cc: 2800, price: 14500000, desc: 'Toyota Fortuner 2.8 Sigma 4 in Attitude Black. Diesel automatic with 4x4. Leather seats, 7 seater, cruise control. Company maintained. Islamabad registered.' },
  { title: 'Honda City 1.5 ASPIRE CVT 2023', make: 'Honda', model: 'City Aspire', year: 2023, mileage: 15000, fuel: 'Petrol', trans: 'Automatic', color: 'White', body: 'Sedan', cc: 1500, price: 4800000, desc: 'Honda City 1.5L Aspire CVT 2023 in Platinum White. Sunroof, LED headlamps, Honda Sensing. First owner, company maintained. Lahore registered.' },
  { title: 'Suzuki Swift GLX CVT 2023', make: 'Suzuki', model: 'Swift GLX', year: 2023, mileage: 10000, fuel: 'Petrol', trans: 'Automatic', color: 'Pearl Red', body: 'Hatchback', cc: 1200, price: 3600000, desc: 'Suzuki Swift GLX CVT 2023 in Pearl Radiant Red. Top variant with push start, alloy rims, climate control. Excellent fuel economy. Karachi registered.' },
  { title: 'Toyota Corolla Cross 1.8 HEV 2024', make: 'Toyota', model: 'Corolla Cross', year: 2024, mileage: 5000, fuel: 'Hybrid', trans: 'Automatic', color: 'Celestite Grey', body: 'Crossover', cc: 1800, price: 8900000, desc: 'Toyota Corolla Cross Hybrid 2024 in Celestite Grey. Under warranty, almost new. Hybrid electric with amazing fuel economy. All safety features included.' },
  { title: 'Changan Alsvin Lumiere 2023', make: 'Changan', model: 'Alsvin Lumiere', year: 2023, mileage: 20000, fuel: 'Petrol', trans: 'Automatic', color: 'White', body: 'Sedan', cc: 1500, price: 3900000, desc: 'Changan Alsvin 1.5L DCT Lumiere 2023. Top variant with sunroof, cruise control, 360 camera. Excellent value for money. Lahore registered.' },
  { title: 'MG HS Trophy 2022 - Panoramic Sunroof', make: 'MG', model: 'HS Trophy', year: 2022, mileage: 30000, fuel: 'Petrol', trans: 'Automatic', color: 'Red', body: 'SUV', cc: 1500, price: 6800000, desc: 'MG HS Trophy 2022 in Dynamic Red. Panoramic sunroof, leather seats, 360 camera, ADAS features. Well maintained. Islamabad registered.' },
  { title: 'Suzuki Wagon R VXL 2022', make: 'Suzuki', model: 'Wagon R VXL', year: 2022, mileage: 18000, fuel: 'Petrol', trans: 'Manual', color: 'Grey', body: 'Hatchback', cc: 1000, price: 2600000, desc: 'Suzuki Wagon R VXL 2022 in Silky Silver. Top variant with multimedia, alloy rims, rear camera. Excellent city car. Lahore registered.' },
  { title: 'Toyota Hilux Revo V 2.8 Auto 2021', make: 'Toyota', model: 'Hilux Revo V', year: 2021, mileage: 55000, fuel: 'Diesel', trans: 'Automatic', color: 'White', body: 'Pickup', cc: 2800, price: 11500000, desc: 'Toyota Hilux Revo V Automatic 2.8 Diesel 2021. 4x4, leather seats, bedliner installed. Company maintained. Islamabad registered.' },
  { title: 'Honda BR-V S Package 2023', make: 'Honda', model: 'BR-V', year: 2023, mileage: 12000, fuel: 'Petrol', trans: 'Automatic', color: 'Meteoroid Grey', body: 'MPV', cc: 1500, price: 5100000, desc: 'Honda BR-V S Package 2023 in Meteoroid Grey. 7 seater, push start, alloy rims. First owner, company maintained. Lahore registered.' },
  { title: 'Proton X70 Executive AWD 2023', make: 'Proton', model: 'X70', year: 2023, mileage: 15000, fuel: 'Petrol', trans: 'Automatic', color: 'Snow White', body: 'SUV', cc: 1500, price: 6500000, desc: 'Proton X70 Executive AWD 2023. Turbocharged, panoramic sunroof, powered tailgate, Nappa leather. Under warranty.' },
  { title: 'Daihatsu Mira 2018 - Imported', make: 'Daihatsu', model: 'Mira', year: 2018, mileage: 42000, fuel: 'Petrol', trans: 'Automatic', color: 'Pink', body: 'Hatchback', cc: 660, price: 1950000, desc: 'Daihatsu Mira 2018 imported. Eco Idle technology, excellent fuel average. Push start, power windows. Lahore registered.' },
  { title: 'Toyota Prado TX 2019 - 7 Seater', make: 'Toyota', model: 'Prado TX', year: 2019, mileage: 60000, fuel: 'Petrol', trans: 'Automatic', color: 'Pearl White', body: 'SUV', cc: 2700, price: 18500000, desc: 'Toyota Land Cruiser Prado TX 2019. 7 seater, sunroof, leather seats, cool box. Imported, Islamabad registered.' },
  { title: 'Suzuki Mehran VXR 2018 - Last Model', make: 'Suzuki', model: 'Mehran VXR', year: 2018, mileage: 65000, fuel: 'Petrol', trans: 'Manual', color: 'White', body: 'Hatchback', cc: 800, price: 1150000, desc: 'Suzuki Mehran VXR 2018 last model year. AC, CNG fitted, new tyres. Lahore registered. Genuine condition.' },
  // Search/voice search variants for Cars
  { title: 'Toyota Corolla GLi 2020 - Manual', make: 'Toyota', model: 'Corolla GLi', year: 2020, mileage: 48000, fuel: 'Petrol', trans: 'Manual', color: 'Silver', body: 'Sedan', cc: 1300, price: 4100000, desc: 'Toyota Corolla GLi Manual 2020 in Super White. Well maintained, first owner. AC, power steering, power windows. Rawalpindi registered. Token paid till December.' },
  { title: 'Toyota Corolla XLi 2019 - Converted to GLi', make: 'Toyota', model: 'Corolla XLi', year: 2019, mileage: 62000, fuel: 'Petrol', trans: 'Manual', color: 'Grey', body: 'Sedan', cc: 1300, price: 3700000, desc: 'Toyota Corolla XLi 2019 converted to GLi. Multimedia, alloy rims, fog lamps added. Faisalabad registered. Good condition.' },
  { title: 'Honda Civic Oriel 2020 - Top Variant', make: 'Honda', model: 'Civic Oriel', year: 2020, mileage: 40000, fuel: 'Petrol', trans: 'Automatic', color: 'Lunar Silver', body: 'Sedan', cc: 1800, price: 6800000, desc: 'Honda Civic 1.8 Oriel 2020 in Lunar Silver Metallic. Sunroof, lane watch camera, push start. Company maintained. Lahore registered.' },
  { title: 'Honda City 1.2L MT 2022 - Base Model', make: 'Honda', model: 'City', year: 2022, mileage: 28000, fuel: 'Petrol', trans: 'Manual', color: 'Platinum White', body: 'Sedan', cc: 1200, price: 3500000, desc: 'Honda City 1.2L Manual 2022. Base model in excellent condition. AC, power steering. First owner. Multan registered.' },
  { title: 'Suzuki Alto VXL AGS 2024 - Auto Gear', make: 'Suzuki', model: 'Alto VXL AGS', year: 2024, mileage: 2000, fuel: 'Petrol', trans: 'Automatic', color: 'Cerulean Blue', body: 'Hatchback', cc: 660, price: 2750000, desc: 'Suzuki Alto VXL AGS 2024 in Cerulean Blue. Almost brand new, auto gear shift. Multimedia, rear camera. Karachi registered.' },
];

// ── Mobile Phones listing templates (25 listings) ───────
const PHONE_LISTINGS = [
  { title: 'iPhone 15 Pro Max 256GB - Natural Titanium', brand: 'Apple', model: 'iPhone 15 Pro Max', storage: '256GB', ram: '8GB', pta: 'PTA Approved', battery: '94%', color: 'Natural Titanium', cond: 'used', price: 430000, desc: 'iPhone 15 Pro Max 256GB in Natural Titanium. PTA approved. Battery health 94%. No scratches, always used with case and screen protector. Complete box with original cable. AppleCare+ active.' },
  { title: 'Samsung Galaxy S24 Ultra 512GB - Titanium Black', brand: 'Samsung', model: 'Galaxy S24 Ultra', storage: '512GB', ram: '12GB', pta: 'PTA Approved', battery: '97%', color: 'Titanium Black', cond: 'used', price: 340000, desc: 'Samsung Galaxy S24 Ultra with S-Pen. 512GB storage. PTA approved. Screen has no scratches. Fast charging and wireless charging work perfectly. Complete box.' },
  { title: 'iPhone 14 Pro 128GB - Deep Purple', brand: 'Apple', model: 'iPhone 14 Pro', storage: '128GB', ram: '6GB', pta: 'PTA Approved', battery: '89%', color: 'Deep Purple', cond: 'used', price: 280000, desc: 'iPhone 14 Pro 128GB Deep Purple. PTA approved. Battery health 89%. Dynamic Island, always-on display. Complete box with charger.' },
  { title: 'Samsung Galaxy A54 128GB - Brand New', brand: 'Samsung', model: 'Galaxy A54', storage: '128GB', ram: '8GB', pta: 'PTA Approved', battery: '100%', color: 'Awesome Lime', cond: 'new', price: 72000, desc: 'Brand new Samsung Galaxy A54 5G 128GB. Sealed box. PTA approved. Super AMOLED display, 50MP camera. Official warranty.' },
  { title: 'Xiaomi 14 Ultra 512GB - Photography King', brand: 'Xiaomi', model: '14 Ultra', storage: '512GB', ram: '16GB', pta: 'PTA Approved', battery: '100%', color: 'Black', cond: 'new', price: 250000, desc: 'Xiaomi 14 Ultra 512GB brand new sealed. Leica cameras, Snapdragon 8 Gen 3. PTA approved. Best camera phone available.' },
  { title: 'OnePlus 12 256GB - Flowy Emerald', brand: 'OnePlus', model: '12', storage: '256GB', ram: '12GB', pta: 'PTA Approved', battery: '98%', color: 'Flowy Emerald', cond: 'used', price: 165000, desc: 'OnePlus 12 256GB in Flowy Emerald. Snapdragon 8 Gen 3, Hasselblad cameras. 100W fast charging. PTA approved. Mint condition.' },
  { title: 'Oppo Reno 11 Pro 256GB - Pearl White', brand: 'Oppo', model: 'Reno 11 Pro', storage: '256GB', ram: '12GB', pta: 'PTA Approved', battery: '100%', color: 'Pearl White', cond: 'new', price: 110000, desc: 'Oppo Reno 11 Pro 5G 256GB brand new. Dimensity 8200, 50MP camera. 80W fast charging. Official warranty card included.' },
  { title: 'Vivo V30 Pro 256GB - Peacock Green', brand: 'Vivo', model: 'V30 Pro', storage: '256GB', ram: '12GB', pta: 'PTA Approved', battery: '96%', color: 'Peacock Green', cond: 'used', price: 95000, desc: 'Vivo V30 Pro 256GB. Zeiss cameras, AMOLED display. 80W flash charge. PTA approved. With box and charger.' },
  { title: 'Realme GT 5 Pro 256GB - Bright Moon', brand: 'Realme', model: 'GT 5 Pro', storage: '256GB', ram: '12GB', pta: 'Non-PTA', battery: '100%', color: 'Bright Moon', cond: 'new', price: 130000, desc: 'Realme GT 5 Pro 256GB sealed box. Snapdragon 8 Gen 3, 50MP Sony camera. Non-PTA. Amazing performance phone.' },
  { title: 'Google Pixel 8 Pro 256GB - Bay Blue', brand: 'Google', model: 'Pixel 8 Pro', storage: '256GB', ram: '12GB', pta: 'PTA Approved', battery: '92%', color: 'Bay Blue', cond: 'used', price: 175000, desc: 'Google Pixel 8 Pro 256GB. Best camera phone, 7 years of updates. Tensor G3 chip. PTA approved. With original box.' },
  { title: 'Infinix Note 40 Pro 256GB - Vintage Green', brand: 'Infinix', model: 'Note 40 Pro', storage: '256GB', ram: '8GB', pta: 'PTA Approved', battery: '100%', color: 'Vintage Green', cond: 'new', price: 55000, desc: 'Infinix Note 40 Pro 256GB brand new. 108MP camera, wireless charging. AMOLED display. Official warranty.' },
  { title: 'Tecno Camon 30 Premier 512GB', brand: 'Tecno', model: 'Camon 30 Premier', storage: '512GB', ram: '12GB', pta: 'PTA Approved', battery: '100%', color: 'Lava Grey', cond: 'new', price: 85000, desc: 'Tecno Camon 30 Premier 512GB. Sony IMX890 camera, AMOLED display. 70W charging. Brand new sealed box.' },
  { title: 'iPhone 13 128GB - Midnight', brand: 'Apple', model: 'iPhone 13', storage: '128GB', ram: '4GB', pta: 'PTA Approved', battery: '85%', color: 'Midnight', cond: 'used', price: 155000, desc: 'iPhone 13 128GB Midnight. PTA approved. Battery health 85%. Good condition with minor scratches on back. With charger.' },
  { title: 'Samsung Galaxy Z Fold 5 256GB', brand: 'Samsung', model: 'Galaxy Z Fold 5', storage: '256GB', ram: '12GB', pta: 'PTA Approved', battery: '91%', color: 'Phantom Black', cond: 'used', price: 310000, desc: 'Samsung Galaxy Z Fold 5 256GB. Foldable display, S-Pen support. PTA approved. No crease visible. Complete box.' },
  { title: 'Huawei Pura 70 Ultra 512GB', brand: 'Huawei', model: 'Pura 70 Ultra', storage: '512GB', ram: '16GB', pta: 'Non-PTA', battery: '100%', color: 'Green', cond: 'new', price: 350000, desc: 'Huawei Pura 70 Ultra 512GB sealed. XMAGE camera system, satellite calling. Non-PTA. Premium flagship phone.' },
  // Search/voice search variants for phones
  { title: 'iPhone 15 Pro 256GB - Blue Titanium', brand: 'Apple', model: 'iPhone 15 Pro', storage: '256GB', ram: '8GB', pta: 'PTA Approved', battery: '96%', color: 'Blue Titanium', cond: 'used', price: 370000, desc: 'iPhone 15 Pro 256GB Blue Titanium. PTA approved. Battery health 96%. Action button, USB-C. Mint condition with box.' },
  { title: 'iPhone 15 128GB - Pink', brand: 'Apple', model: 'iPhone 15', storage: '128GB', ram: '6GB', pta: 'PTA Approved', battery: '98%', color: 'Pink', cond: 'used', price: 250000, desc: 'iPhone 15 128GB Pink. PTA approved. Dynamic Island, 48MP camera. Battery health 98%. Like new condition.' },
  { title: 'Samsung Galaxy S24 256GB - Amber Yellow', brand: 'Samsung', model: 'Galaxy S24', storage: '256GB', ram: '8GB', pta: 'PTA Approved', battery: '95%', color: 'Amber Yellow', cond: 'used', price: 195000, desc: 'Samsung Galaxy S24 256GB. Galaxy AI features, compact flagship. PTA approved. With box and unused earbuds.' },
  { title: 'Samsung Galaxy S23 Ultra 256GB - Cream', brand: 'Samsung', model: 'Galaxy S23 Ultra', storage: '256GB', ram: '12GB', pta: 'PTA Approved', battery: '88%', color: 'Cream', cond: 'used', price: 230000, desc: 'Samsung Galaxy S23 Ultra 256GB Cream. 200MP camera, S-Pen. PTA approved. Battery health 88%. With box.' },
  { title: 'Xiaomi Redmi Note 13 Pro 256GB', brand: 'Xiaomi', model: 'Redmi Note 13 Pro', storage: '256GB', ram: '8GB', pta: 'PTA Approved', battery: '100%', color: 'Midnight Black', cond: 'new', price: 52000, desc: 'Redmi Note 13 Pro 256GB brand new sealed. 200MP camera, AMOLED display. 67W turbo charging. Best mid-range phone.' },
  { title: 'iPhone 16 Pro Max 512GB - Desert Titanium', brand: 'Apple', model: 'iPhone 16 Pro Max', storage: '512GB', ram: '8GB', pta: 'PTA Approved', battery: '100%', color: 'Desert Titanium', cond: 'new', price: 620000, desc: 'iPhone 16 Pro Max 512GB Desert Titanium. Brand new sealed. PTA approved. Camera Control button, A18 Pro chip. Latest model.' },
  { title: 'Samsung Galaxy A15 128GB - Budget King', brand: 'Samsung', model: 'Galaxy A15', storage: '128GB', ram: '4GB', pta: 'PTA Approved', battery: '100%', color: 'Blue Black', cond: 'new', price: 32000, desc: 'Samsung Galaxy A15 128GB brand new. Super AMOLED display, 50MP camera. Best budget Samsung phone. Official warranty.' },
  { title: 'Oppo A78 128GB - Glowing Blue', brand: 'Oppo', model: 'A78', storage: '128GB', ram: '8GB', pta: 'PTA Approved', battery: '100%', color: 'Glowing Blue', cond: 'new', price: 42000, desc: 'Oppo A78 128GB brand new. 67W fast charging, AMOLED display. IP54 water resistant. Official warranty.' },
  { title: 'Nokia G42 128GB - Purple', brand: 'Nokia', model: 'G42', storage: '128GB', ram: '6GB', pta: 'PTA Approved', battery: '100%', color: 'Purple', cond: 'new', price: 35000, desc: 'Nokia G42 5G 128GB brand new. 3 years of OS updates, 50MP camera. Durable build quality. Official warranty.' },
  { title: 'Motorola Edge 50 Pro 256GB', brand: 'Motorola', model: 'Edge 50 Pro', storage: '256GB', ram: '12GB', pta: 'Non-PTA', battery: '100%', color: 'Luxe Lavender', cond: 'new', price: 95000, desc: 'Motorola Edge 50 Pro 256GB sealed. 50MP OIS camera, 125W charging. pOLED display. Non-PTA. Great value flagship.' },
];

// ── Motorcycles listing templates (15 listings) ─────────
const BIKE_LISTINGS = [
  { title: 'Honda CB 150F 2024 - Brand New Condition', make: 'Honda', model: 'CB 150F', year: 2024, mileage: 2000, cc: 150, price: 480000, desc: 'Honda CB 150F 2024 in red. Self start, disc brake, alloy rims. Only 2000 km driven. First owner. Lahore registered.' },
  { title: 'Yamaha YBR 125G 2023 - Well Maintained', make: 'Yamaha', model: 'YBR 125G', year: 2023, mileage: 15000, cc: 125, price: 310000, desc: 'Yamaha YBR 125G 2023. Self start, alloy rims, guard installed. Well maintained with regular oil changes. Karachi registered.' },
  { title: 'Honda CG 125 Dream 2022', make: 'Honda', model: 'CG 125 Dream', year: 2022, mileage: 20000, cc: 125, price: 230000, desc: 'Honda CG 125 Dream 2022. Self start, alloy rims. Genuine condition, no accident. Islamabad registered.' },
  { title: 'Suzuki GS 150 SE 2023 - Special Edition', make: 'Suzuki', model: 'GS 150 SE', year: 2023, mileage: 8000, cc: 150, price: 380000, desc: 'Suzuki GS 150 SE 2023 Special Edition. Disc brake, alloy rims, digital meter. Excellent condition. Rawalpindi registered.' },
  { title: 'Honda CD 70 Dream 2024 - Zero Meter Feel', make: 'Honda', model: 'CD 70 Dream', year: 2024, mileage: 500, cc: 70, price: 145000, desc: 'Honda CD 70 Dream 2024. Almost zero meter, only 500 km. Self start model. Faisalabad registered.' },
  { title: 'Kawasaki Ninja 400 2022 - Sports Bike', make: 'Kawasaki', model: 'Ninja 400', year: 2022, mileage: 5000, cc: 400, price: 1200000, desc: 'Kawasaki Ninja 400 2022 in green. ABS, slipper clutch. Only 5000 km. Imported, Islamabad registered. Mint condition.' },
  { title: 'Honda CB 250F 2023 - Adventure Ready', make: 'Honda', model: 'CB 250F', year: 2023, mileage: 10000, cc: 250, price: 750000, desc: 'Honda CB 250F 2023. ABS, LED headlamp, digital cluster. Well maintained. Lahore registered. With crash guard and top box.' },
  { title: 'Road Prince 150 Wego 2023', make: 'Road Prince', model: '150 Wego', year: 2023, mileage: 12000, cc: 150, price: 195000, desc: 'Road Prince 150 Wego 2023. Self start, disc brake. Good condition. Multan registered. Budget-friendly 150cc option.' },
  { title: 'Suzuki GD 110S 2024 - Fuel Efficient', make: 'Suzuki', model: 'GD 110S', year: 2024, mileage: 3000, cc: 110, price: 260000, desc: 'Suzuki GD 110S 2024. Self start, excellent fuel average. Only 3000 km driven. Lahore registered. Like new.' },
  { title: 'United US 125 Deluxe 2023', make: 'United', model: 'US 125 Deluxe', year: 2023, mileage: 18000, cc: 125, price: 165000, desc: 'United US 125 Deluxe 2023. Self start, alloy rims. Good condition for daily commute. Karachi registered.' },
  // Search variants
  { title: 'Honda CB 150F Special Edition 2023', make: 'Honda', model: 'CB 150F SE', year: 2023, mileage: 8000, cc: 150, price: 440000, desc: 'Honda CB 150F Special Edition 2023. Matte black color, disc brake front and rear. Well maintained. Islamabad registered.' },
  { title: 'Honda CG 125 Self Start 2024', make: 'Honda', model: 'CG 125', year: 2024, mileage: 1000, cc: 125, price: 275000, desc: 'Honda CG 125 Self Start 2024. Red color, brand new condition. Only 1000 km. Lahore registered. All documents clear.' },
  { title: 'Yamaha YBR 125 2022 - Black Edition', make: 'Yamaha', model: 'YBR 125', year: 2022, mileage: 25000, cc: 125, price: 250000, desc: 'Yamaha YBR 125 2022 in matte black. Self start, good condition. Regular maintenance done. Peshawar registered.' },
  { title: 'Suzuki GSX 125 2023 - Sports Commuter', make: 'Suzuki', model: 'GSX 125', year: 2023, mileage: 6000, cc: 125, price: 350000, desc: 'Suzuki GSX 125 2023. Sporty design, fuel injected. Disc brake, LED lights. Excellent condition. Lahore registered.' },
  { title: 'Honda Pridor 100cc 2023 - Fuel Saver', make: 'Honda', model: 'Pridor', year: 2023, mileage: 10000, cc: 100, price: 175000, desc: 'Honda Pridor 100cc 2023. Best fuel average in its class. Self start, alloy rims. Faisalabad registered.' },
];

// ── Property listing templates (15 listings) ────────────
const PROPERTY_LISTINGS = [
  { title: '10 Marla House in DHA Phase 6 Lahore', type: 'houses-sale', beds: 5, baths: 6, area: 2250, unit: 'Sq. Ft.', price: 45000000, desc: '10 Marla brand new house in DHA Phase 6. Modern architecture, 5 bedrooms with attached bathrooms. Drawing room, lounge, kitchen, servant quarter. Imported fittings, solid wood doors. Parking for 2 cars.' },
  { title: '3 Bed Apartment in Bahria Town Karachi', type: 'apartments-sale', beds: 3, baths: 3, area: 1550, unit: 'Sq. Ft.', price: 12500000, desc: '3 bedroom apartment in Bahria Town Karachi. Precinct 19. Lift, parking, 24/7 security. Well maintained building. Ready to move in. All utilities available.' },
  { title: '5 Marla House in Bahria Town Lahore', type: 'houses-sale', beds: 3, baths: 4, area: 1125, unit: 'Sq. Ft.', price: 18000000, desc: '5 Marla double story house in Bahria Town Lahore. 3 bedrooms, drawing room, lounge. Tiled flooring, fitted kitchen. Near mosque and park.' },
  { title: '1 Kanal Plot in DHA Phase 9 Lahore', type: 'land-plots-sale', beds: 0, baths: 0, area: 4500, unit: 'Sq. Ft.', price: 35000000, desc: '1 Kanal residential plot in DHA Phase 9 Prism. Block D. 60 feet road. Ideal location near park. All dues paid. Transfer ready.' },
  { title: '2 Bed Flat for Rent in F-11 Islamabad', type: 'apartments-rent', beds: 2, baths: 2, area: 1100, unit: 'Sq. Ft.', price: 85000, desc: '2 bedroom apartment for rent in F-11 Islamabad. Ground floor, separate entrance. Marble flooring, fitted kitchen. Near market and schools.' },
  { title: '7 Marla House in G-13 Islamabad', type: 'houses-sale', beds: 4, baths: 5, area: 1575, unit: 'Sq. Ft.', price: 28000000, desc: '7 Marla house in G-13 Islamabad. 4 bedrooms, drawing room, TV lounge. Double story with basement. Gas, water, electricity available.' },
  { title: 'Shop for Sale in Gulberg Lahore', type: 'commercial-sale', beds: 0, baths: 1, area: 400, unit: 'Sq. Ft.', price: 8500000, desc: 'Commercial shop in Gulberg III main boulevard. Ground floor, 400 sq ft. High foot traffic area. Ideal for retail or office. Parking available.' },
  { title: '10 Marla House for Rent in DHA Lahore', type: 'houses-rent', beds: 4, baths: 5, area: 2250, unit: 'Sq. Ft.', price: 150000, desc: '10 Marla furnished house for rent in DHA Phase 5. 4 bedrooms, servant quarter. AC installed in all rooms. Lawn, car porch. Available immediately.' },
  { title: '3 Marla House in Johar Town Lahore', type: 'houses-sale', beds: 2, baths: 3, area: 675, unit: 'Sq. Ft.', price: 9500000, desc: '3 Marla double story house in Johar Town. 2 bedrooms, drawing room, kitchen. Near canal road. Ideal for small family.' },
  { title: 'Penthouse in Clifton Karachi - Sea View', type: 'apartments-sale', beds: 4, baths: 4, area: 3200, unit: 'Sq. Ft.', price: 55000000, desc: 'Luxury penthouse in Clifton Block 2. Sea facing, 4 bedrooms. Rooftop terrace, jacuzzi. Imported kitchen. 2 car parking. 24/7 security.' },
  // Search variants
  { title: '5 Marla House in DHA Phase 5 Lahore', type: 'houses-sale', beds: 3, baths: 3, area: 1125, unit: 'Sq. Ft.', price: 22000000, desc: '5 Marla house in DHA Phase 5. Renovated, modern design. 3 bedrooms, TV lounge. Near park and commercial area. Ideal location.' },
  { title: '10 Marla Plot in Bahria Town Islamabad', type: 'land-plots-sale', beds: 0, baths: 0, area: 2250, unit: 'Sq. Ft.', price: 15000000, desc: '10 Marla plot in Bahria Town Phase 8 Islamabad. Sector F-1. Level plot, ideal for construction. All dues cleared.' },
  { title: '2 Bed Apartment in DHA Phase 2 Islamabad', type: 'apartments-sale', beds: 2, baths: 2, area: 1200, unit: 'Sq. Ft.', price: 16000000, desc: '2 bedroom luxury apartment in DHA Phase 2 Islamabad. Sector J. Gym, pool, community center. Brand new, ready to move.' },
  { title: 'Room for Rent in G-9 Islamabad', type: 'rooms-rent', beds: 1, baths: 1, area: 250, unit: 'Sq. Ft.', price: 18000, desc: 'Furnished room for rent in G-9 Islamabad. Attached bathroom, AC, WiFi included. Near metro station. Ideal for working professionals.' },
  { title: '1 Kanal House in Model Town Lahore', type: 'houses-sale', beds: 6, baths: 7, area: 4500, unit: 'Sq. Ft.', price: 65000000, desc: '1 Kanal house in Model Town Lahore. 6 bedrooms, drawing room, 2 lounges. Swimming pool, lawn. Prime location near market.' },
];

// ── Electronics listing templates (10 listings) ─────────
const ELECTRONICS_LISTINGS = [
  { title: 'MacBook Pro M3 14" 16GB/512GB - Space Black', cat: 'computers', price: 650000, cond: 'used', desc: 'MacBook Pro 14-inch M3 chip, 16GB RAM, 512GB SSD. Space Black. Battery cycle count under 20. AppleCare+ until 2027. With original box and charger.' },
  { title: 'Dell XPS 15 - i7 13th Gen 16GB/512GB', cat: 'computers', price: 320000, cond: 'used', desc: 'Dell XPS 15 9530 with Intel i7-13700H, 16GB RAM, 512GB SSD. OLED 3.5K display. Excellent condition. With charger and sleeve.' },
  { title: 'Sony 65" 4K OLED TV - Bravia XR A80L', cat: 'tv-video-audio', price: 450000, cond: 'new', desc: 'Sony Bravia XR A80L 65-inch 4K OLED TV. Brand new sealed. Cognitive Processor XR, Dolby Vision, Dolby Atmos. 2 year warranty.' },
  { title: 'PS5 Slim Digital Edition - With 2 Controllers', cat: 'games-entertainment', price: 125000, cond: 'used', desc: 'PlayStation 5 Slim Digital Edition. 2 DualSense controllers, charging dock. 5 digital games included. Excellent condition.' },
  { title: 'Haier 1.5 Ton Inverter AC - HSU-18HFC', cat: 'ac-coolers', price: 95000, cond: 'used', desc: 'Haier 1.5 Ton DC Inverter AC. 2023 model. Turbo cooling, WiFi control. Used for one summer only. With warranty card.' },
  { title: 'Canon EOS R6 Mark II - Body Only', cat: 'cameras', price: 520000, cond: 'used', desc: 'Canon EOS R6 Mark II mirrorless camera body. 24.2MP, 4K 60fps video. Shutter count under 5000. With box, battery, charger.' },
  { title: 'Samsung 55" Crystal UHD 4K Smart TV', cat: 'tv-video-audio', price: 120000, cond: 'new', desc: 'Samsung 55-inch Crystal UHD 4K Smart TV. Brand new. Tizen OS, HDR10+, Crystal Processor 4K. 2 year official warranty.' },
  { title: 'iPad Pro M4 11" 256GB WiFi - Space Black', cat: 'computers', price: 280000, cond: 'new', desc: 'iPad Pro M4 11-inch 256GB WiFi. Brand new sealed. Ultra Retina XDR display, Apple Pencil Pro support. Official warranty.' },
  { title: 'Dawlance 15 CFT Refrigerator - Inverter', cat: 'fridges-freezers', price: 110000, cond: 'new', desc: 'Dawlance 9191 WB Chrome Pro 15 CFT refrigerator. Inverter technology, no frost. Brand new with 10 year compressor warranty.' },
  { title: 'Honda EU2200i Generator - Portable', cat: 'generators-ups', price: 185000, cond: 'used', desc: 'Honda EU2200i portable inverter generator. 2200W, super quiet. Used for 50 hours only. Perfect for home backup. With original manual.' },
];

// ── Fashion listing templates (5 listings) ──────────────
const FASHION_LISTINGS = [
  { title: 'Rolex Submariner Date - Authentic', cat: 'watches', price: 2800000, cond: 'used', desc: 'Rolex Submariner Date 126610LN. Authentic with box and papers. 2022 purchase. Excellent condition. Serviced recently.' },
  { title: 'Bridal Lehnga - Heavy Dabka Work', cat: 'wedding', price: 85000, cond: 'used', desc: 'Beautiful bridal lehnga in maroon and gold. Heavy dabka and zardozi work. Worn once. Custom stitched, fits medium size. With dupatta.' },
  { title: 'Nike Air Jordan 1 Retro High - Size 10', cat: 'footwear', price: 35000, cond: 'new', desc: 'Nike Air Jordan 1 Retro High OG. Brand new with box. Size US 10. University Blue colorway. Imported, authentic.' },
  { title: 'Ray-Ban Aviator Classic - Gold Frame', cat: 'fashion-accessories', price: 18000, cond: 'new', desc: 'Ray-Ban Aviator Classic RB3025. Gold frame, green G-15 lens. Brand new with case and cleaning cloth. Imported original.' },
  { title: 'Sapphire Unstitched 3-Piece Lawn 2024', cat: 'clothes', price: 4500, cond: 'new', desc: 'Sapphire unstitched 3-piece lawn suit. 2024 summer collection. Printed shirt, dyed trouser, printed dupatta. Brand new sealed.' },
];

// ── Furniture listing templates (5 listings) ────────────
const FURNITURE_LISTINGS = [
  { title: '7 Seater L-Shape Sofa - Velvet', cat: 'sofa-chairs', price: 95000, cond: 'used', desc: '7 seater L-shape sofa in royal blue velvet. Solid wood frame, foam cushions. 1 year old, excellent condition. With cushions.' },
  { title: 'King Size Bed with Side Tables - Sheesham', cat: 'beds-wardrobes', price: 120000, cond: 'used', desc: 'King size bed with 2 side tables in Sheesham wood. Polish finish. With mattress. 2 years old, good condition.' },
  { title: '6 Seater Dining Table - Glass Top', cat: 'tables-dining', price: 55000, cond: 'used', desc: '6 seater dining table with glass top and metal frame. With 6 cushioned chairs. Modern design. Good condition.' },
  { title: 'Office Executive Desk - L-Shape', cat: 'office-furniture', price: 45000, cond: 'new', desc: 'L-shape executive office desk in walnut finish. With 3 drawers, cable management. Brand new, assembly required.' },
  { title: 'Wall Art Canvas Set - 5 Pieces', cat: 'home-decoration', price: 8500, cond: 'new', desc: '5-piece canvas wall art set. Abstract modern design in blue and gold. Ready to hang. Various sizes. Brand new.' },
];

// ── Animals listing templates (5 listings) ──────────────
const ANIMAL_LISTINGS = [
  { title: 'Persian Cat - Triple Coat Female', cat: 'cats', price: 25000, cond: 'new', desc: 'Beautiful Persian cat, triple coat, white color. Female, 8 months old. Vaccinated, litter trained. Very friendly and playful.' },
  { title: 'German Shepherd Puppies - Pure Breed', cat: 'dogs', price: 45000, cond: 'new', desc: 'German Shepherd puppies, pure breed. 2 months old. Vaccinated, dewormed. Both parents available for viewing. Male and female available.' },
  { title: 'Golden Misri Hens - Laying Eggs', cat: 'hens', price: 1500, cond: 'new', desc: 'Golden Misri hens, 6 months old. Currently laying eggs. Vaccinated, healthy. Farm bred. Minimum order 10 hens.' },
  { title: 'African Grey Parrot - Talking', cat: 'parrots', price: 180000, cond: 'new', desc: 'African Grey parrot, 2 years old. Talks clearly, knows 50+ words. Very tame, hand fed since baby. With large cage.' },
  { title: 'Labrador Retriever Puppy - Golden', cat: 'dogs', price: 35000, cond: 'new', desc: 'Labrador Retriever puppy, golden color. 3 months old. Vaccinated, dewormed. Very active and friendly. With vaccination card.' },
];

// ── Main seed function ──────────────────────────────────
async function seed() {
  const imagePool = collectExistingImages();
  console.log(`📸 Found ${imagePool.length} existing images to reuse`);

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    console.log('Connected to MongoDB');

    // ── Fetch existing users with role 'user' ───────────
    const users = await db.collection('users').find({ role: 'user', status: 'active' }).toArray();
    if (!users.length) {
      console.error('❌ No users with role "user" found. Run seed.js first.');
      process.exit(1);
    }
    console.log(`👥 Found ${users.length} users with role "user"`);

    // ── Fetch categories (build slug→id map) ────────────
    const allCats = await db.collection('categories').find({}).toArray();
    const catBySlug = {};
    const catById = {};
    for (const c of allCats) {
      catBySlug[c.slug] = c;
      catById[c._id.toString()] = c;
    }

    // Helper: build categoryPath from a category
    function getCategoryPath(cat) {
      const path = [cat._id];
      if (cat.parentId) {
        const parent = catById[cat.parentId.toString()];
        if (parent) {
          path.unshift(parent._id);
          if (parent.parentId) {
            const grandparent = catById[parent.parentId.toString()];
            if (grandparent) path.unshift(grandparent._id);
          }
        }
      }
      return path;
    }

    // ── Fetch location IDs ──────────────────────────────
    const provinces = await db.collection('provinces').find({}).toArray();
    const cities = await db.collection('cities').find({}).toArray();
    const areas = await db.collection('areas').find({}).toArray();

    function resolveLocation(locData) {
      const loc = makeLocation(locData);
      const result = { province: loc.province, city: loc.city, area: loc.area };
      const prov = provinces.find(p => p.name === loc.province);
      if (prov) {
        result.provinceId = prov._id;
        const city = cities.find(c => c.name === loc.city && c.provinceId.toString() === prov._id.toString());
        if (city) {
          result.cityId = city._id;
          const area = areas.find(a => a.name === loc.area && a.cityId.toString() === city._id.toString());
          if (area) result.areaId = area._id;
        }
      }
      return result;
    }

    // ── Fetch vehicle brands/models for linking ─────────
    const vBrands = await db.collection('vehicle_brands').find({}).toArray();
    const vModels = await db.collection('vehicle_models').find({}).toArray();

    function resolveVehicleBrand(makeName, catSlug) {
      const vType = catSlug === 'cars' ? 'car' : 'motorcycle';
      const brand = vBrands.find(b => b.name.toLowerCase() === makeName.toLowerCase() && b.vehicleType === vType);
      if (!brand) return {};
      const result = { vehicleBrandId: brand._id, vehicleBrandName: brand.name };
      return result;
    }

    function resolveVehicleModel(makeName, modelName, catSlug) {
      const brandInfo = resolveVehicleBrand(makeName, catSlug);
      if (!brandInfo.vehicleBrandId) return brandInfo;
      const model = vModels.find(m => m.brandId.toString() === brandInfo.vehicleBrandId.toString() &&
        m.name.toLowerCase() === modelName.toLowerCase());
      if (model) {
        brandInfo.modelId = model._id;
        brandInfo.modelName = model.name;
      }
      return brandInfo;
    }

    // ── Fetch brands for non-vehicle categories ─────────
    const brands = await db.collection('brands').find({}).toArray();

    function resolveBrand(brandName, categoryId) {
      const brand = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase() &&
        b.categoryId.toString() === categoryId.toString());
      if (brand) return { brandId: brand._id, brandName: brand.name };
      return {};
    }

    const now = new Date();
    const listings = [];
    let listingIndex = 0;

    // ── Status assignment: 90 active, 10 other ──────────
    const otherStatuses = ['pending_review', 'pending_review', 'sold', 'sold', 'reserved', 'inactive', 'expired', 'rejected', 'pending_review', 'sold'];

    function getStatus(idx) {
      if (idx >= 90) return otherStatuses[idx - 90];
      return 'active';
    }

    function getUser() { return pick(users); }

    // ── Build Car listings (25) ───────────────────────────
    const carsCat = catBySlug['cars'];
    if (carsCat) {
      const carsParent = catBySlug['vehicles'];
      for (const c of CAR_LISTINGS) {
        const user = getUser();
        const loc = resolveLocation();
        const vehicleInfo = resolveVehicleModel(c.make, c.model, 'cars');
        listings.push({
          _id: new ObjectId(),
          sellerId: user._id,
          title: c.title,
          description: c.desc,
          price: { amount: c.price, currency: 'PKR' },
          categoryId: carsCat._id,
          categoryPath: getCategoryPath(carsCat),
          condition: 'used',
          ...vehicleInfo,
          categoryAttributes: {
            make: c.make, model: c.model, year: c.year, mileage: c.mileage,
            fuel_type: c.fuel, transmission: c.trans, color: c.color,
            body_type: c.body, engine_cc: c.cc, owners: rand(1, 3),
            registration_city: loc.city, assembly: pick(['Local', 'Imported']),
          },
          images: pickImages(imagePool, rand(2, 5)),
          location: loc,
          contactInfo: { phone: user.phone || '+923001234567', email: user.email },
          status: getStatus(listingIndex),
          isFeatured: listingIndex % 7 === 0,
          featuredUntil: listingIndex % 7 === 0 ? new Date(Date.now() + 30 * 864e5) : undefined,
          viewCount: rand(10, 1500),
          favoriteCount: rand(0, 80),
          createdAt: daysAgo(rand(1, 30)),
          updatedAt: now,
        });
        listingIndex++;
      }
    } else {
      console.warn('⚠️  "Cars" category not found, skipping car listings');
    }

    // ── Build Phone listings (25) ───────────────────────
    const phonesCat = catBySlug['mobile-phones'];
    if (phonesCat) {
      for (const p of PHONE_LISTINGS) {
        const user = getUser();
        const loc = resolveLocation();
        const brandInfo = resolveBrand(p.brand, phonesCat._id);
        listings.push({
          _id: new ObjectId(),
          sellerId: user._id,
          title: p.title,
          description: p.desc,
          price: { amount: p.price, currency: 'PKR' },
          categoryId: phonesCat._id,
          categoryPath: getCategoryPath(phonesCat),
          condition: p.cond,
          ...brandInfo,
          categoryAttributes: {
            brand: p.brand, model: p.model, storage: p.storage,
            ram: p.ram, pta_status: p.pta, battery_health: p.battery, color: p.color,
          },
          images: pickImages(imagePool, rand(2, 4)),
          location: loc,
          contactInfo: { phone: user.phone || '+923009876543', email: user.email },
          status: getStatus(listingIndex),
          isFeatured: listingIndex % 9 === 0,
          featuredUntil: listingIndex % 9 === 0 ? new Date(Date.now() + 15 * 864e5) : undefined,
          viewCount: rand(20, 2000),
          favoriteCount: rand(0, 100),
          createdAt: daysAgo(rand(1, 25)),
          updatedAt: now,
        });
        listingIndex++;
      }
    } else {
      console.warn('⚠️  "Mobile Phones" category not found, skipping phone listings');
    }

    // ── Build Bike listings (15) ────────────────────────
    const bikesCat = catBySlug['motorcycles'];
    if (bikesCat) {
      for (const b of BIKE_LISTINGS) {
        const user = getUser();
        const loc = resolveLocation();
        const vehicleInfo = resolveVehicleModel(b.make, b.model, 'motorcycles');
        listings.push({
          _id: new ObjectId(),
          sellerId: user._id,
          title: b.title,
          description: b.desc,
          price: { amount: b.price, currency: 'PKR' },
          categoryId: bikesCat._id,
          categoryPath: getCategoryPath(bikesCat),
          condition: 'used',
          ...vehicleInfo,
          categoryAttributes: {
            make: b.make, model: b.model, year: b.year,
            mileage: b.mileage, engine_cc: b.cc,
          },
          images: pickImages(imagePool, rand(2, 4)),
          location: loc,
          contactInfo: { phone: user.phone || '+923001234567', email: user.email },
          status: getStatus(listingIndex),
          isFeatured: listingIndex % 11 === 0,
          viewCount: rand(15, 800),
          favoriteCount: rand(0, 40),
          createdAt: daysAgo(rand(1, 28)),
          updatedAt: now,
        });
        listingIndex++;
      }
    } else {
      console.warn('⚠️  "Motorcycles" category not found, skipping bike listings');
    }

    // ── Build Property listings (15) ──────────────────────
    for (const p of PROPERTY_LISTINGS) {
      const propCat = catBySlug[p.type];
      if (!propCat) { console.warn(`⚠️  Category "${p.type}" not found, skipping`); listingIndex++; continue; }
      const user = getUser();
      const loc = resolveLocation();
      const attrs = { area_size: p.area, area_unit: p.unit };
      if (p.beds) attrs.bedrooms = p.beds;
      if (p.baths) attrs.bathrooms = p.baths;
      listings.push({
        _id: new ObjectId(),
        sellerId: user._id,
        title: p.title,
        description: p.desc,
        price: { amount: p.price, currency: 'PKR' },
        categoryId: propCat._id,
        categoryPath: getCategoryPath(propCat),
        condition: 'used',
        categoryAttributes: attrs,
        images: pickImages(imagePool, rand(2, 5)),
        location: loc,
        contactInfo: { phone: user.phone || '+923001234567', email: user.email },
        status: getStatus(listingIndex),
        isFeatured: listingIndex % 8 === 0,
        viewCount: rand(50, 2500),
        favoriteCount: rand(0, 120),
        createdAt: daysAgo(rand(1, 30)),
        updatedAt: now,
      });
      listingIndex++;
    }

    // ── Build Electronics listings (10) ─────────────────
    for (const e of ELECTRONICS_LISTINGS) {
      const elecCat = catBySlug[e.cat];
      if (!elecCat) { console.warn(`⚠️  Category "${e.cat}" not found, skipping`); listingIndex++; continue; }
      const user = getUser();
      const loc = resolveLocation();
      listings.push({
        _id: new ObjectId(),
        sellerId: user._id,
        title: e.title,
        description: e.desc,
        price: { amount: e.price, currency: 'PKR' },
        categoryId: elecCat._id,
        categoryPath: getCategoryPath(elecCat),
        condition: e.cond,
        categoryAttributes: {},
        images: pickImages(imagePool, rand(2, 4)),
        location: loc,
        contactInfo: { phone: user.phone || '+923001234567', email: user.email },
        status: getStatus(listingIndex),
        isFeatured: listingIndex % 10 === 0,
        viewCount: rand(30, 1200),
        favoriteCount: rand(0, 60),
        createdAt: daysAgo(rand(1, 20)),
        updatedAt: now,
      });
      listingIndex++;
    }

    // ── Build Fashion listings (5) ──────────────────────
    for (const f of FASHION_LISTINGS) {
      const fashCat = catBySlug[f.cat];
      if (!fashCat) { console.warn(`⚠️  Category "${f.cat}" not found, skipping`); listingIndex++; continue; }
      const user = getUser();
      const loc = resolveLocation();
      listings.push({
        _id: new ObjectId(),
        sellerId: user._id,
        title: f.title,
        description: f.desc,
        price: { amount: f.price, currency: 'PKR' },
        categoryId: fashCat._id,
        categoryPath: getCategoryPath(fashCat),
        condition: f.cond,
        categoryAttributes: {},
        images: pickImages(imagePool, rand(2, 4)),
        location: loc,
        contactInfo: { phone: user.phone || '+923001234567', email: user.email },
        status: getStatus(listingIndex),
        isFeatured: false,
        viewCount: rand(20, 600),
        favoriteCount: rand(0, 30),
        createdAt: daysAgo(rand(1, 15)),
        updatedAt: now,
      });
      listingIndex++;
    }

    // ── Build Furniture listings (5) ────────────────────
    for (const f of FURNITURE_LISTINGS) {
      const furnCat = catBySlug[f.cat];
      if (!furnCat) { console.warn(`⚠️  Category "${f.cat}" not found, skipping`); listingIndex++; continue; }
      const user = getUser();
      const loc = resolveLocation();
      listings.push({
        _id: new ObjectId(),
        sellerId: user._id,
        title: f.title,
        description: f.desc,
        price: { amount: f.price, currency: 'PKR' },
        categoryId: furnCat._id,
        categoryPath: getCategoryPath(furnCat),
        condition: f.cond,
        categoryAttributes: {},
        images: pickImages(imagePool, rand(2, 3)),
        location: loc,
        contactInfo: { phone: user.phone || '+923001234567', email: user.email },
        status: getStatus(listingIndex),
        isFeatured: false,
        viewCount: rand(10, 400),
        favoriteCount: rand(0, 20),
        createdAt: daysAgo(rand(1, 20)),
        updatedAt: now,
      });
      listingIndex++;
    }

    // ── Build Animal listings (5) ───────────────────────
    for (const a of ANIMAL_LISTINGS) {
      const animalCat = catBySlug[a.cat];
      if (!animalCat) { console.warn(`⚠️  Category "${a.cat}" not found, skipping`); listingIndex++; continue; }
      const user = getUser();
      const loc = resolveLocation();
      listings.push({
        _id: new ObjectId(),
        sellerId: user._id,
        title: a.title,
        description: a.desc,
        price: { amount: a.price, currency: 'PKR' },
        categoryId: animalCat._id,
        categoryPath: getCategoryPath(animalCat),
        condition: a.cond,
        categoryAttributes: {},
        images: pickImages(imagePool, rand(2, 3)),
        location: loc,
        contactInfo: { phone: user.phone || '+923001234567', email: user.email },
        status: getStatus(listingIndex),
        isFeatured: false,
        viewCount: rand(20, 500),
        favoriteCount: rand(0, 25),
        createdAt: daysAgo(rand(1, 20)),
        updatedAt: now,
      });
      listingIndex++;
    }

    // ── Insert all listings ───────────────────────────────
    console.log(`\n📝 Inserting ${listings.length} listings...`);
    const result = await db.collection('product_listings').insertMany(listings);
    console.log(`✅ Inserted ${result.insertedCount} listings`);

    // ── Update activeAdCount for each seller ────────────
    const sellerCounts = {};
    for (const l of listings) {
      if (l.status === 'active') {
        const sid = l.sellerId.toString();
        sellerCounts[sid] = (sellerCounts[sid] || 0) + 1;
      }
    }
    for (const [sid, count] of Object.entries(sellerCounts)) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(sid) },
        { $inc: { activeAdCount: count } }
      );
    }
    console.log(`👥 Updated activeAdCount for ${Object.keys(sellerCounts).length} sellers`);

    // ── Sync to Elasticsearch (best-effort) ─────────────
    try {
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
          categoryAttributes: doc.categoryAttributes instanceof Map
            ? Object.fromEntries(doc.categoryAttributes)
            : doc.categoryAttributes,
          brandName: doc.brandName || doc.vehicleBrandName,
          modelName: doc.modelName,
          isFeatured: doc.isFeatured,
          status: doc.status,
          sellerId: doc.sellerId.toString(),
          createdAt: doc.createdAt,
          location: doc.location?.cityId ? {
            province: doc.location.province,
            city: doc.location.city,
            area: doc.location.area,
          } : undefined,
        }));
      }
      const res = await fetch('http://localhost:9200/_bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: body.join('\n') + '\n',
      });
      const esResult = await res.json();
      const esErrors = esResult.items?.filter(i => i.index?.error) || [];
      console.log(`🔍 Synced ${(esResult.items?.length || 0) - esErrors.length} to Elasticsearch${esErrors.length ? ` (${esErrors.length} errors)` : ''}`);
    } catch (esErr) {
      console.warn(`⚠️  Elasticsearch sync skipped: ${esErr.message}`);
    }

    // ── Summary ─────────────────────────────────────────
    const activeCount = listings.filter(l => l.status === 'active').length;
    const otherCount = listings.length - activeCount;
    const catCounts = {};
    for (const l of listings) {
      const cat = catById[l.categoryId.toString()];
      const name = cat ? cat.name : 'Unknown';
      catCounts[name] = (catCounts[name] || 0) + 1;
    }

    console.log(`\n✅ Seed complete!`);
    console.log(`   Total listings: ${listings.length}`);
    console.log(`   Active (approved): ${activeCount}`);
    console.log(`   Other statuses: ${otherCount}`);
    console.log(`   By category:`);
    for (const [name, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${name}: ${count}`);
    }
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
