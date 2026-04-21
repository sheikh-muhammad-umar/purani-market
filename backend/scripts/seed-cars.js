/**
 * Seed car brands, models, and variants.
 * Looks up the "Cars" category dynamically from the categories collection.
 *
 * Usage: node scripts/seed-cars.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

// ── Full cars dataset: Brand → Model → Variants ──
const CARS_DATA = {
  "Adam": { "Revo": [] },
  "Audi": {
    "A3": [], "A4": [{ "variant": "S-Line" }], "A5": [], "A6": [],
    "A6 e-tron": [], "A7": [], "A8": [], "Q2": [], "Q3": [],
    "Q4 e-tron": [], "Q5": [], "Q6 e-tron": [], "Q7": [], "Q8": [],
    "Q8 e-tron": [], "S5": [], "TT": [],
    "e-tron": [{ "variant": "quattro" }], "e-tron GT": [],
  },
  "BAIC": { "BJ40": [], "BJ40 Plus": [], "BJ80": [] },
  "BMW": {
    "1 Series": [], "2 Series": [], "3 Series": [], "4 Series": [],
    "5 Series": [], "6 Series": [], "7 Series": [], "M Series": [],
    "M5": [], "X1": [], "X2": [], "X3": [], "X4": [], "X5": [],
    "Z3": [], "i4": [], "i5": [], "i8": [], "iX": [], "iX1": [], "iX3": [],
  },
  "BYD": { "Atto 2": [], "Atto 3": [], "Seal": [], "Sealion 7": [], "Shark 6": [] },
  "Bentley": { "Continental Gt": [], "Flying Spur": [] },
  "Bugatti": { "Chiron": [] },
  "Buick": { "Electra": [], "Riviera": [] },
  "Cadillac": { "Escalade": [{ "variant": "Ext" }] },
  "Changan": {
    "Alsvin": [
      { "variant": "1.3L MT Comfort" }, { "variant": "1.5L DCT Comfort" },
      { "variant": "1.5L DCT Lumiere" }, { "variant": "Black Edition" },
    ],
    "CS95": [], "CX70T": [], "Gilgit": [], "Kaghan XL": [], "Kalam": [],
    "Kalash": [],
    "Karvaan": [
      { "variant": "Base Model 1.0" }, { "variant": "Comfort" },
      { "variant": "Plus" }, { "variant": "Plus 1.2" },
    ],
    "M8": [], "M9": [],
    "Oshan X7": [
      { "variant": "Comfort" }, { "variant": "FutureSense" },
      { "variant": "FutureSense 7 Seat" },
    ],
    "Shahanshah": [], "UNI-T": [],
  },
  "Chery": {
    "Omoda": [], "QQ": [], "Tiggo 4 Pro": [], "Tiggo 7 Pro": [],
    "Tiggo 8": [], "Tiggo 8 Pro": [], "Tiggo 9": [],
  },
  "Chevrolet": {
    "Aveo": [], "Caprice": [], "Colorado": [], "Corvette": [],
    "Exclusive": [], "Joy": [], "Optra": [], "Silverado": [], "Spark": [],
  },
  "Chrysler": { "300 C": [] },
  "DFSK": { "C37": [], "Convoy": [], "Glory 500": [], "Glory 580": [] },
  "Daehan": { "Shehzore": [] },
  "Daewoo": { "Cielo": [], "Racer": [] },
  "Daihatsu": {
    "Atrai Wagon": [], "Be-go": [], "Bezza": [],
    "Boon": [{ "variant": "CL" }],
    "Cast": [{ "variant": "Activa" }, { "variant": "Style" }],
    "Charade": [], "Charmant": [], "Copen": [],
    "Cuore": [{ "variant": "CX" }],
    "Esse": [], "Feroza": [], "Hijet": [],
    "Mira": [{ "variant": "Custom" }, { "variant": "X" }],
    "Mira Cocoa": [], "Mira Gino": [],
    "Move": [{ "variant": "Custom" }],
    "Move Canbus": [], "Move Conte": [], "Move Latte": [], "Rocky": [],
    "Sirion": [], "Sonica": [], "Storia": [], "Taft": [],
    "Tanto": [{ "variant": "Custom" }],
    "Terios": [], "Terios Kid": [], "Thor": [], "Wake": [], "YRV": [],
  },
  "Datsun": { "1000": [], "120 Y": [], "1200": [], "Bluebird": [] },
  "Deepal": { "L07": [], "S05": [], "S07": [] },
  "Dodge": { "Dart": [], "Nitro": [], "Ram": [] },
  "Dongfeng": { "007": [], "Box": [], "VIGO": [] },
  "FAW": { "Carrier": [], "Senya R7": [], "Sirius": [], "V2": [], "X-PV": [] },
  "Fiat": { "Punto EVO": [], "Uno": [] },
  "Ford": {
    "Escort": [], "F 150": [], "F 150 Shelby": [], "Mustang": [],
    "Mustang Mach-E": [], "Ranger": [], "Transit": [],
  },
  "Forthing": { "Friday": [] },
  "GAC": { "GS3": [] },
  "GMC": { "Sierra": [] },
  "GUGO": { "GIGI": [], "Tourer": [] },
  "Genesis": { "GV60": [] },
  "Haval": {
    "H6": [
      { "variant": "1.5T" }, { "variant": "2.0T" },
      { "variant": "HEV" }, { "variant": "PHEV" },
    ],
    "Jolion": [
      { "variant": "1.5T" }, { "variant": "HEV" }, { "variant": "Top" },
    ],
  },
  "Hino": { "500 Series": [] },
  "Honda": {
    "Accord": [], "Acty": [], "Airwave": [],
    "BR-V": [{ "variant": "i-VTEC S" }],
    "Beat": [{ "variant": "PP1" }],
    "CR-V": [], "CR-Z": [],
    "City": [
      { "variant": "1.2L CVT" }, { "variant": "1.2L M/T" },
      { "variant": "1.5L ASPIRE CVT" }, { "variant": "1.5L ASPIRE M/T" },
      { "variant": "1.5L ASPIRE S CVT" }, { "variant": "1.5L CVT" },
    ],
    "Civic": [
      { "variant": "Oriel" }, { "variant": "RS" }, { "variant": "Standard" },
    ],
    "Cross Road": [], "Fit": [], "Fit Aria": [], "Freed": [],
    "Grace Hybrid": [],
    "HR-V": [
      { "variant": "e:HEV" }, { "variant": "VTi" }, { "variant": "VTi-S" },
    ],
    "Insight": [], "Inspire": [],
    "Integra": [
      { "variant": "RX" }, { "variant": "Type R" },
      { "variant": "Type S" }, { "variant": "ZX" },
    ],
    "Jade": [], "Life": [], "N-BOX": [], "N-ONE": [], "N-VAN": [],
    "N-WGN": [], "S660": [], "Spike": [], "Stream": [], "Thats": [],
    "Torneo": [], "Vamos": [], "Vezel": [], "Z": [], "Zest": [],
  },
  "Honri": { "Ve": [] },
  "Hummer": { "H2": [], "H3": [] },
  "Hyundai": {
    "Accent": [], "Azera": [],
    "Elantra": [{ "variant": "Hybrid" }],
    "Excel": [], "H-100": [], "Ioniq 5": [], "Ioniq 6": [], "Kona": [],
    "Santa Fe": [], "Santro": [], "Shehzore": [], "Sonata": [],
    "Staria": [], "Terracan": [],
    "Tucson": [
      { "variant": "Hybrid Signature" }, { "variant": "Hybrid Smart" },
    ],
    "i10": [],
  },
  "Isuzu": { "D-Max": [], "N-Series": [], "NKR": [], "Trooper": [] },
  "JAC": { "T6": [], "T9": [], "X200": [] },
  "JMEV": { "Elight": [] },
  "JW Forland": { "Bravo": [], "C-10": [], "Safari": [] },
  "Jaecoo": { "J5": [], "J6": [], "J7": [] },
  "Jaguar": { "I-Pace": [], "XF": [], "Xjs": [] },
  "Jeep": {
    "CJ 5": [], "Cherokee": [], "Gladiator": [],
    "M 151": [], "Wrangler": [],
  },
  "Jetour": { "Dashing": [], "X70 Plus": [] },
  "KIA": {
    "Carnival": [], "Cerato": [], "Ceres": [], "Classic": [], "EV5": [],
    "K5": [], "Niro": [],
    "Picanto": [{ "variant": "1.0 AT" }, { "variant": "1.0 MT" }],
    "Pride": [], "Rio": [], "Shehzore K2700": [],
    "Sorento": [
      { "variant": "1.6T HEV AWD" }, { "variant": "1.6T HEV FWD" },
      { "variant": "3.5 FWD" },
    ],
    "Spectra": [],
    "Sportage": [{ "variant": "Limited Edition" }],
    "Sportage L": [
      { "variant": "Alpha" }, { "variant": "FWD" }, { "variant": "HEV" },
    ],
    "Stonic": [{ "variant": "EX" }, { "variant": "EX+" }],
  },
  "Land Rover": { "Defender": [], "Discovery": [], "Freelander": [] },
  "Lexus": {
    "CT200h": [], "ES": [], "GS": [], "HS": [], "IS": [],
    "LS Series": [], "LX Series": [], "Nx": [], "RX Series": [],
    "Sc": [], "UX": [],
  },
  "MG": {
    "3": [], "4": [], "5 EV": [], "Cyberster": [],
    "HS": [{ "variant": "PHEV" }, { "variant": "Trophy" }],
    "RX-8": [], "U9": [], "ZS": [],
    "ZS EV": [
      { "variant": "MCE Essence" }, { "variant": "MCE Long Range" },
    ],
  },
  "MINI": { "Cooper": [] },
  "Master": { "Foton": [] },
  "Mazda": {
    "323": [], "626": [], "808": [], "AZ Offroad": [], "Axela": [],
    "B2200": [], "CX-3": [], "CX-7": [], "Carol": [], "Demio": [],
    "Flair": [], "Flair Crossover": [], "Flair Wagon": [],
    "MX-5": [{ "variant": "GT Sport Tech" }],
    "RX-7": [{ "variant": "FC3S" }, { "variant": "Spirit R" }],
    "RX-8": [
      { "variant": "Base Grade" },
      { "variant": "Rotary Engine 40TH Anniversary" },
      { "variant": "Type E" },
      { "variant": "Type E Sport Prestige Limited II" },
      { "variant": "Type S" },
    ],
    "Scrum Van": [], "Scrum Wagon": [], "Titan": [],
  },
  "Mercedes-Benz": {
    "A Class": [], "B Class": [],
    "C Class": [{ "variant": "C180" }, { "variant": "C250" }],
    "C Class Cabriolet": [], "C Class Coupe": [], "CLA Class": [],
    "CLK Class": [], "CLS Class": [],
    "E Class": [
      { "variant": "E200" }, { "variant": "E250" },
      { "variant": "E300" }, { "variant": "E350" },
    ],
    "E Class Cabriolet": [], "E Class Coupe": [], "E Class Estate": [],
    "EQA": [], "EQB": [], "EQC": [], "EQE": [], "EQS": [],
    "G Class": [], "GLA Class": [], "GLB Class": [], "M Class": [],
    "R Class": [],
    "S Class": [{ "variant": "S400" }, { "variant": "S500" }],
    "SLK Class": [], "Sl Class": [], "Smart Fortwo": [],
    "Sprinter": [], "Vito": [],
  },
  "Mitsubishi": {
    "3000GT": [], "Delica Mini": [], "Galant": [], "L200": [], "L300": [],
    "Lancer": [{ "variant": "GLX" }],
    "Lancer Evolution X": [
      { "variant": "GSR" }, { "variant": "GSR-Premium" },
    ],
    "Minica": [], "Minicab": [],
    "Mirage": [{ "variant": "G" }],
    "Pajero": [{ "variant": "Exceed" }, { "variant": "GLX" }],
    "Pajero Junior": [], "Pajero Mini": [], "RVR": [], "Toppo": [],
    "Town Box": [], "Triton": [],
    "eK Custom": [], "eK Wagon": [], "eK X": [], "i": [],
  },
  "Mushtaq": { "KY10": [] },
  "Nissan": {
    "350Z": [], "370Z": [], "AD Van": [], "Almera": [], "Ariya": [],
    "Blue Bird": [], "Bluebird Sylphy": [], "Caravan": [], "Cedric": [],
    "Cefiro": [], "Civilian": [], "Clipper": [], "Cube": [],
    "Dayz": [{ "variant": "Highway Star" }],
    "Dayz Roox": [], "Figaro": [],
    "GT-R": [
      { "variant": "Base Grade" }, { "variant": "Black Edition" },
      { "variant": "Premium Edition" }, { "variant": "Pure Edition" },
    ],
    "Infinity": [], "Juke": [], "Kicks": [], "Kix": [], "Leaf": [],
    "March": [], "Moco": [], "Murano": [], "NV350 Caravan": [],
    "Navara": [],
    "Note": [{ "variant": "Aura" }, { "variant": "e-Power" }],
    "Otti": [], "Pathfinder": [], "Patrol": [], "Pino": [], "Pulsar": [],
    "Qashqai": [], "Roox": [], "Safari": [], "Sakura": [], "Serena": [],
    "Silvia": [{ "variant": "Spec-R" }, { "variant": "Spec-S" }],
    "Skyline": [{ "variant": "350 GT Hybrid" }],
    "Sunny": [{ "variant": "EX" }, { "variant": "Super" }],
    "Terrano": [], "Tiida": [], "Wingroad": [], "X-Trail": [],
  },
  "ORA": { "03": [] },
  "Omoda": { "E5": [] },
  "Perodua": { "Kembara": [] },
  "Peugeot": { "2008": [], "206": [] },
  "Porsche": {
    "911": [{ "variant": "Carrera" }],
    "Cayenne": [{ "variant": "S" }],
    "Macan": [], "Panamera": [], "Taycan": [],
  },
  "Power": { "Mini Bus": [] },
  "Prince": { "K01": [], "K07": [], "Pearl": [] },
  "Proton": {
    "Gen 2": [],
    "Saga": [{ "variant": "R3" }],
    "X70": [],
  },
  "Range Rover": {
    "Autobiography": [], "Evoque": [], "Sport": [], "Vogue": [],
  },
  "Rinco": { "Aria": [] },
  "Seres": { "3": [] },
  "Sogo": { "Pickup": [] },
  "SsangYong": { "Rexton": [], "Stavic": [] },
  "Subaru": {
    "BRZ": [],
    "Forester": [{ "variant": "Premium" }],
    "Impreza": [{ "variant": "Sport" }],
    "Impreza Sports": [],
    "Justy": [],
    "Levorg": [{ "variant": "DIT" }],
    "Pleo": [{ "variant": "Custom" }],
    "Pleo Plus": [], "R2": [], "Sambar": [], "Stella": [],
  },
  "Suzuki": {
    "APV": [], "Aerio": [],
    "Alto": [
      { "variant": "E" }, { "variant": "VX" }, { "variant": "VXL AGS" },
      { "variant": "VXR" }, { "variant": "VXR AGS" },
    ],
    "Alto Lapin": [],
    "Baleno": [],
    "Bolan": [{ "variant": "VX" }],
    "Cappuccino": [], "Cervo": [], "Ciaz": [],
    "Cultus": [
      { "variant": "Auto Gear Shift" }, { "variant": "VXL" },
      { "variant": "VXLi" }, { "variant": "VXR" }, { "variant": "VXRi" },
    ],
    "Every": [{ "variant": "Join" }],
    "Every Wagon": [{ "variant": "PZ Turbo" }],
    "FX": [], "Hustler": [], "Ignis": [], "Jimny": [], "Kei": [],
    "Khyber": [], "Kizashi": [], "Landy": [],
    "Liana": [{ "variant": "Eminent" }, { "variant": "RXi" }],
    "Lj80": [], "MR Wagon": [], "Margalla": [], "Mega Carry Xtra": [],
    "Mehran": [{ "variant": "VX" }, { "variant": "VXR" }],
    "Palette": [], "Potohar": [], "Ravi": [], "Samurai": [], "Solio": [],
    "Spacia": [], "Splash": [],
    "Swift": [
      { "variant": "DLX" }, { "variant": "GL" },
      { "variant": "GL Manual" }, { "variant": "GLX CVT" },
    ],
    "Twin": [], "Vitara": [],
    "Wagon R": [
      { "variant": "AGS" }, { "variant": "FX" }, { "variant": "Stingray" },
      { "variant": "VX" }, { "variant": "VXL" },
    ],
    "XL7": [], "Xbee": [],
  },
  "Tank": { "500": [] },
  "Tesla": { "Model 3": [], "Model S": [], "Model X": [] },
  "Toyota": {
    "4Runner": [],
    "86": [{ "variant": "GR" }],
    "Allex": [], "Allion": [], "Alphard": [],
    "Aqua": [{ "variant": "G" }],
    "Aristo": [], "Auris": [], "Avanza": [], "Avensis": [], "Aygo": [],
    "Belta": [], "C+pod": [], "C-HR": [], "Caldina": [], "Cami": [],
    "Camry": [], "Carina": [],
    "Celica": [
      { "variant": "2-door convertible" }, { "variant": "2-door coupe" },
      { "variant": "3-door liftback" }, { "variant": "Convertible" },
      { "variant": "SS-II" },
    ],
    "Celsior": [], "Chaser": [], "Coaster": [],
    "Corolla": [
      { "variant": "2D" }, { "variant": "Altis" },
      { "variant": "Altis 1.6 X CVT-i" },
      { "variant": "Altis 1.6 X CVT-i Special Edition" },
      { "variant": "Altis Grande X CVT-i 1.8 Beige Interior" },
      { "variant": "Altis Grande X CVT-i 1.8 Black Interior" },
      { "variant": "Altis X" }, { "variant": "Altis X CVT-i 1.8" },
      { "variant": "Altis X Manual 1.6" }, { "variant": "GLi" },
      { "variant": "SE" }, { "variant": "SE Saloon" },
      { "variant": "X" }, { "variant": "XE" }, { "variant": "XLi" },
    ],
    "Corolla Axio": [{ "variant": "Luxel" }, { "variant": "X" }],
    "Corolla Cross": [
      { "variant": "1.8" }, { "variant": "1.8 HEV" },
      { "variant": "1.8 HEV X" }, { "variant": "1.8 X" },
    ],
    "Corolla Fielder": [{ "variant": "X" }],
    "Corolla Hatchback": [], "Corolla Touring": [], "Corona": [],
    "Cressida": [],
    "Crown": [
      { "variant": "Athlete" }, { "variant": "Royal" }, { "variant": "Super" },
    ],
    "Duet": [], "Esquire": [], "Estima": [], "FJ Cruiser": [],
    "Fortuner": [
      { "variant": "2.7 G" }, { "variant": "2.7 V" },
      { "variant": "2.8 Sigma 4" }, { "variant": "GR-S" },
      { "variant": "Legender" },
    ],
    "Harrier": [], "Hiace": [],
    "Hilux": [
      { "variant": "Champ" }, { "variant": "Double Cabin" },
      { "variant": "E" }, { "variant": "GR Sport 2.4D" },
      { "variant": "Revo" }, { "variant": "Revo G 2.8" },
      { "variant": "Revo G Automatic 2.8" }, { "variant": "Revo GR-S" },
      { "variant": "Revo Rocco" }, { "variant": "Revo V Automatic 2.8" },
      { "variant": "Single Cabin" }, { "variant": "Vigo" },
    ],
    "Isis": [], "Ist": [],
    "Land Cruiser": [
      { "variant": "AX" }, { "variant": "GX" }, { "variant": "V8" },
      { "variant": "VX" }, { "variant": "ZX" },
    ],
    "Levin": [{ "variant": "Coupe" }],
    "Lucida": [],
    "MR2": [{ "variant": "Spyder" }],
    "Mark II": [
      { "variant": "Grande" }, { "variant": "Grande 2.0" },
      { "variant": "Grande 2.5" },
    ],
    "Mark X": [{ "variant": "250G" }, { "variant": "300 G" }],
    "Noah": [],
    "Passo": [
      { "variant": "G" }, { "variant": "Hana" }, { "variant": "X" },
    ],
    "Pixis Epoch": [], "Pixis Joy": [], "Pixis Mega": [],
    "Pixis Space": [], "Platz": [], "Porte": [],
    "Prado": [
      { "variant": "RZ" }, { "variant": "TX" },
      { "variant": "TX Limited" }, { "variant": "TZ" }, { "variant": "VX" },
    ],
    "Premio": [
      { "variant": "F" }, { "variant": "G" }, { "variant": "X" },
    ],
    "Prius": [{ "variant": "G" }, { "variant": "G Touring" }],
    "Prius Alpha": [], "Probox": [], "Ractis": [], "Raize": [],
    "Rav4": [], "Roomy": [], "Rush": [], "Sai": [], "Sera": [],
    "Sienta": [], "Soarer": [], "Sprinter": [],
    "Starlet": [
      { "variant": "1.0" }, { "variant": "1.3" }, { "variant": "GT Turbo" },
    ],
    "Succeed": [],
    "Supra": [{ "variant": "3.0 Premium" }, { "variant": "Turbo" }],
    "Surf": [{ "variant": "SSR-G" }, { "variant": "SSR-X" }],
    "Tacoma": [], "Tank": [], "Tercel": [], "Town Ace": [], "Tundra": [],
    "Vanguard": [], "Verossa": [],
    "Vitz": [
      { "variant": "F" }, { "variant": "Jewela" },
      { "variant": "RS" }, { "variant": "U" },
    ],
    "Voxy": [], "Wish": [], "Yaris Cross": [], "Yaris Hatchback": [],
    "Yaris Sedan": [
      { "variant": "1.3" }, { "variant": "1.5" },
      { "variant": "AERO CVT 1.3" }, { "variant": "AERO CVT 1.5" },
      { "variant": "ATIV" }, { "variant": "ATIV CVT 1.3" },
      { "variant": "ATIV MT 1.3" }, { "variant": "ATIV X CVT 1.5" },
      { "variant": "ATIV X CVT 1.5 Beige Interior" },
      { "variant": "ATIV X CVT 1.5 Black Interior" },
      { "variant": "ATIV X MT 1.5" }, { "variant": "GLI CVT 1.3" },
      { "variant": "GLI MT 1.3" },
    ],
    "bZ4X": [], "iQ": [],
  },
  "United": { "Alpha": [], "Bravo": [] },
  "Vauxhall": { "Victor": [] },
  "Volkswagen": { "Beetle": [], "Up": [] },
  "Volvo": { "900 Series": [] },
  "Xpeng": { "G6": [] },
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

  // Find the "Cars" category dynamically
  const carsCategory = await categoriesCol.findOne({
    name: { $regex: /^cars$/i },
  });

  if (!carsCategory) {
    console.error('❌ "Cars" category not found. Please create it first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const CATEGORY_ID = carsCategory._id;
  console.log(`📂 Using category: ${carsCategory.name} (${CATEGORY_ID})`);

  const stats = { brands: 0, models: 0, variants: 0, skipped: 0 };

  for (const [brandName, models] of Object.entries(CARS_DATA)) {
    // ── Upsert brand ──
    let brand = await brandsCol.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(brandName)}$`, 'i') },
      categoryId: CATEGORY_ID,
    });

    if (!brand) {
      const result = await brandsCol.insertOne({
        name: brandName,
        categoryId: CATEGORY_ID,
        vehicleType: 'car',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      brand = { _id: result.insertedId, name: brandName };
      stats.brands++;
    }

    const brandId = brand._id;

    for (const [modelName, variantsList] of Object.entries(models)) {
      // ── Upsert model ──
      let model = await modelsCol.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(modelName)}$`, 'i') },
        brandId: brandId,
      });

      if (!model) {
        const result = await modelsCol.insertOne({
          name: modelName,
          brandId: brandId,
          categoryId: CATEGORY_ID,
          vehicleType: 'car',
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

      // ── Upsert variants ──
      for (const v of variantsList) {
        const variantName = v.variant;
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
            vehicleType: 'car',
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

  console.log(`\n✅ Cars seed complete:`);
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
