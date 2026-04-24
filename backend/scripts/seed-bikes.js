/**
 * Seed bike brands, models, and variants.
 * Looks up the "Bikes" category dynamically from the categories collection.
 *
 * Usage: node scripts/seed-bikes.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const BIKES_DATA = {
  "Aima": { "One": [], "Pulse": [], "Spark": [] },
  "Ali Khan Auto Company": { "Thunder Bird EV": [] },
  "Aprilia": {
    "RS 660": ["Extrema", "Factory"],
    "RX 50": ["Factory"],
    "SPORTCITY CUBE 125 - 200 - 300": ["125", "200", "300"],
  },
  "Asia Hero": { "CDI 70": [] },
  "BMW": {
    "F 850 GS": [], "G 310 GS": [], "HP 2 Sport": [], "HP 4 COMPETITION": [],
    "M 1000 R": ["M Competition"], "M 1000 RR": ["M Competition"],
    "R 1250 GS Adventure": [], "S1000RR": ["M Package"],
  },
  "BRG": { "ES20": [] },
  "Benda": { "Napoleonbob 500": [] },
  "Benelli": {
    "180S": [], "251s": [], "302 R": [], "302S": [], "502C": [], "752S": [],
    "Imperiale 400": [], "Leoncino 250": [],
    "Leoncino 500": ["Trail"], "Leoncino 800": ["Trail"],
    "TNT 150i": [], "TNT 25": [], "TNT 600i": [],
    "TRK 251": [], "TRK 502": ["X"], "TRK 702": ["X"],
  },
  "Benling": {
    "Firefly": [], "Knight Rider": [], "Mini Scooter": [],
    "Roshni Plus": [], "Roshni Pro": [],
  },
  "Bingo Electric": { "Classic": [] },
  "Bionic": { "70 cc": [] },
  "CF MOTO": {
    "250CL-X": [], "400NK": [], "450MT": [], "800 MT Touring Dakar": [],
  },
  "Can-am spyder": { "RS SM5": ["SE5", "RS-S"] },
  "Chinese Bikes": {
    "125": [], "150cc": [], "70": [], "Lifan": [],
    "OW Ninja": ["250cc", "300cc", "400cc"],
    "OW R3": ["250cc", "300cc", "400cc"],
  },
  "Crown": {
    "CR 100": ["Excellence", "Self Start Alloy Rim"],
    "CR 125": ["Euro II", "Self Start Alloy Rim"],
    "CR 70": ["HD Plus", "Jazba", "Self Start"],
    "CRLF 70": [], "CRLF 70cc Euro ll": ["Euro II"],
    "EV Pro": [], "EV-1000": [], "EV-350": [],
    "FIT 150 Fighter": [], "RF 70": [], "Raftaar": [],
  },
  "Derbi": { "Aprilla": [], "ETX 150": [], "STX 150": [] },
  "Ducati": {
    "Desmosedici RR": [], "GT 1000": [],
    "Multistrada V4": ["V4", "V4 S", "Pikes Peak", "Rally", "RS"],
    "Panigale V4": ["V4", "V4 S", "Tricolore", "Tricolore Italia"],
    "Superleggera V4": [],
  },
  "E Turbo": { "Evo": [], "Thunderbolt": [] },
  "Eagle": { "ES 70": [], "Fire Bolt ES70": [], "Super Speed 70 cc": [] },
  "EcoDost": { "ED-70": [] },
  "Evee": {
    "C1": ["Air", "Pro"], "Flipper": [], "Gen-Z": [], "Mito": [],
    "Nisa": ["3W"], "S1": ["Air", "Pro"],
  },
  "Eveon": { "Flora": [], "Leopard": ["Pro"], "Pronto": [] },
  "Express": { "E-70": [] },
  "Ezbike": { "Electron": [] },
  "FUEGO": { "Scrambler 250": [], "TEKKEN 250": [] },
  "Ghani": { "Gi 70": ["Self Start"] },
  "Habib": { "HB 70": [] },
  "Harley Davidson": {
    "1200 Custom": [], "883 Low": [], "Fat Boy": [],
    "Iron 883": [], "Sportster S": [],
  },
  "Hero": { "RF 70": [] },
  "Hi Speed": {
    "Alpha SR 100": [], "CDI SR-70CC EURO-2": ["Euro II"],
    "Cyclone 250": [], "Infinity 150": [], "RM-i500": [],
    "SR 125cc": [], "SR 200": [], "SR 70": [],
  },
  "Honda": {
    "50cc": [],
    "Africa Twin CRF 1000L": ["DCT", "Adventure Sports", "Adventure Sports DCT"],
    "Benly e": ["e:I", "e:II", "e:I Pro", "e:II Pro"],
    "CB 125F": [], "CB 150F": [], "CB 250F": [], "CB 350": [],
    "CB 400": ["X", "Super Four", "Super Bol d'Or"],
    "CB 650R": [], "CB400": ["Super Four", "Super Bol d'Or"],
    "CBR 1000RR": [], "CBR 150R": [], "CBR 600RR": [],
    "CBR250": ["RR"], "CD 100": ["Euro 2"], "CD 110": [],
    "CD 70": ["Dream"], "CD-100": [],
    "CG 125": ["Deluxe", "Dream", "S", "Special Edition", "Gold"],
    "CG 150": [], "Deluxe": [], "EV S07": [], "H100S": [],
    "ICON e:": [], "Pridor": [],
    "Rebel": ["300", "500", "500 SE", "1100", "1100 DCT", "1100 DCT SE", "1100T", "1100T DCT"],
  },
  "Huaguan": { "Ibex": [] },
  "Jolta Electric": { "Aero Pro": [], "JE-70D": [], "Sparrow": [] },
  "KEEWAY": { "K-Light": [], "Super Light": [] },
  "KTM": { "450 EXC": [], "690 Duke": [] },
  "Kawasaki": {
    "BALIUS ZR250": [], "Eliminator ZL 750": [],
    "Ninja 150cc": ["RR"], "Ninja 250R": ["ABS"],
    "Ninja 400": ["ABS", "KRT Edition", "KRT Edition ABS"],
    "Ninja 650R": ["ABS"],
    "Ninja H2": ["Carbon"],
    "Ninja ZX-10R": ["ABS", "SE", "KRT Edition"],
    "Ninja ZX-6R": ["ABS", "KRT Edition"],
    "Ninja ZX300": ["ABS"], "Z1000": [],
  },
  "Kove": { "450 Rally": [] },
  "Leader": { "Amazing 100cc": [] },
  "Lectrix": { "Scooty": [] },
  "Lifan": {
    "250": [], "400": [], "K19": [], "K29": [],
    "KP Master 200": [], "KPR 200": [], "KPT 200": [], "V16S": [],
  },
  "Loncin": { "GP 300": [] },
  "MS Jaguar Motorcycle": {
    "100cc": [], "E-125": [], "E-70": ["Supreme"], "E-Scooter": [],
  },
  "Metro": {
    "A7": [], "Boom 70": [], "E8S pro": [], "Jeet 70": [],
    "LY Superbike": [], "M6 Empower": [],
    "MR 100": ["Self Start"], "MR 125": [],
    "MR 70": ["Limited Edition"], "T9": [], "TEZ RAFTAR 70": [],
    "X8 Foldable Electric Scooter": [],
  },
  "NPTC": { "ATV": [], "R1 400CC": [], "Trail": [] },
  "New Asia": { "Ramza 100cc": [] },
  "OVERDRIVE": { "Hyusong GV650 Pro": [] },
  "OW": {
    "Ducatin 400cc": [], "Jupiter Scooter 150cc": [],
    "Ninja 250cc": [], "Ninja 400cc": [],
  },
  "Pak Hero": { "PK125": [] },
  "Pakzon Electric": { "PE-70G": [] },
  "Power": { "PK 70": [] },
  "QINGQI": { "Electric bike sporty": [] },
  "QJ Motor": { "QJ250": [], "SRC250 Turismo": [], "SRT550X": [] },
  "Ravi": { "Humsafar 70": [], "Humsafar Plus": [] },
  "Razy Motors": { "SR 70": [] },
  "Road Prince": {
    "100": ["Power Plus"], "110": ["Jack Pot", "Power Plus"],
    "125": [], "150": ["Wego", "Robinson"], "250": [],
    "70": ["Passion Plus"], "Classic 70": [], "RP 70": [], "RX3": [],
  },
  "Safari": { "SD 70": [] },
  "Shelby": { "CAFE RACER 200": [], "R5V 350cc": [], "V7 250": [] },
  "Sigma": { "CLASSIC 200CC": [], "Valentino 250": [], "Valentino 350": [] },
  "Super Asia": { "SA 70": [] },
  "Super Power": {
    "Deluxe 70": [], "Leo 200": [], "PK 150 Archi": [],
    "SP 110 Cheetah": [], "SP 150 Archi": [],
    "SP 70": ["Premium 70", "Tokyo"], "Sultan SP 250": [],
  },
  "Super Speed": { "70 cc": [] },
  "Super Star": {
    "100 cc": ["Deluxe"], "200R": [],
    "CD 70": ["Plus", "SE"], "EV-1500W": [],
    "Falcon 150 cc": [], "Scooty EV": [],
  },
  "Suzuki": {
    "100": [], "DR650SE": [], "GD 110": ["S"], "GR 150": [],
    "GS 150": ["SE"], "GS-125": [], "GSX 125": [],
    "GSX-R1000": [], "GSX-R600": [], "GSX-R750": [],
    "Gixxer 150": [], "Gsxr 250cc": [], "Hayabusa": [],
    "Inazuma": ["Aegis"], "Let's 5": [],
    "V-Strom 650": ["ABS", "XT", "XT Adventure"],
  },
  "Taro": {
    "C6 250SR": [], "GP 2": [], "GP One 380cc": [],
    "GP1 250 SR": [], "GP1 400R": [],
  },
  "Toyo": { "70cc": [] },
  "Treet": { "EURO II TR 70": [] },
  "U.M": { "COMMANDO": [] },
  "Union Star": { "70 Deluxe": [], "US 70cc": [] },
  "Unique": {
    "Crazer UD-150": [], "UD 100": [], "UD 125": [],
    "UD 70": [], "Xtreme UD 70": [],
  },
  "United": {
    "US 100": [], "US 125": ["Deluxe", "Euro II"],
    "US 150": ["Ultimate Thrill"], "US 70": [], "US Scooty 100": [],
  },
  "United Auto and Motorsports": { "Valentino 250cc": [] },
  "Vlektra": { "Bolt": [] },
  "YJ Future": { "Azadi Pro": [], "Cruise Z9": [], "Twister": [] },
  "Yadea": {
    "Epoc-H": [], "G5": [], "GT30": [], "Ruibin": [],
    "T5": [], "T5L": [],
  },
  "Yamaha": {
    "ATV Blaster": [], "Dhoom YD-70": [], "FZ1": [], "FZR 400": [],
    "RX 115": [], "Tenere 700": ["World Raid"],
    "YB 125Z": ["DX"], "YBR 125": ["G"],
    "YZ125": [], "YZF-R1": [], "YZF-R3": [], "YZF-R6": [], "YZF-R6S": [],
  },
  "ZXMCO": {
    "KPR 200 Cruise": [], "Monster ZX 250-D": [], "ZX 70 City Rider": [],
  },
  "Zhongfa EV": { "ZF G-1": [] },
  "Zongshen": { "200": [], "300": [], "H6": [], "RX1": [] },
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const brandsCol = db.collection('vehicle_brands');
  const modelsCol = db.collection('vehicle_models');
  const variantsCol = db.collection('vehicle_variants');
  const categoriesCol = db.collection('categories');

  // Find the "Bikes" category dynamically
  const bikesCategory = await categoriesCol.findOne({
    name: { $regex: /^bikes$/i },
  });

  if (!bikesCategory) {
    console.error('❌ "Bikes" category not found. Please create it first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const CATEGORY_ID = bikesCategory._id;
  console.log(`📂 Using category: ${bikesCategory.name} (${CATEGORY_ID})`);

  const stats = { brands: 0, models: 0, variants: 0, skipped: 0 };

  for (const [brandName, models] of Object.entries(BIKES_DATA)) {
    let brand = await brandsCol.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(brandName)}$`, 'i') },
      categoryId: CATEGORY_ID,
    });

    if (!brand) {
      const result = await brandsCol.insertOne({
        name: brandName,
        categoryId: CATEGORY_ID,
        vehicleType: 'motorcycle',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      brand = { _id: result.insertedId, name: brandName };
      stats.brands++;
    }

    const brandId = brand._id;

    for (const [modelName, variantsList] of Object.entries(models)) {
      let model = await modelsCol.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(modelName)}$`, 'i') },
        brandId: brandId,
      });

      if (!model) {
        const result = await modelsCol.insertOne({
          name: modelName,
          brandId: brandId,
          categoryId: CATEGORY_ID,
          vehicleType: 'motorcycle',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        model = { _id: result.insertedId, name: modelName };
        stats.models++;
      } else {
        stats.skipped++;
      }

      const modelId = model._id;

      for (const variantName of variantsList) {
        const exists = await variantsCol.findOne({
          name: { $regex: new RegExp(`^${escapeRegex(variantName)}$`, 'i') },
          modelId: modelId,
        });

        if (!exists) {
          await variantsCol.insertOne({
            name: variantName,
            modelId: modelId,
            brandId: brandId,
            categoryId: CATEGORY_ID,
            vehicleType: 'motorcycle',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          stats.variants++;
        } else {
          stats.skipped++;
        }
      }
    }
  }

  console.log(`\n✅ Bikes seed complete:`);
  console.log(`   Brands:   ${stats.brands} added`);
  console.log(`   Models:   ${stats.models} added`);
  console.log(`   Variants: ${stats.variants} added`);
  console.log(`   Skipped:  ${stats.skipped} duplicates`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
