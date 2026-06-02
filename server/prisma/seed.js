// Seeds vendors + menu items from the CAMPUS CHOO PRICE.xlsx survey.
// Run: cd server && node prisma/seed.js
//
// Idempotent: re-running upserts users/vendors and replaces the vendor's
// menu items wholesale, so the final state always matches the data below.
//
// All seeded vendors share the same password (VENDOR_PASSWORD) so the team
// can sign in as any of them during testing.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const VENDOR_PASSWORD = 'vendor1234';
const DEFAULT_LOCATION = 'UMaT Campus, Tarkwa';

// Match dish names to images already copied into client/public/food/.
// Returns the public URL (Vite serves /food/* from client/public/food/).
function imageFor(name) {
  const n = name.toLowerCase();
  if (n.includes('tilapia'))                                    return '/food/banku-tilapia.jpg';
  if (n.includes('jollof'))                                     return '/food/jollof.jpg';
  if (n.includes('waakye'))                                     return '/food/waakye.webp';
  if (n.includes('fufu'))                                       return '/food/fufu.jpg';
  if (n.includes('gob3'))                                       return '/food/gob3.webp';
  return null;
}

// Pull the first numeric value out of price strings like "GHC 5", "GHC 10 and 15",
// "GHC 5,7and 10", "GHC4", "GHC 30-70". "FREE"/empty → 0.
function parsePrice(raw) {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (/free/i.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

// ── Seed data straight from the Excel (CAMPUS CHOO PRICE.xlsx) ──────────────
//
// Each vendor groups its items by category. `items` is an array of
// { category, name, price } tuples — the price string is parsed to a number
// at insert time, so it stays human-readable here.

const VENDORS = [
  {
    storeName: "Jumor Kings",
    phone: '0242925350',
    hours: '7:00am – 9:00pm',
    description: 'A bustling all-day kitchen — kenkey, waakye, jollof, gob3, fufu and banku, with the full set of toppings on every dish.',
    cuisine: ['Local', 'Kenkey', 'Waakye', 'Jollof', 'Gob3', 'Fufu & Banku'],
    items: [
      // KENKEY
      { category: 'Kenkey', name: 'Kenkey',  price: 'GHC 5' },
      { category: 'Kenkey', name: 'Fish',    price: 'GHC 10' },
      { category: 'Kenkey', name: 'Chicken', price: 'GHC 10' },
      { category: 'Kenkey', name: 'Egg',     price: 'GHC 3.50' },
      { category: 'Kenkey', name: 'Sausage', price: 'GHC 5' },
      { category: 'Kenkey', name: 'Okro',    price: 'GHC 5' },
      { category: 'Kenkey', name: 'Wele',    price: 'GHC 5' },
      { category: 'Kenkey', name: 'Beef',    price: 'GHC 5' },
      // WAAKYE
      { category: 'Waakye', name: 'Waakye Rice', price: 'GHC 10' },
      { category: 'Waakye', name: 'Fish',        price: 'GHC 10' },
      { category: 'Waakye', name: 'Chicken',     price: 'GHC 10' },
      { category: 'Waakye', name: 'Egg',         price: 'GHC 3.50' },
      { category: 'Waakye', name: 'Sausage',     price: 'GHC 5' },
      { category: 'Waakye', name: 'Wele (Towel)', price: 'GHC 5' },
      { category: 'Waakye', name: 'Salad',       price: 'GHC 1' },
      { category: 'Waakye', name: 'Macaroni',    price: 'GHC 1' },
      { category: 'Waakye', name: 'Gari',        price: 'GHC 1' },
      { category: 'Waakye', name: 'Plantain',    price: 'GHC 1' },
      // GOB3
      { category: 'Gob3', name: 'Gob3',       price: 'GHC 5' },
      { category: 'Gob3', name: 'Plantain',   price: 'GHC 1' },
      { category: 'Gob3', name: 'Plain Rice', price: 'GHC 5' },
      // JOLLOF
      { category: 'Jollof', name: 'Jollof Rice', price: 'GHC 10' },
      { category: 'Jollof', name: 'Fish',        price: 'GHC 10' },
      { category: 'Jollof', name: 'Chicken',     price: 'GHC 10' },
      { category: 'Jollof', name: 'Egg',         price: 'GHC 3.50' },
      { category: 'Jollof', name: 'Sausage',     price: 'GHC 5' },
      { category: 'Jollof', name: 'Wele (Towel)', price: 'GHC 5' },
      { category: 'Jollof', name: 'Salad',       price: 'GHC 1' },
      { category: 'Jollof', name: 'Macaroni',    price: 'GHC 1' },
      { category: 'Jollof', name: 'Gari',        price: 'GHC 1' },
      { category: 'Jollof', name: 'Plantain',    price: 'GHC 1' },
      // FUFU / BANKU / AB3TSI3 / EMO TUO
      { category: 'Fufu & Banku', name: 'Fufu',          price: 'GHC 5' },
      { category: 'Fufu & Banku', name: 'Banku',         price: 'GHC 5' },
      { category: 'Fufu & Banku', name: 'Ab3tsi3',       price: 'GHC 5' },
      { category: 'Fufu & Banku', name: 'Emo Tuo',       price: 'GHC 5' },
      { category: 'Fufu & Banku', name: 'Light Soup',    price: 'Free' },
      { category: 'Fufu & Banku', name: 'Palmnut Soup',  price: 'Free' },
      { category: 'Fufu & Banku', name: 'Groundnut Soup', price: 'Free' },
      { category: 'Fufu & Banku', name: 'Okro Soup',     price: 'GHC 5' },
      { category: 'Fufu & Banku', name: 'Fish',          price: 'GHC 10' },
      { category: 'Fufu & Banku', name: 'Chicken',       price: 'GHC 10' },
      { category: 'Fufu & Banku', name: 'Goat',          price: 'GHC 15' },
      { category: 'Fufu & Banku', name: 'Wele (Towel)',  price: 'GHC 5' },
    ],
  },

  {
    storeName: "Antie Ama's Gob3",
    phone: '0248448793',
    hours: '7:00am – 4:00pm',
    description: 'Specialty gob3 stall — generous beans, plantain and rice combos with all the toppings.',
    cuisine: ['Gob3', 'Local'],
    items: [
      { category: 'Gob3', name: 'Gob3',       price: 'GHC 6' },
      { category: 'Gob3', name: 'Plain Rice', price: 'GHC 5' },
      { category: 'Gob3', name: 'Plantain',   price: 'GHC 1' },
      { category: 'Gob3', name: 'Sausage',    price: 'GHC 6' },
      { category: 'Gob3', name: 'Egg',        price: 'GHC 4' },
      { category: 'Gob3', name: 'Pear',       price: 'GHC 4' },
    ],
  },

  {
    storeName: 'Fastmah',
    phone: '0543499282',
    hours: '7:30am – 6:00pm',
    description: 'A favourite for waakye, gob3, jollof and TZ/kokonte/banku with soup — flexible portions to suit any budget.',
    cuisine: ['Waakye', 'Gob3', 'Jollof', 'TZ', 'Kokonte', 'Banku'],
    items: [
      // WAAKYE
      { category: 'Waakye', name: 'Waakye Rice', price: 'GHC 8' },
      { category: 'Waakye', name: 'Fish',        price: 'GHC 5' },
      { category: 'Waakye', name: 'Chicken',     price: 'GHC 10' },
      { category: 'Waakye', name: 'Egg',         price: 'GHC 4' },
      { category: 'Waakye', name: 'Sausage',     price: 'GHC 4' },
      { category: 'Waakye', name: 'Wele (Towel)', price: 'GHC 5' },
      { category: 'Waakye', name: 'Salad, Gari & Macaroni', price: 'GHC 5' },
      { category: 'Waakye', name: 'Plantain',    price: 'GHC 1' },
      // GOB3
      { category: 'Gob3', name: 'Gob3',       price: 'GHC 8' },
      { category: 'Gob3', name: 'Plain Rice', price: 'GHC 8' },
      { category: 'Gob3', name: 'Plantain',   price: 'GHC 1' },
      { category: 'Gob3', name: 'Sausage',    price: 'GHC 4' },
      { category: 'Gob3', name: 'Egg',        price: 'GHC 4' },
      // JOLLOF
      { category: 'Jollof', name: 'Jollof Rice', price: 'GHC 10' },
      { category: 'Jollof', name: 'Jollof Pack', price: 'GHC 30' },
      { category: 'Jollof', name: 'Fish',        price: 'GHC 5' },
      { category: 'Jollof', name: 'Chicken',     price: 'GHC 10' },
      { category: 'Jollof', name: 'Egg',         price: 'GHC 4' },
      { category: 'Jollof', name: 'Sausage',     price: 'GHC 4' },
      // TZ / KOKONTE / BANKU
      { category: 'TZ & Kokonte', name: 'TZ',             price: 'GHC 5' },
      { category: 'TZ & Kokonte', name: 'Banku',          price: 'GHC 5' },
      { category: 'TZ & Kokonte', name: 'Kokonte',        price: 'GHC 5' },
      { category: 'TZ & Kokonte', name: 'Groundnut Soup', price: 'Free' },
      { category: 'TZ & Kokonte', name: 'Palmnut Soup',   price: 'Free' },
      { category: 'TZ & Kokonte', name: 'Aw3r3 Soup',     price: 'Free' },
      { category: 'TZ & Kokonte', name: 'Fish',           price: 'GHC 5' },
      { category: 'TZ & Kokonte', name: 'Chicken',        price: 'GHC 10' },
      { category: 'TZ & Kokonte', name: 'Egg',            price: 'GHC 4' },
      { category: 'TZ & Kokonte', name: 'Sausage',        price: 'GHC 4' },
      { category: 'TZ & Kokonte', name: 'Wele (Towel)',   price: 'GHC 5' },
    ],
  },

  {
    storeName: 'Makarios Restaurant',
    phone: '0246553515',
    hours: '9:30am – 10:00pm',
    description: 'Sit-down restaurant favourites — fried rice, jollof, banku & tilapia, and proper shawarma.',
    cuisine: ['Continental', 'Local', 'Shawarma'],
    items: [
      { category: 'Mains', name: 'Fried Rice',        price: 'GHC 35' },
      { category: 'Mains', name: 'Jollof Rice',       price: 'GHC 35' },
      { category: 'Mains', name: 'Banku and Tilapia', price: 'GHC 40' },
      { category: 'Mains', name: 'Shawarma',          price: 'GHC 40' },
    ],
  },

  {
    storeName: "Catherine's Kitchen",
    phone: '0535699440',
    hours: '8:30am – 1:00am',
    description: 'Late-night spot — kenkey, oily rice with fried yam, and kokonte/banku with soup deep into the night.',
    cuisine: ['Kenkey', 'Oily Rice', 'Fried Yam', 'Kokonte', 'Banku'],
    items: [
      // KENKEY
      { category: 'Kenkey', name: 'Kenkey',  price: 'GHC 5' },
      { category: 'Kenkey', name: 'Fish',    price: 'GHC 10' },
      { category: 'Kenkey', name: 'Shrimps', price: 'GHC 10' },
      { category: 'Kenkey', name: 'Egg',     price: 'GHC 5' },
      { category: 'Kenkey', name: 'Sausage', price: 'GHC 5' },
      { category: 'Kenkey', name: 'Okro',    price: 'GHC 5' },
      { category: 'Kenkey', name: 'Wele',    price: 'GHC 5' },
      { category: 'Kenkey', name: 'Beef',    price: 'GHC 5' },
      // OILY RICE / FRIED YAM
      { category: 'Oily Rice & Fried Yam', name: 'Oily Rice', price: 'GHC 10' },
      { category: 'Oily Rice & Fried Yam', name: 'Fried Yam', price: 'GHC 1' },
      { category: 'Oily Rice & Fried Yam', name: 'Fish',      price: 'GHC 10' },
      { category: 'Oily Rice & Fried Yam', name: 'Shrimps',   price: 'GHC 10' },
      { category: 'Oily Rice & Fried Yam', name: 'Egg',       price: 'GHC 5' },
      { category: 'Oily Rice & Fried Yam', name: 'Sausage',   price: 'GHC 5' },
      // KOKONTE / BANKU
      { category: 'Kokonte & Banku', name: 'Banku',          price: 'GHC 5' },
      { category: 'Kokonte & Banku', name: 'Kokonte',        price: 'GHC 5' },
      { category: 'Kokonte & Banku', name: 'Groundnut Soup', price: 'Free' },
      { category: 'Kokonte & Banku', name: 'Light Soup',     price: 'Free' },
      { category: 'Kokonte & Banku', name: 'Kotodwe',        price: 'GHC 10' },
      { category: 'Kokonte & Banku', name: 'Beef',           price: 'GHC 5' },
      { category: 'Kokonte & Banku', name: 'Chicken',        price: 'GHC 10' },
      { category: 'Kokonte & Banku', name: 'Dried Fish',     price: 'GHC 10' },
      { category: 'Kokonte & Banku', name: 'Cow Meat',       price: 'GHC 10' },
      { category: 'Kokonte & Banku', name: 'Wele (Towel)',   price: 'GHC 10' },
    ],
  },

  {
    storeName: "Tinad's Ventures",
    phone: '0597581342',
    hours: '2:00pm – 11:00pm',
    description: 'Late-day stop for indomie, spaghetti and ice cream when you need a quick fix.',
    cuisine: ['Indomie', 'Spaghetti', 'Snacks'],
    items: [
      { category: 'Mains',  name: 'Indomie',   price: 'GHC 30' },
      { category: 'Mains',  name: 'Spaghetti', price: 'GHC 30' },
      { category: 'Snacks', name: 'Ice Cream', price: 'GHC 5' },
    ],
  },

  {
    storeName: 'Focus',
    phone: '0550195460',
    hours: '7:30am – 11:00pm',
    description: 'Full menu — assorted fried rice, jollof, chek chek, waakye packages with every topping you could want.',
    cuisine: ['Fried Rice', 'Jollof', 'Waakye', 'Chek Chek'],
    items: [
      { category: 'Mains', name: 'Chek Chek',           price: 'GHC 35' },
      { category: 'Mains', name: 'Fried Rice',          price: 'GHC 30' },
      { category: 'Mains', name: 'Assorted Fried Rice', price: 'GHC 50' },
      { category: 'Mains', name: 'Jollof Rice',         price: 'GHC 35' },
      { category: 'Mains', name: 'Waakye Package',      price: 'GHC 25' },
      { category: 'Mains', name: 'Waakye',              price: 'GHC 10' },
      { category: 'Toppings', name: 'Chicken',  price: 'GHC 10' },
      { category: 'Toppings', name: 'Egg',      price: 'GHC 4' },
      { category: 'Toppings', name: 'Sausage',  price: 'GHC 4' },
      { category: 'Toppings', name: 'Wele',     price: 'GHC 50' },
      { category: 'Toppings', name: 'Meat',     price: 'GHC 10' },
      { category: 'Toppings', name: 'Salad',    price: 'GHC 50' },
      { category: 'Toppings', name: 'Spag and Gari', price: 'GHC 5' },
      { category: 'Sides',    name: 'Plantain', price: 'GHC 5' },
      { category: 'Sides',    name: 'Pear',     price: 'GHC 5' },
    ],
  },

  {
    storeName: 'Chef One',
    phone: '0530506391',
    hours: '12:00pm – 12:00am',
    description: 'Hot fried rice, jollof and banku-with-tilapia until midnight — plus fufu on Sundays.',
    cuisine: ['Fried Rice', 'Jollof', 'Banku', 'Tilapia', 'Fufu'],
    items: [
      { category: 'Mains', name: 'Fried Rice',                 price: 'GHC 30' },
      { category: 'Mains', name: 'Jollof Rice',                price: 'GHC 30' },
      { category: 'Mains', name: 'Indomie',                    price: 'GHC 30' },
      { category: 'Mains', name: 'Banku with Okro/Soup/Pepper', price: 'GHC 30' },
      { category: 'Mains', name: 'Banku with Tilapia',         price: 'GHC 100' },
      { category: 'Mains', name: 'Emo Tuo with Groundnut Soup', price: 'GHC 30' },
      { category: 'Sunday Special', name: 'Fufu with Soup',    price: 'GHC 40' },
    ],
  },

  {
    storeName: "Eno's Kitchen",
    phone: '0244074521',
    hours: '11:00am – 12:00am',
    description: 'Fried rice, jollof, banku and emo tuo, with proteins and weekend soups.',
    cuisine: ['Fried Rice', 'Jollof', 'Banku', 'Emo Tuo'],
    items: [
      { category: 'Mains', name: 'Fried Rice', price: 'GHC 30' },
      { category: 'Mains', name: 'Jollof Rice', price: 'GHC 40' },
      { category: 'Mains', name: 'Banku',      price: 'GHC 5' },
      { category: 'Mains', name: 'Emo Tuo',    price: 'GHC 5' },
      { category: 'Toppings', name: 'Chicken', price: 'GHC 15' },
      { category: 'Toppings', name: 'Wele',    price: 'GHC 5' },
      { category: 'Toppings', name: 'Fish',    price: 'GHC 15' },
      { category: 'Toppings', name: 'Sausage', price: 'GHC 5' },
      { category: 'Toppings', name: 'Wele (Towel)', price: 'GHC 5' },
      { category: 'Toppings', name: 'Beef',    price: 'GHC 6' },
      { category: 'Toppings', name: 'Egg',     price: 'GHC 3.50' },
      { category: 'Weekend Soups', name: 'Light Soup (Sat & Sun)', price: 'Free' },
      { category: 'Weekend Soups', name: 'Groundnut Soup',          price: 'Free' },
    ],
  },

  {
    storeName: "Xanab's Special Meals",
    phone: '0244734333',
    hours: '9:00am – 6:00pm',
    description: 'Banku, TZ, emo tuo, ab3tsi3 with soup; gob3 and plain rice on the side. Chicken wings, kotodwe and more.',
    cuisine: ['Banku', 'TZ', 'Emo Tuo', 'Gob3'],
    items: [
      { category: 'Banku & Swallow', name: 'Banku',          price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'TZ',             price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'Emo Tuo',        price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'Abetsie',        price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'Palmnut Soup',   price: 'Free' },
      { category: 'Banku & Swallow', name: 'Ayoyo Soup',     price: 'Free' },
      { category: 'Banku & Swallow', name: 'Groundnut Soup', price: 'Free' },
      { category: 'Banku & Swallow', name: 'Fish',           price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'Egg',            price: 'GHC 3' },
      { category: 'Banku & Swallow', name: 'Wele (Towel)',   price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'Chicken Wings',  price: 'GHC 10' },
      { category: 'Banku & Swallow', name: 'Kotodwe',        price: 'GHC 15' },
      { category: 'Banku & Swallow', name: 'Wele',           price: 'GHC 5' },
      { category: 'Banku & Swallow', name: 'Beef',           price: 'GHC 5' },
      { category: 'Gob3 & Rice', name: 'Gob3',       price: 'GHC 5' },
      { category: 'Gob3 & Rice', name: 'Plain Rice', price: 'GHC 5' },
      { category: 'Gob3 & Rice', name: 'Plantain',   price: 'GHC 2' },
    ],
  },

  {
    storeName: "Monica's Finest Eatery",
    phone: '0530518207',
    hours: '7:00am – 2:00pm',
    description: 'Morning-to-afternoon waakye and kenkey, with the full topping bar.',
    cuisine: ['Waakye', 'Kenkey'],
    items: [
      // WAAKYE
      { category: 'Waakye', name: 'Waakye Rice',  price: 'GHC 10' },
      { category: 'Waakye', name: 'Fish',         price: 'GHC 10' },
      { category: 'Waakye', name: 'Chicken',      price: 'GHC 10' },
      { category: 'Waakye', name: 'Egg',          price: 'GHC 4' },
      { category: 'Waakye', name: 'Sausage',      price: 'GHC 5' },
      { category: 'Waakye', name: 'Wele (Towel)', price: 'GHC 10' },
      { category: 'Waakye', name: 'Salad, Gari & Macaroni', price: 'GHC 5' },
      { category: 'Waakye', name: 'Plantain',     price: 'GHC 1' },
      { category: 'Waakye', name: 'Wele',         price: 'GHC 10' },
      { category: 'Waakye', name: 'Pear',         price: 'GHC 5' },
      // KENKEY
      { category: 'Kenkey', name: 'Kenkey',  price: 'GHC 5' },
      { category: 'Kenkey', name: 'Fish',    price: 'GHC 10' },
      { category: 'Kenkey', name: 'Chicken', price: 'GHC 10' },
      { category: 'Kenkey', name: 'Egg',     price: 'GHC 4' },
      { category: 'Kenkey', name: 'Sausage', price: 'GHC 5' },
      { category: 'Kenkey', name: 'Wele (Towel)', price: 'GHC 10' },
      { category: 'Kenkey', name: 'Okro',    price: 'GHC 5' },
    ],
  },
];

// Turn "Antie Ama's Gob3" → "antie-amas-gob3".
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const passwordHash = await bcrypt.hash(VENDOR_PASSWORD, 12);
  let createdVendors = 0;
  let createdItems = 0;

  for (const v of VENDORS) {
    const slug  = slugify(v.storeName);
    const email = `${slug}@vendors.campuschoo.gh`;

    // 1) Upsert User
    const user = await prisma.user.upsert({
      where:  { email },
      update: { name: v.storeName, phone: v.phone, role: 'VENDOR' },
      create: { name: v.storeName, email, passwordHash, phone: v.phone, role: 'VENDOR' },
    });

    // 2) Upsert Vendor (linked 1:1 via userId)
    const vendor = await prisma.vendor.upsert({
      where:  { userId: user.id },
      update: {
        storeName: v.storeName,
        description: `${v.description} Open ${v.hours}.`,
        location: DEFAULT_LOCATION,
        cuisine: v.cuisine,
        isOpen: true,
      },
      create: {
        userId: user.id,
        storeName: v.storeName,
        description: `${v.description} Open ${v.hours}.`,
        location: DEFAULT_LOCATION,
        cuisine: v.cuisine,
        isOpen: true,
      },
    });
    createdVendors++;

    // 3) Replace menu items — wipe + re-create so the seed stays the source of truth.
    await prisma.menuItem.deleteMany({ where: { vendorId: vendor.id } });

    if (v.items.length > 0) {
      await prisma.menuItem.createMany({
        data: v.items.map((it) => ({
          vendorId:    vendor.id,
          name:        it.name,
          description: null,
          price:       parsePrice(it.price),
          category:    it.category,
          imageUrl:    imageFor(it.name),
          isAvailable: true,
        })),
      });
      createdItems += v.items.length;
    }

    console.log(`✓ ${v.storeName.padEnd(28)} — ${v.items.length} items`);
  }

  console.log(`\nSeeded ${createdVendors} vendors, ${createdItems} menu items.`);
  console.log(`Login: <slug>@vendors.campuschoo.gh / ${VENDOR_PASSWORD}`);
  console.log(`Example: jumor-kings@vendors.campuschoo.gh / ${VENDOR_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
