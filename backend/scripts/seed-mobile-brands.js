/**
 * Seed mobile phone brands under "Mobile Phones" category.
 * Usage: node scripts/seed-mobile-brands.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const CATEGORY_ID = '69ceac637bc913bf0da6ef1d'; // Mobile Phones

const brands = [
  'Apple', 'Samsung', 'Huawei', 'Xiaomi', 'Oppo', 'Vivo', 'Realme',
  'OnePlus', 'Google', 'Sony', 'LG', 'Motorola', 'Nokia', 'Honor',
  'HTC', 'Asus', 'Lenovo', 'ZTE', 'TCL', 'Alcatel', 'BlackBerry',
  'Infinix', 'Tecno', 'itel', 'Micromax', 'Lava', 'Karbonn', 'Spice',
  'Panasonic', 'Sharp', 'Meizu', 'Coolpad', 'Redmi', 'Poco', 'iQOO',
  'ZUK', 'Fairphone', 'LeEco / LeTV', 'Smartisan', 'Gionee', 'UMIDIGI',
  'Doogee', 'Cubot', 'Oukitel', 'Ulefone', 'Blackview', 'Elephone',
  'HomTom', 'Vernee', 'Maze', 'Meiigoo', 'BLU', 'Razer Phone', 'Nubia',
  'RedMagic', 'Black Shark', 'Palm', 'Vertu', 'Turing Phone',
  'Hydrogen One', 'Yota', 'Energizer', 'Vsmart', 'Wiko', 'BQ',
  'Kenxinda', 'Philips', 'Maxwest', 'Sanyo', 'Casio', 'NEC', 'Kyocera',
  'Sendo', 'Icemobile', 'Plum', 'Verykool', 'Stern', 'E-TEN',
  'Gigabyte', 'Advan', 'Mito', 'Smartfren', 'Azumi', 'Evercoss',
  'IMobile', 'InFocus', 'Nuu', 'VKworld', 'Hotwav', 'QMobile',
  'Mobilink', 'Nothing', 'Sparx', 'Dcode', 'Sego', 'Rivo', 'Haier',
  'HMD', 'Microsoft Mobile', 'Sony Ericsson', 'Xtouch', 'Dizo', 'Unihertz',
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection('brands');

  let added = 0;
  let skipped = 0;

  for (const name of brands) {
    const exists = await col.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      categoryId: new mongoose.Types.ObjectId(CATEGORY_ID),
    });

    if (exists) {
      skipped++;
      continue;
    }

    await col.insertOne({
      name,
      categoryId: new mongoose.Types.ObjectId(CATEGORY_ID),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    added++;
  }

  console.log(`✅ Added ${added} brands, skipped ${skipped} duplicates`);
  await mongoose.disconnect();
}

main().catch(console.error);
