'use strict';
/**
 * Test environment wiring: API key and live entity ids.
 *
 * The API key is read from backend/.env and never logged. Ids are resolved
 * from MongoDB at run time so scenarios exercise real documents; a scenario
 * pointing at a missing id would return 404 fast and flatter the results.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BACKEND_DIR = path.resolve(__dirname, '../../backend');

function readApiKey() {
  const envPath = path.join(BACKEND_DIR, '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  const line = txt.split('\n').find((l) => /^API_KEY\s*=/.test(l));
  if (!line) return null;
  let v = line.slice(line.indexOf('=') + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v || null;
}

function resolveIds() {
  const script = `
    const out = {};
    const l = db.product_listings.findOne({ status: 'active' }, { _id: 1, sellerId: 1 });
    out.LISTING_ID = l ? l._id.toString() : '';
    out.SELLER_ID = l && l.sellerId ? l.sellerId.toString() : '';
    const c3 = db.categories.findOne({ level: 3 });
    out.CAT_L3 = c3 ? c3._id.toString() : '';
    // Category that actually holds active listings, so facet aggregation and
    // the inherited-attribute chain run against a non-empty result set.
    const busiest = db.product_listings.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$categoryId', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ]).toArray()[0];
    out.CAT_BUSY = busiest ? busiest._id.toString() : '';
    const c1 = db.categories.findOne({ level: 1 });
    out.CAT_L1 = c1 ? c1._id.toString() : '';
    const s = db.short_videos.findOne({ status: 'active' }, { _id: 1 });
    out.SHORT_ID = s ? s._id.toString() : '';
    const p = db.provinces.findOne({}, { _id: 1 });
    out.PROVINCE_ID = p ? p._id.toString() : '';
    const ct = db.cities.findOne({}, { _id: 1 });
    out.CITY_ID = ct ? ct._id.toString() : '';
    print(JSON.stringify(out));
  `;
  const raw = execFileSync(
    'docker',
    ['exec', 'personal-mongodb-1', 'mongosh', 'marketplace', '--quiet', '--eval', script],
    { encoding: 'utf8' },
  );
  const line = raw.trim().split('\n').filter(Boolean).pop();
  return JSON.parse(line);
}

module.exports = { readApiKey, resolveIds, BACKEND_DIR };
