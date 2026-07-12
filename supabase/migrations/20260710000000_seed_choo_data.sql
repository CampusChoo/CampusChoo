-- Seed CampusChoo with all 11 vendors and their menu items from CAMPUS CHOO PRICE.xlsx
-- Run this via Supabase SQL Editor in project: fyvgxajqpuyrjxouyztr
--
-- How to run:
--   1. Go to https://supabase.com/dashboard/project/fyvgxajqpuyrjxouyztr/sql/new
--   2. Paste this SQL
--   3. Click "Run"
--
-- NOTE: User passwords are random (cannot be used for login). They are created
-- only so that each vendor has a linked user record (required by DB schema).
-- Vendors should register separately to get their own login credentials.

DO $$
DECLARE
  -- Vendor user records
  v_jumor   text;  v_antie   text;  v_fastmah text;
  v_maka    text;  v_cath    text;  v_tinad   text;
  v_focus   text;  v_chef    text;  v_eno     text;
  v_xanab   text;  v_monica  text;

  -- Vendor records
  vid_jumor   text;  vid_antie   text;  vid_fastmah text;
  vid_maka    text;  vid_cath    text;  vid_tinad   text;
  vid_focus   text;  vid_chef    text;  vid_eno     text;
  vid_xanab   text;  vid_monica  text;
