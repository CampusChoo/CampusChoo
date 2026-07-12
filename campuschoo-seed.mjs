/**
 * campuschoo-seed.js
 *
 * Seeds the Supabase database by calling the /api/seed endpoint in the deployed
 * Edge Function. This uses the service_role key (set as SEED_KEY env var).
 *
 * REQUIREMENTS:
 *   1. Deploy updated supra functions with the /api/seed route
 *   2. Set SEED_KEY in the Edge Function environment
 *      supabase secrets set SEED_KEY=campuschoo-2026 --project-ref fyvgxajqpuyrjxouyztr
 *   3. Run: node campuschoo-seed.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(files) {
  const result = {};
  for (const f of files) {
    const fp = path.resolve(f);
    if (!fs.existsSync(fp)) continue;
    for (const raw of fs.readFileSync(fp, 'utf-8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      result[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return result;
}

const envRoot    = loadEnv(['.env', '../.env', '../../.env']);
const envClient  = loadEnv(['client/.env', '../client/.env']);
const API_URL    = envClient.VITE_API_URL || envRoot.VITE_API_URL;
const ARG_KEY    = process.argv.find(a => a.startsWith('--key='))?.split('=')[1];

if (!API_URL) {
  console.error('ERROR: VITE_API_URL not found. Set it in client/.env or root .env.');
  process.exit(1);
}

// Try explicit arg key first, then .env SEED_KEY, then a default
const SEED_KEY = ARG_KEY || envRoot.SEED_KEY || 'campuschoo-2026';

// Base URLs in /food/ — all files must exist in client/public/food/
const FOOD_IMAGES = {
  kenkey:    '/food/kenkey.webp',
  jollof:    '/food/jollof.jpg',
  fufu:      '/food/fufu.jpg',
  fufuSoup:  '/food/fufu-soup.webp',
  banku:     '/food/banku-tilapia.webp',
  gob3:      '/food/gob3.webp',
  waakye:    '/food/waakye.webp',
  waakyePkg: '/food/waakye-package.webp',
  fish:      '/food/fish.webp',
  rice:      '/food/jollof.jpg',
  friedRice: '/food/fried-rice.webp',
  okro:      '/food/okro-soup.webp',
  indomie:   '/food/indomie.webp',
  spaghetti: '/food/spaghetti.webp',
  egg:       '/food/egg.webp',
  sausage:   '/food/sausage.webp',
  chicken:   '/food/chicken.webp',
  beef:      '/food/beef.webp',
  wele:      '/food/beef.webp',
  yam:       '/food/fried-yam.webp',
  shrimp:    '/food/fish.webp',
  tz:        '/food/tz.webp',
  emoTuo:    '/food/emo-tuo.webp',
  plantain:  '/food/plantain.webp',
  pear:      '/food/pear.webp',
  goat:      '/food/goat.webp',
  iceCream:  '/food/OIP (2).webp',
  shawarma:  '/food/shawarma.webp',
  plainRice: '/food/plain-rice.webp',
  soups:     '/food/okro-soup.webp',
};

const FOOD_RULES = [
  [/kenkey/i,                                        FOOD_IMAGES.kenkey],
  [/jollof/i,                                        FOOD_IMAGES.jollof],
  [/fufu/i,                                          FOOD_IMAGES.fufu],
  [/emo.?tuo|emo-tuo/i,                              FOOD_IMAGES.emoTuo],
  [/banku/i,                                         FOOD_IMAGES.banku],
  [/gob3/i,                                          FOOD_IMAGES.gob3],
  [/waakye/i,                                        FOOD_IMAGES.waakye],
  [/waakye.?package|waakye.?pkg/i,                   FOOD_IMAGES.waakyePkg],
  [/tilapia/i,                                       FOOD_IMAGES.banku],
  [/chek.?chek/i,                                    FOOD_IMAGES.friedRice],
  [/fried.?rice|rice.*?(pkg|package|assorted)/i,     FOOD_IMAGES.friedRice],
  [/rice\b/,                                         FOOD_IMAGES.rice],
  [/okro/i,                                          FOOD_IMAGES.okro],
  [/palmnut|groundnut|light.?soup|ayoyo/i,          FOOD_IMAGES.soups],
  [/indomie/i,                                       FOOD_IMAGES.indomie],
  [/spagh|spag/i,                                    FOOD_IMAGES.spaghetti],
  [/shrimp/i,                                        FOOD_IMAGES.shrimp],
  [/egg/i,                                           FOOD_IMAGES.egg],
  [/sausage/i,                                       FOOD_IMAGES.sausage],
  [/chicken|wing/i,                                  FOOD_IMAGES.chicken],
  [/fish/i,                                          FOOD_IMAGES.fish],
  [/beef/i,                                          FOOD_IMAGES.beef],
  [/wele/i,                                          FOOD_IMAGES.wele],
  [/towel/i,                                         FOOD_IMAGES.beef],
  [/yam/i,                                           FOOD_IMAGES.yam],
  [/goat/i,                                          FOOD_IMAGES.goat],
  [/ice.?cream/i,                                    FOOD_IMAGES.iceCream],
  [/shaww?arma/i,                                    FOOD_IMAGES.shawarma],
  [/plantain/i,                                      FOOD_IMAGES.plantain],
  [/pear|paw/i,                                      FOOD_IMAGES.pear],
  [/tz|tuo.?zaafi|kokonte/i,                       FOOD_IMAGES.tz],
  [/plain.?rice/i,                                   FOOD_IMAGES.plainRice],
  [/default/,                                        FOOD_IMAGES.jollof],
];

function coverImg(cat, name, fallback) {
  const lc = `${cat} ${name}`.toLowerCase();
  for (const [rx, url] of FOOD_RULES) {
    if (rx.test(lc)) return url;
  }
  return fallback;
}

function apiRequest(method, pathStr, body) {
  const url = new URL(pathStr, API_URL);
  const bodyStr = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString()); } catch { parsed = null; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function seedData() {
  console.log('\n🌱  Seeding CampusChoo with Excel data...\n');

  let res = await apiRequest('POST', '/api/seed', { key: SEED_KEY });

  if (res.status === 403) {
    console.log('  ⚠  Got 403 — trying common fallback key "campuschoo-2026"...');
    res = await apiRequest('POST', '/api/seed', { key: 'campuschoo-2026' });
  }

  if (res.status >= 400 || !res.data?.ok) {
    console.error(`  ✗  Seed failed (${res.status}):`, res.data?.message || res.data?.error || 'Unknown');
    console.log('\n  ─── ACTION REQUIRED ───');
    console.log('  1. Go to Supabase Dashboard → Edge Functions → api → Settings');
    console.log('  2. Add env var:  SEED_KEY = campuschoo-2026');
    console.log('  3. Redeploy, then run this script again.');
    console.log('\n  ALTERNATIVE: Paste the SQL from supabase/migrations/20260710000000_seed_choo_data.sql');
    console.log('  into the Supabase SQL Editor.');
    return false;
  }

  console.log(`  ✅  Data seeded!\n`);
  if (res.data?.seeded) {
    for (const [name, info] of Object.entries(res.data.seeded)) {
      console.log(`    📍  ${name}  (${info.inserted} products)`);
    }
  }
  return true;
}

async function seedCategories() {
  console.log('\n📂  Seeding food category metadata...\n');
  const res = await apiRequest('POST', '/api/seed/categories', { key: SEED_KEY });

  if (res.status === 403) {
    res = await apiRequest('POST', '/api/seed/categories', { key: 'campuschoo-2026' });
  }

  if (res.status >= 400 || !res.data?.ok) {
    console.error(`  ✗  Category seed failed (${res.status}):`, res.data?.message);
    return false;
  }
  console.log(`  ✅  Categories seeded!\n`);
  if (res.data?.categories) {
    for (const [cat, r] of Object.entries(res.data.categories)) {
      console.log(`    🏷  ${cat}: ${r}`);
    }
  }
  return true;
}

async function main() {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║        CampusChoo Data Seeder            ║
  ║  CAMPUS CHOO PRICE.xlsx → Supabase DB   ║
  ╚══════════════════════════════════════════╝
  `);
  const ok1 = await seedData();
  const ok2 = await seedCategories();
  console.log('\n' + '═'.repeat(50));
  if (ok1 && ok2) {
    console.log('  ✅  Done! Start the dev server and visit /vendors to see all vendors.');
  } else {
    console.log('  ⚠️  Partial seed. See errors above.');
    process.exitCode = 1;
  }
  console.log('═'.repeat(50) + '\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
