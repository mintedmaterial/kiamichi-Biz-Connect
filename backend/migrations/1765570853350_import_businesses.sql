-- Import businesses from CSV files
-- Generated: 2025-12-12T20:20:53.350Z
-- Total: 51 businesses

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'San Juan''s Automotive Repair, LLC',
  'san-juan-s-automotive-repair-llc',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'De Queen',
  'AR',
  '71832',
  '166 J.B. Logan Cir',
  34.06636428833008,
  -94.32488250732422,
  '(972) 955-1306',
  'https://www.facebook.com/SanJuans-Automotive-Repair-630274840958753/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('San Juan''s Automotive Repair, LLC')
  AND LOWER(city) = LOWER('De Queen')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'No Joke Auto Mobile Mechanic Service',
  'no-joke-auto-mobile-mechanic-service',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '12571 State Highway 98',
  33.993228912353516,
  -95.03642272949219,
  '(580) 236-7576',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('No Joke Auto Mobile Mechanic Service')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Jacob''s Automotive',
  'jacob-s-automotive',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '751 N Dalton Ave',
  34.0111083984375,
  -95.09193420410156,
  '(580) 933-7407',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Jacob''s Automotive')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Classic Oil & Lube',
  'classic-oil-lube',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '304 Wilson St',
  34.000972747802734,
  -95.08966827392578,
  '(580) 933-4422',
  'https://www.facebook.com/Tuck-Oil-Lube-558136457725406',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Classic Oil & Lube')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'J C''s Store',
  'j-c-s-store',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  NULL,
  NULL,
  NULL,
  'Valliant, OK 74764',
  34.08074951171875,
  -95.08654022216797,
  '(580) 933-4957',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.6dq151lh9iR/zQ480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('J C''s Store')
  AND LOWER(city) = LOWER(NULL)
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Rooks Used Cars',
  'rooks-used-cars',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '205 Wilson St',
  34.003074645996094,
  -95.0968246459961,
  '(580) 933-4443',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Rooks Used Cars')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Turtle''s Garage',
  'turtle-s-garage',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '751 Valliant Bypass Rd',
  34.05926513671875,
  -95.06591033935547,
  '(580) 933-4288',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Turtle''s Garage')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Yoder''s Auto Repair',
  'yoder-s-auto-repair',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Sawyer',
  'OK',
  '74756',
  '201 US Highway 70',
  34.01120376586914,
  -95.37663269042969,
  '(580) 326-6864',
  'https://www.yodersautorepairok.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.WXZNQSqTvoteAQ480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Yoder''s Auto Repair')
  AND LOWER(city) = LOWER('Sawyer')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Curly''s Marine & Auto',
  'curly-s-marine-auto',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Millerton',
  'OK',
  '74736',
  '201 E Cherry St',
  33.98828125,
  -95.01227569580078,
  '(580) 746-2378',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Curly''s Marine & Auto')
  AND LOWER(city) = LOWER('Millerton')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Kat''s Mobile Truck Repair',
  'kat-s-mobile-truck-repair',
  NULL,
  (SELECT id FROM categories WHERE name = 'Automotive' LIMIT 1),
  'Spencerville',
  'OK',
  '74760',
  'OK-147',
  34.19123458862305,
  -95.3435287475586,
  '(580) 317-5605',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Kat''s Mobile Truck Repair')
  AND LOWER(city) = LOWER('Spencerville')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Upgrade to Pro plan for unlimited scraping!',
  'upgrade-to-pro-plan-for-unlimited-scraping',
  NULL,
  (SELECT id FROM categories WHERE name = NULL LIMIT 1),
  NULL,
  NULL,
  NULL,
  NULL,
  null,
  null,
  NULL,
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Upgrade to Pro plan for unlimited scraping!')
  AND LOWER(city) = LOWER(NULL)
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Family Dollar',
  'family-dollar',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Wright City',
  'OK',
  '74766',
  '6538 OK-98',
  34.06931686401367,
  -95.00685119628906,
  '(580) 634-5612',
  'https://locations.familydollar.com/ok/wright-city/6538-ok-98',
  NULL,
  'https://www.bing.com/th?id=OLC.RkQ77EcGcI2Y3w480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Family Dollar')
  AND LOWER(city) = LOWER('Wright City')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Dalton Avenue Flowers & Gifts',
  'dalton-avenue-flowers-gifts',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '13 N Dalton Ave',
  34.002830505371094,
  -95.0940170288086,
  '(580) 933-7101',
  'https://www.daltonaveflowersandgifts.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Dalton Avenue Flowers & Gifts')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Dorries Hardware & Sales',
  'dorries-hardware-sales',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '22183 US-70 E',
  34.009735107421875,
  -95.12849426269531,
  '(580) 933-5115',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Dorries Hardware & Sales')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Jailhouse Feed',
  'jailhouse-feed',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '54 W Wilson St',
  34.002037048339844,
  -95.09500122070312,
  '(580) 933-7100',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.dVm1v4uIbFcrLA480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Jailhouse Feed')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Dollar General',
  'dollar-general',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Wright City',
  'OK',
  '74766',
  '6470 OK-98',
  34.069358825683594,
  -95.0060806274414,
  '(918) 426-9662',
  'https://www.dollargeneral.com/store-directory/ok/wright-city/22949',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Dollar General')
  AND LOWER(city) = LOWER('Wright City')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'South Pole Country Store',
  'south-pole-country-store',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Wright City',
  'OK',
  '74766',
  '17112 W State Highway 3',
  34.14812469482422,
  -94.99547576904297,
  '(580) 981-2383',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('South Pole Country Store')
  AND LOWER(city) = LOWER('Wright City')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Trippy Trees Cannabis Company',
  'trippy-trees-cannabis-company',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '24 N Dalton Ave',
  34.00303268432617,
  -95.09326171875,
  '(580) 212-6164',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Trippy Trees Cannabis Company')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Pruett''s Food',
  'pruett-s-food',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '111 W Chappell Dr',
  34.000205993652344,
  -95.0820541381836,
  '(580) 933-5700',
  'https://www.pruettsfood.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Pruett''s Food')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Dollar General',
  'dollar-general',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Garvin',
  'OK',
  '74736',
  '133 E Wilson St',
  33.980464935302734,
  -95.00297546386719,
  '(615) 855-4000',
  'https://www.dollargeneral.com/store-directory/ok/garvin/30141',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Dollar General')
  AND LOWER(city) = LOWER('Garvin')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Baldwin''s',
  'baldwin-s',
  NULL,
  (SELECT id FROM categories WHERE name = 'Retail' LIMIT 1),
  'Ringold',
  'OK',
  '74754',
  '23116 W State Highway 3',
  34.17671203613281,
  -95.09087371826172,
  '(580) 981-2832',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.qLSW0UcM2J+GSw480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Baldwin''s')
  AND LOWER(city) = LOWER('Ringold')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Hester’s Theatre of Magic',
  'hester-s-theatre-of-magic',
  NULL,
  (SELECT id FROM categories WHERE name = 'Entertainment & Events' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '8825 N US Highway 259',
  34.14708709716797,
  -94.74905395507812,
  '(469) 688-5496',
  'https://hestermagic.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.xWqaDoAoWW3G1Q480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Hester’s Theatre of Magic')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Culpepper Merriweather Circus',
  'culpepper-merriweather-circus',
  NULL,
  (SELECT id FROM categories WHERE name = 'Entertainment & Events' LIMIT 1),
  'Hugo',
  'OK',
  '74743',
  '2588 E 2070 Rd',
  34.011390686035156,
  -95.4883041381836,
  '(580) 326-8833',
  'http://www.cmcircus.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.iW7Oe9EfO9Q1ZQ480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Culpepper Merriweather Circus')
  AND LOWER(city) = LOWER('Hugo')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  '6K Ranch',
  '6k-ranch',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '924 N 4490',
  34.069908142089844,
  -95.03207397460938,
  NULL,
  'https://www.facebook.com/6KRanch/',
  NULL,
  'https://www.bing.com/th?id=OLC.GVn8Yo/7gM+KRA480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('6K Ranch')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Kiomatia Blueberry Farm',
  'kiomatia-blueberry-farm',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  'Detroit',
  'TX',
  '75436',
  '16602 FM-410',
  33.87688064575195,
  -95.22410583496094,
  '(903) 741-8085',
  'https://kiomatiaberryfarm.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Kiomatia Blueberry Farm')
  AND LOWER(city) = LOWER('Detroit')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Price Right Tree Farms',
  'price-right-tree-farms',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  'Garvin',
  'OK',
  '74736',
  '500 Tree Farm Rd',
  33.89516067504883,
  -95.0166244506836,
  '(580) 291-0025',
  'http://www.pricerighttrees.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Price Right Tree Farms')
  AND LOWER(city) = LOWER('Garvin')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Shredz Fitness',
  'shredz-fitness',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '514 W Wilson St',
  33.99903106689453,
  -95.08332824707031,
  '(903) 556-4898',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Shredz Fitness')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Garvin Community Center and Fitness Center',
  'garvin-community-center-and-fitness-center',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Idabel',
  'OK',
  '74736',
  'E Williams St',
  33.95552062988281,
  -94.93708801269531,
  NULL,
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Garvin Community Center and Fitness Center')
  AND LOWER(city) = LOWER('Idabel')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Choctaw Nation Wellness Center - Broken Bow',
  'choctaw-nation-wellness-center-broken-bow',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '110 S Chahta Rd',
  34.02823257446289,
  -94.71793365478516,
  '(539) 316-3031',
  'https://choctawwellness.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Choctaw Nation Wellness Center - Broken Bow')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Choctaw Wellness Center',
  'choctaw-wellness-center',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Idabel',
  'OK',
  '74745',
  '1711 Shady Dell Ln',
  33.87930679321289,
  -94.79427337646484,
  '(580) 286-7381',
  'https://choctawwellness.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Choctaw Wellness Center')
  AND LOWER(city) = LOWER('Idabel')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'BODY SHAPE FITNESS CENTER',
  'body-shape-fitness-center',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Idabel',
  'OK',
  '74745',
  '3501 NE Lincoln Rd',
  33.923187255859375,
  -94.7710189819336,
  '(903) 559-1878',
  'http://bodyshapefitnesscenter.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.HqiaNZQ7qNh2MA480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('BODY SHAPE FITNESS CENTER')
  AND LOWER(city) = LOWER('Idabel')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Choctaw Nation Health Clinic',
  'choctaw-nation-health-clinic',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Idabel',
  'OK',
  '74745',
  '902 E Lincoln Rd',
  33.8800048828125,
  -94.81596374511719,
  '(580) 286-2600',
  'https://www.choctawnation.com/about/health/facilities/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Choctaw Nation Health Clinic')
  AND LOWER(city) = LOWER('Idabel')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Little River Fitness Idabel Gym',
  'little-river-fitness-idabel-gym',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Idabel',
  'OK',
  '74745',
  '3501 NE Lincoln Rd',
  33.923187255859375,
  -94.7710189819336,
  '(580) 212-6889',
  'https://www.littleriverfitness.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.LUIy7GsXlX2rQQ480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Little River Fitness Idabel Gym')
  AND LOWER(city) = LOWER('Idabel')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Choctaw Nation Ruby Choate Health Clinic',
  'choctaw-nation-ruby-choate-health-clinic',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '1300 E Martin Luther King Dr',
  34.027549743652344,
  -94.72098541259766,
  '(580) 208-2204',
  'https://www.choctawnation.com/about/health/facilities/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Choctaw Nation Ruby Choate Health Clinic')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'IC Fitness',
  'ic-fitness',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '2716 S Park Dr',
  33.9946174621582,
  -94.73999786376953,
  '(580) 743-1155',
  'https://www.facebook.com/profile.php?id=61553803618730&mibextid=LQQJ4d',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('IC Fitness')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'The Sweat Shack',
  'the-sweat-shack',
  NULL,
  (SELECT id FROM categories WHERE name = 'Health & Wellness' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '201 Main St',
  34.02851104736328,
  -94.73734283447266,
  '(580) 306-2933',
  'https://www.sweatshack.info/',
  NULL,
  'https://www.bing.com/th?id=OLC.RnDF+sMBza5+pA480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('The Sweat Shack')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Younts Universal Services LLC',
  'younts-universal-services-llc',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  NULL,
  NULL,
  NULL,
  'Private Address in , Oklahoma',
  34.037818908691406,
  -95.10504913330078,
  '(580) 579-7974',
  'https://yountsuniversalservices.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.M9QGVuj94BKDSQ480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Younts Universal Services LLC')
  AND LOWER(city) = LOWER(NULL)
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Davis Multi-Service Contracting',
  'davis-multi-service-contracting',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '151 Four Oclock Ln',
  34.07179260253906,
  -95.0401840209961,
  '(405) 240-6354',
  'https://davismsc.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.Hr1GXWxcYCrLtw480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Davis Multi-Service Contracting')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Nation Construction',
  'nation-construction',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '501 W Wilson St',
  34.004329681396484,
  -95.09962463378906,
  '(580) 933-7286',
  'https://nationconstructionllc.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Nation Construction')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Jones Heating & Air',
  'jones-heating-air',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  NULL,
  NULL,
  NULL,
  'Hugo, OK 74743',
  34.01699447631836,
  -95.36670684814453,
  '(580) 326-5626',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Jones Heating & Air')
  AND LOWER(city) = LOWER(NULL)
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Tri-Lakes Services',
  'tri-lakes-services',
  NULL,
  (SELECT id FROM categories WHERE name = 'Home Services' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '890 Ip Ln',
  33.999290466308594,
  -95.11299896240234,
  '(580) 933-1462',
  'https://trilakesservicesinc.com/contact-us/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Tri-Lakes Services')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Velvet Fringe salon',
  'velvet-fringe-salon',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '47 W Wilson St',
  34.004337310791016,
  -95.09364318847656,
  '(580) 392-9090',
  'http://www.salonvf.com/',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Velvet Fringe salon')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Studio Stylec Salon',
  'studio-stylec-salon',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Valliant',
  'OK',
  '74764',
  '14 N Dalton Ave',
  34.00273132324219,
  -95.09355163574219,
  '(580) 933-5263',
  'https://mapsyo.xyz/business/studio-stylec-salon-rq51da-A',
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Studio Stylec Salon')
  AND LOWER(city) = LOWER('Valliant')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Wright Cuts',
  'wright-cuts',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Wright City',
  'OK',
  '74766',
  '805 Main St',
  34.06614685058594,
  -95.00347137451172,
  '(580) 981-2837',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Wright Cuts')
  AND LOWER(city) = LOWER('Wright City')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'A Salon Vanessa''s Place (Hair Salon & Barbering)',
  'a-salon-vanessa-s-place-hair-salon-barbering',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '809 W Choctaw St',
  34.022335052490234,
  -94.7461166381836,
  '(580) 236-0055',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.lwi7lHnLEdnOFg480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('A Salon Vanessa''s Place (Hair Salon & Barbering)')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Salon 123 one twenty three',
  'salon-123-one-twenty-three',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '121 N Broadway St',
  34.02816390991211,
  -94.7385025024414,
  '(580) 584-6123',
  'https://salon123.glossgenius.com/',
  NULL,
  'https://www.bing.com/th?id=OLC.Jt7svMRUpal6KA480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Salon 123 one twenty three')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'New Reflections Hair Salon',
  'new-reflections-hair-salon',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '1408 S Park Dr',
  34.01250457763672,
  -94.74005126953125,
  '(580) 584-3250',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('New Reflections Hair Salon')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'The Salon',
  'the-salon',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '900 N Park Dr',
  34.03547286987305,
  -94.73922729492188,
  '(918) 721-5223',
  NULL,
  NULL,
  NULL,
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('The Salon')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'East Coast Flair Studio',
  'east-coast-flair-studio',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '903 N Park Dr',
  34.03572463989258,
  -94.73983001708984,
  '(580) 584-3909',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.Szbdpxr0FirddQ480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('East Coast Flair Studio')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Creative Techniques Hair salon',
  'creative-techniques-hair-salon',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '1210 S Park Dr',
  34.01356506347656,
  -94.73993682861328,
  '(580) 584-7224',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.RpRebeH76pRsrw480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Creative Techniques Hair salon')
  AND LOWER(city) = LOWER('Broken Bow')
);

INSERT OR IGNORE INTO businesses (
  name, slug, description, category_id, city, state, zip_code,
  address_line1, latitude, longitude, phone, website,
  facebook_url, image_url, service_area, is_active, is_featured, is_verified
)
SELECT
  'Westen & Company',
  'westen-company',
  NULL,
  (SELECT id FROM categories WHERE name = 'Beauty & Personal Care' LIMIT 1),
  'Broken Bow',
  'OK',
  '74728',
  '254 Spencer Rd',
  34.04508590698242,
  -94.68724060058594,
  '(580) 584-6334',
  NULL,
  NULL,
  'https://www.bing.com/th?id=OLC.ka2s1f9TcaeKmA480x360&pid=Local',
  'Southeast Oklahoma',
  1,
  0,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM businesses
  WHERE LOWER(name) = LOWER('Westen & Company')
  AND LOWER(city) = LOWER('Broken Bow')
);