BEGIN
  -- ============================================================
  -- 0. CLEANUP (makes this migration safe to re-run)
  -- ============================================================
  DELETE FROM public."menuItem"
   WHERE "vendorId" IN (
     SELECT id FROM public.vendor
     WHERE "userId" IN (
       SELECT id FROM public."user" WHERE email LIKE 'vendor-%@campuschoo.local'
     )
   );
  DELETE FROM public.vendor
   WHERE "userId" IN (
     SELECT id FROM public."user" WHERE email LIKE 'vendor-%@campuschoo.local'
   );
  DELETE FROM public."user" WHERE email LIKE 'vendor-%@campuschoo.local';

  -- ============================================================
  -- 1. INSERT VENDOR USERS (gen_random_uuid seeded for id)
  -- ============================================================
  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('JUMOR KINGS', 'vendor-jumor@campuschoo.local', 'random', '+233242925350', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_jumor FROM public."user" WHERE email = 'vendor-jumor@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('ANTIE AMA''S GOB3', 'vendor-antie@campuschoo.local', 'random', '+233248448793', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_antie FROM public."user" WHERE email = 'vendor-antie@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('FASTMAH', 'vendor-fastmah@campuschoo.local', 'random', '+233543499282', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_fastmah FROM public."user" WHERE email = 'vendor-fastmah@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('MAKARIOS RESTURANT', 'vendor-makarios@campuschoo.local', 'random', '+233246553515', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_maka FROM public."user" WHERE email = 'vendor-makarios@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('CATHERINE''S KITCHEN', 'vendor-catherine@campuschoo.local', 'random', '+23353569944', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_cath FROM public."user" WHERE email = 'vendor-catherine@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('TINAD''S VENTURES', 'vendor-tinad@campuschoo.local', 'random', '+233597581342', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_tinad FROM public."user" WHERE email = 'vendor-tinad@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('FOCUS', 'vendor-focus@campuschoo.local', 'random', '+233550195460', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_focus FROM public."user" WHERE email = 'vendor-focus@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('CHEF ONE', 'vendor-chef1@campuschoo.local', 'random', '+233530506391', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_chef FROM public."user" WHERE email = 'vendor-chef1@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('ENO''S KITCHEN', 'vendor-eno@campuschoo.local', 'random', '+233244074521', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_eno FROM public."user" WHERE email = 'vendor-eno@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('XANAB''S SPECIAL MEALS', 'vendor-xanab@campuschoo.local', 'random', '+233244734333', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_xanab FROM public."user" WHERE email = 'vendor-xanab@campuschoo.local';

  INSERT INTO public."user"(name, email, "passwordHash", phone, role)
  VALUES ('MONICA''S FINEST PASTRY', 'vendor-monica@campuschoo.local', 'random', '+233530518207', 'VENDOR')
  ON CONFLICT (email) DO NOTHING;
  SELECT id INTO v_monica FROM public."user" WHERE email = 'vendor-monica@campuschoo.local';

  RAISE NOTICE 'Users created: jumor=%, antie=%, fastmah=%, maka=%, cath=%',
    v_jumor, v_antie, v_fastmah, v_maka, v_cath;

  -- ============================================================
  -- 2. INSERT VENDORS
  -- ============================================================
  INSERT INTO public.vendor("userId","storeName",description,location,"imageUrl","isOpen",rating,cuisine)
  VALUES
    (v_jumor,  'JUMOR KINGS',          'JUMOR KINGS — 7:00am–9:00pm',  'UMaT, Tarkwa – Halls & Cafeteria', '/food/kenkey.webp',        true, 4.5, '{}'),
    (v_antie,  'ANTIE AMA''S GOB3',     'ANTIE AMA''S GOB3 — 7:00am–4:00pm', 'UMaT, Tarkwa – SRC Cafeteria', '/food/gob3.webp',   true, 4.3, '{}'),
    (v_fastmah,'FASTMAH',              'FASTMAH — 7:30AM–6:00PM',      'UMaT, Tarkwa – Faculty Block',    '/food/waakye.webp',         true, 4.6, '{}'),
    (v_maka,   'MAKARIOS RESTURANT',   'MAKARIOS RESTURANT — 9:30AM–10:00PM', 'UMaT, Tarkwa – Main Campus', '/food/jollof.jpg', true, 4.4, '{}'),
    (v_cath,   'CATHERINE''S KITCHEN',  'CATHERINE''S KITCHEN — 8:30AM–1:00AM', 'UMaT, Tarkwa – Halls',  '/food/kenkey.webp',        true, 4.7, '{}'),
    (v_tinad,  'TINAD''S VENTURES',     'TINAD''S VENTURES — 2:00PM–11:00PM',  'UMaT, Tarkwa – Hostel Area','/food/indomie.webp', true, 4.2, '{}'),
    (v_focus,  'FOCUS',                'FOCUS — 7:30AM–11:00PM',        'UMaT, Tarkwa – Lecture Courts',   '/food/waakye.webp',         true, 4.5, '{}'),
    (v_chef,   'CHEF ONE',             'CHEF ONE — 12:00PM–12:00AM',    'UMaT, Tarkwa – Food Court',       '/food/fried-rice.webp',     true, 4.8, '{}'),
    (v_eno,    'ENO''S KITCHEN',        'ENO''S KITCHEN — 11:00AM–12:00AM', 'UMaT, Tarkwa – Hostel Junction','/food/fufu.jpg',    true, 4.6, '{}'),
    (v_xanab,  'XANAB''S SPECIAL MEALS','XANAB – 9:00AM–6:00PM',          'UMaT, Tarkwa – Staff Quarters',   '/food/tz.webp',             true, 4.4, '{}'),
    (v_monica, 'MONICA''S FINEST PASTRY','MONICA''S FINEST PASTRY — 7:00AM–2:00PM', 'UMaT, Tarkwa – Halls', '/food/waakye.webp',  true, 4.3, '{}');

  SELECT id INTO vid_jumor   FROM public.vendor WHERE "userId" = v_jumor;
  SELECT id INTO vid_antie   FROM public.vendor WHERE "userId" = v_antie;
  SELECT id INTO vid_fastmah FROM public.vendor WHERE "userId" = v_fastmah;
  SELECT id INTO vid_maka    FROM public.vendor WHERE "userId" = v_maka;
  SELECT id INTO vid_cath    FROM public.vendor WHERE "userId" = v_cath;
  SELECT id INTO vid_tinad   FROM public.vendor WHERE "userId" = v_tinad;
  SELECT id INTO vid_focus   FROM public.vendor WHERE "userId" = v_focus;
  SELECT id INTO vid_chef    FROM public.vendor WHERE "userId" = v_chef;
  SELECT id INTO vid_eno     FROM public.vendor WHERE "userId" = v_eno;
  SELECT id INTO vid_xanab   FROM public.vendor WHERE "userId" = v_xanab;
  SELECT id INTO vid_monica  FROM public.vendor WHERE "userId" = v_monica;

  RAISE NOTICE 'Vendors created: jumor=%, antie=%, fastmah=%', vid_jumor, vid_antie, vid_fastmah;

  -- ============================================================
  -- 3. INSERT MENU ITEMS FOR EACH VENDOR
  -- ============================================================
  -- JUMOR KINGS
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Kenkey',           'Fresh fermented kenkey',    7,   'Mains',    '/food/kenkey.webp',    true, vid_jumor),
    ('Fish',             'Grilled tilapia fish',      10,  'Proteins', '/food/fish.webp',       true, vid_jumor),
    ('Chicken',          'Grilled chicken pieces',    10,  'Proteins', '/food/chicken.webp',    true, vid_jumor),
    ('Egg',              'Boiled egg',                3.5, 'Proteins', '/food/egg.webp',        true, vid_jumor),
    ('Sausage (Small)',  'Small hot sausage',         5,   'Sides',    '/food/sausage.webp',    true, vid_jumor),
    ('Sausage (Big)',    'Large hot sausage',         8,   'Sides',    '/food/sausage.webp',    true, vid_jumor),
    ('Okro Soup',        'Fresh okro soup',           5,   'Soups',    '/food/okro-soup.webp',  true, vid_jumor),
    ('Wele',             'Tripe / cow stomach',       5,   'Proteins', '/food/beef.webp',       true, vid_jumor),
    ('Beef',             'Tender beef pieces',        5,   'Proteins', '/food/beef.webp',       true, vid_jumor);

  -- ANTIE AMA'S GOB3
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Gob3',         'Ghanaian beans + gari + plantain',  6,   'Mains',    '/food/gob3.webp',       true, vid_antie),
    ('Plain Rice',   'Steamed white rice',                5,   'Mains',    '/food/plain-rice.webp', true, vid_antie),
    ('Plantain',     'Fried ripe plantain',                1,   'Sides',    '/food/plantain.webp',   true, vid_antie),
    ('Sausage',      'Hot sausage',                        6,   'Sides',    '/food/sausage.webp',    true, vid_antie),
    ('Egg',          'Boiled egg',                         4,   'Proteins', '/food/egg.webp',        true, vid_antie),
    ('Pear',         'Fresh pawpaw (pear)',                4,   'Sides',    '/food/pear.webp',       true, vid_antie);

  -- FASTMAH
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Waakye (Rice)',            'Rice + beans combo',            8,   'Mains',    '/food/waakye.webp',      true, vid_fastmah),
    ('Waakye Fish',              'Grilled fish with waakye',      7,   'Proteins', '/food/fish.webp',        true, vid_fastmah),
    ('Waakye Chicken (Small)',   'Small chicken piece',           10,  'Proteins', '/food/chicken.webp',     true, vid_fastmah),
    ('Waakye Chicken (Large)',   'Large chicken piece',           15,  'Proteins', '/food/chicken.webp',     true, vid_fastmah),
    ('Waakye Egg',               'Boiled egg add-on',             4,   'Proteins', '/food/egg.webp',         true, vid_fastmah),
    ('Waakye Sausage',           'Hot sausage add-on',            4,   'Sides',    '/food/sausage.webp',     true, vid_fastmah),
    ('Gob3',                     'Beans gari plantain',           8,   'Mains',    '/food/gob3.webp',        true, vid_fastmah),
    ('Fried Rice',               'Fried rice',                    10,  'Mains',    '/food/fried-rice.webp',  true, vid_fastmah),
    ('Jollof Rice',              'Jollof rice',                   10,  'Mains',    '/food/jollof.jpg',       true, vid_fastmah),
    ('Kokonte',                  'Cassava dough',                 5,   'Mains',    '/food/okro-soup.webp',   true, vid_fastmah),
    ('Banku',                    'Fermented corn dough',          5,   'Mains',    '/food/banku-tilapia.webp',true,vid_fastmah),
    ('TZ (Tuo Zaafi)',           'Tuo Zaafi',                     5,   'Mains',    '/food/tz.webp',          true, vid_fastmah);

  -- MAKARIOS RESTURANT
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Fried Rice',      'Spiced fried rice',   35,  'Mains',  '/food/fried-rice.webp', true, vid_maka),
    ('Jollof Rice',     'Party jollof rice',   35,  'Mains',  '/food/jollof.jpg',       true, vid_maka),
    ('Banku & Tilapia', 'Banku with grilled tilapia', 40, 'Combos', '/food/banku-tilapia.webp', true, vid_maka),
    ('Shawarma',        'Chicken shawarma wrap',    40, 'Snacks',  '/food/shawarma.webp',   true, vid_maka);

  -- CATHERINE'S KITCHEN
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Kenkey',      'Fermented kenkey',      5,   'Mains',  '/food/kenkey.webp',      true, vid_cath),
    ('Fish',        'Grilled tilapia',       10,  'Proteins','/food/fish.webp',       true, vid_cath),
    ('Shrimps',     'Fresh shrimps',         10,  'Proteins','/food/fish.webp',       true, vid_cath),
    ('Egg',         'Boiled egg',            5,   'Proteins','/food/egg.webp',        true, vid_cath),
    ('Sausage',     'Hot sausage',           5,   'Sides',  '/food/sausage.webp',    true, vid_cath),
    ('Okro Soup',   'Fresh okro soup',       5,   'Soups',  '/food/okro-soup.webp',  true, vid_cath),
    ('Wele',        'Tripe cooked in soup',  5,   'Proteins','/food/beef.webp',      true, vid_cath),
    ('Beef',        'Tender beef',           5,   'Proteins','/food/beef.webp',      true, vid_cath),
    ('Oily Rice',   'Oily rice with stew',   10,  'Mains',  '/food/jollof.jpg',      true, vid_cath),
    ('Fried Yam',   'Crispy fried yam',      5,   'Sides',  '/food/fried-yam.webp',  true, vid_cath),
    ('Banku',       'Fermented corn dough',  5,   'Mains',  '/food/banku-tilapia.webp', true, vid_cath),
    ('Kokonte',     'Cassava dough',         5,   'Mains',  '/food/tz.webp',         true, vid_cath);

  -- TINAD'S VENTURES
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Indomie',  'Indomie noodles special',  30, 'Mains',    '/food/indomie.webp',    true, vid_tinad),
    ('Spaghetti','Spaghetti bolognese',       30, 'Mains',    '/food/spaghetti.webp',  true, vid_tinad),
    ('Ice Cream','Vanilla & chocolate',       5,  'Desserts', '/food/OIP (2).webp',   true, vid_tinad);

  -- FOCUS
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Chek Chek',               'Spiced rice with eggs & fish',                   35,  'Mains',  '/food/jollof.jpg',         true, vid_focus),
    ('Jollof Rice + Toppings',  'Jollof with egg, sausage & chicken',             35,  'Mains',  '/food/jollof.jpg',         true, vid_focus),
    ('Waakye Package',          'Full waakye combo with all toppings',            25,  'Combos', '/food/waakye-package.webp',true, vid_focus),
    ('Waakye (Rice)',           'Waakye rice',                                    10,  'Mains',  '/food/waakye.webp',        true, vid_focus),
    ('Fried Rice',              'Vegetable fried rice',                            50,  'Mains',  '/food/fried-rice.webp',   true, vid_focus),
    ('Assorted Fried Rice',     'Fried rice with chicken & egg',                  50,  'Mains',  '/food/fried-rice.webp',   true, vid_focus),
    ('Chicken',                 'Fried chicken piece',                            10,  'Proteins','/food/chicken.webp',      true, vid_focus),
    ('Egg',                     'Boiled egg',                                      4,  'Proteins','/food/egg.webp',          true, vid_focus),
    ('Sausage',                 'Hot sausage',                                      4,  'Sides',  '/food/sausage.webp',      true, vid_focus),
    ('Wele',                    'Wele (cow stomach)',                             50,  'Proteins','/food/beef.webp',         true, vid_focus),
    ('Salad',                   'Fresh garden salad',                              5,  'Sides',  '/food/plantain.webp',     true, vid_focus),
    ('Spag & Gari',             'Spaghetti with gari',                             5,  'Snacks', '/food/spaghetti.webp',   true, vid_focus),
    ('Plantain',                'Fried ripe plantain',                             5,  'Sides',  '/food/plantain.webp',     true, vid_focus),
    ('Pear',                    'Fresh pawpaw (pear)',                             5,  'Sides',  '/food/pear.webp',         true, vid_focus);

  -- CHEF ONE
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Fried Rice',                    'Jollof fried rice',    30,  'Mains',  '/food/fried-rice.webp',  true, vid_chef),
    ('Jollof Rice',                   'Party jollof',          30,  'Mains',  '/food/jollof.jpg',        true, vid_chef),
    ('Indomie',                       'Instant noodles special',30, 'Mains',  '/food/indomie.webp',      true, vid_chef),
    ('Banku with Okro/Soup/Pepper',   'Banku + soup combo',   30,  'Combos', '/food/banku-tilapia.webp',true, vid_chef),
    ('Banku with Tilapia',            'Banku + whole tilapia',100,  'Combos', '/food/banku-tilapia.webp',true, vid_chef),
    ('Emo Tuo with Groundnut Soup',   'Emo tuo + soup',       30,  'Combos', '/food/emo-tuo.webp',      true, vid_chef),
    ('Fufu with Soup (Sundays)',      'Fufu plate on Sundays',40,  'Combos', '/food/fufu.jpg',          true, vid_chef);

  -- ENO'S KITCHEN
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Fried Rice',     'Spiced fried rice',   30,  'Mains',  '/food/fried-rice.webp',   true, vid_eno),
    ('Jollof Rice',    'Party jollof rice',   40,  'Mains',  '/food/jollof.jpg',        true, vid_eno),
    ('Banku',          'Fermented corn dough',5,   'Mains',  '/food/banku-tilapia.webp',true, vid_eno),
    ('Emo Tuo',        'Emo tuo balls',       5,   'Mains',  '/food/emo-tuo.webp',      true, vid_eno),
    ('Chicken',        'Fried chicken',       15,  'Proteins','/food/chicken.webp',    true, vid_eno),
    ('Wele',           'Wele / tripe',         5,  'Proteins','/food/beef.webp',       true, vid_eno),
    ('Fish',           'Grilled fish',        15,  'Proteins','/food/fish.webp',        true, vid_eno),
    ('Sausage',        'Hot sausage',          5,  'Sides',  '/food/sausage.webp',     true, vid_eno),
    ('Towel (Meat)',   'Meat / towel',          5,  'Proteins','/food/beef.webp',      true, vid_eno),
    ('Beef',           'Tender beef',          6,  'Proteins','/food/beef.webp',       true, vid_eno),
    ('Eggs',           'Boiled eggs',          3.5,'Proteins','/food/egg.webp',        true, vid_eno),
    ('Light Soup',     'Free light soup',       0,  'Soups',  '/food/okro-soup.webp',   true, vid_eno),
    ('Groundnut Soup', 'Free groundnut soup',   0,  'Soups',  '/food/fufu-soup.webp',   true, vid_eno);

  -- XANAB'S SPECIAL MEALS
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Banku',          'Fermented banku',     5,   'Mains',  '/food/banku-tilapia.webp',true, vid_xanab),
    ('TZ (Tuo Zaafi)', 'Tuo zaafi balls',     5,   'Mains',  '/food/tz.webp',           true, vid_xanab),
    ('Emo Tuo',        'Emo tuo',             5,   'Mains',  '/food/emo-tuo.webp',      true, vid_xanab),
    ('Abetsie',        'Abetsie dough',       5,   'Mains',  '/food/banku-tilapia.webp',true, vid_xanab),
    ('Palm Nut Soup',  'Free palm nut soup',  0,   'Soups',  '/food/okro-soup.webp',    true, vid_xanab),
    ('Ayoyo Soup',     'Free ayoyo soup',     0,   'Soups',  '/food/jollof.jpg',        true, vid_xanab),
    ('Groundnut Soup', 'Free groundnut soup', 0,   'Soups',  '/food/fufu-soup.webp',    true, vid_xanab),
    ('Fish',           'Fresh fish',          5,   'Proteins','/food/fish.webp',       true, vid_xanab),
    ('Egg',            'Fresh egg',           3,   'Proteins','/food/egg.webp',        true, vid_xanab),
    ('Towel',          'Meat / towel',         5,  'Proteins','/food/beef.webp',       true, vid_xanab),
    ('Chicken Wings',  'Fried chicken wings',  10,  'Proteins','/food/chicken.webp',    true, vid_xanab),
    ('Kotodwe',        'Smoked fish / kotodwe',15,  'Proteins','/food/fish.webp',       true, vid_xanab),
    ('Wele',           'Tripe',                 5,  'Proteins','/food/beef.webp',       true, vid_xanab),
    ('Beef',           'Tender beef',           5,  'Proteins','/food/beef.webp',       true, vid_xanab),
    ('Gob3',           'Gob3 plate',            5,  'Mains',  '/food/gob3.webp',        true, vid_xanab),
    ('Plain Rice',     'Steamed rice',          5,  'Mains',  '/food/plain-rice.webp',  true, vid_xanab),
    ('Plantain',       'Fried plantain',         2,  'Sides',  '/food/plantain.webp',    true, vid_xanab);

  -- MONICA'S FINEST PASTRY
  INSERT INTO public."menuItem"(name,description,price,category,"imageUrl","isAvailable","vendorId") VALUES
    ('Waakye (Rice)',     'Waakye rice',                      10,  'Mains',  '/food/waakye.webp',         true, vid_monica),
    ('Waakye Fish',       'Grilled fish with waakye',         10,  'Proteins','/food/fish.webp',        true, vid_monica),
    ('Waakye Chicken',    'Fried chicken with waakye',        10,  'Proteins','/food/chicken.webp',     true, vid_monica),
    ('Waakye Egg',        'Boiled egg with waakye',            4,  'Proteins','/food/egg.webp',         true, vid_monica),
    ('Waakye Sausage',    'Hot sausage add-on',                 5,  'Sides',  '/food/sausage.webp',       true, vid_monica),
    ('Waakye Towel',      'Meat / towel',                      10,  'Proteins','/food/beef.webp',        true, vid_monica),
    ('Waakye Salad/Gari', 'Salad, gari & spaghetti combo',      5,  'Sides',  '/food/plantain.webp',      true, vid_monica),
    ('Waakye Plantain',   'Fried plantain add-on',              1,  'Sides',  '/food/plantain.webp',      true, vid_monica),
    ('Kenkey',            'Fermented kenkey',                   5,  'Mains',  '/food/kenkey.webp',        true, vid_monica),
    ('Kenkey Fish',       'Fish with kenkey',                  10,  'Proteins','/food/fish.webp',        true, vid_monica),
    ('Kenkey Chicken',    'Chicken with kenkey',               10,  'Proteins','/food/chicken.webp',     true, vid_monica),
    ('Kenkey Egg',        'Egg with kenkey',                     4,  'Proteins','/food/egg.webp',         true, vid_monica),
    ('Kenkey Sausage',    'Sausage with kenkey',                 5,  'Sides',  '/food/sausage.webp',      true, vid_monica),
    ('Kenkey Towel',      'Meat / towel with kenkey',           10,  'Proteins','/food/beef.webp',        true, vid_monica),
    ('Kenkey Okro',       'Okro soup with kenkey',               5,  'Soups',  '/food/okro-soup.webp',    true, vid_monica);

  RAISE NOTICE 'All menu items inserted.';
END $$;

-- ================================================================
-- OPTIONAL: If vendor users already exist and you want to re-use
-- them (skipping user creation above), uncomment and replace IDs:
-- ================================================================
-- UPDATE public.vendor SET "storeName"='JUMOR KINGS', location='UMaT, Tarkwa', "imageUrl"='/food/kenkey.webp' WHERE id='<vendor-uuid>';
-- DELETE FROM public."menuItem" WHERE "vendorId"='<vendor-uuid>';

-- Verify results:
SELECT v."storeName", v.location, v."isOpen", v.rating, COUNT(m.id) AS item_count
FROM public.vendor v
LEFT JOIN public."menuItem" m ON m."vendorId"=v.id
WHERE v."storeName" IS NOT NULL
GROUP BY v.id
ORDER BY v."storeName";
