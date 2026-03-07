-- =====================================================
-- SEED DATA  (02_seed_data.sql)
-- 50 sample products across 5 categories
-- =====================================================
-- Execution order (dependency chain):
--   users → seller_profiles → warehouses
--   → products → product_images
--   → inventory (per product + warehouse)
--   → product_variants (after inventory)
--   → token_whitelist → exchange_rates
--   → coupons
-- =====================================================

BEGIN;

-- =====================================================
-- 1. USERS
-- =====================================================

INSERT INTO users (email, username, password_hash, role, status, email_verified, wallet_address)
VALUES
-- admin
('admin@marketplace.com',
 'admin',
 '$2b$12$adminHashPlaceholder00000000000000000000000000',
 'admin', 'active', TRUE,
 '0x000000000000000000000000000000000000DEAD'),

-- sellers
('seller1@marketplace.com',
 'techseller',
 '$2b$12$sellerHash1Placeholder000000000000000000000000',
 'seller', 'active', TRUE,
 '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa'),

('seller2@marketplace.com',
 'fashionista',
 '$2b$12$sellerHash2Placeholder000000000000000000000000',
 'seller', 'active', TRUE,
 '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb'),

('seller3@marketplace.com',
 'homedeco',
 '$2b$12$sellerHash3Placeholder000000000000000000000000',
 'seller', 'active', TRUE,
 '0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc'),

-- buyers
('buyer1@marketplace.com',
 'buyer_alice',
 '$2b$12$buyerHash1Placeholder0000000000000000000000000',
 'buyer', 'active', TRUE, NULL),

('buyer2@marketplace.com',
 'buyer_bob',
 '$2b$12$buyerHash2Placeholder0000000000000000000000000',
 'buyer', 'active', TRUE, NULL)

ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- 2. SELLER PROFILES
-- =====================================================

INSERT INTO seller_profiles (user_id, display_name, description, slug, kyc_status, payout_wallet)
SELECT user_id,
       'TechZone Store',
       'Premium electronics & gadgets from top brands.',
       'techzone-store',
       'verified',
       '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa'
FROM users WHERE email = 'seller1@marketplace.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO seller_profiles (user_id, display_name, description, slug, kyc_status, payout_wallet)
SELECT user_id,
       'Fashion Hub',
       'Trendy fashion for men & women – sustainable & stylish.',
       'fashion-hub',
       'verified',
       '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb'
FROM users WHERE email = 'seller2@marketplace.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO seller_profiles (user_id, display_name, description, slug, kyc_status, payout_wallet)
SELECT user_id,
       'Home Deco Plus',
       'Quality home furnishings & decor that transform spaces.',
       'home-deco-plus',
       'verified',
       '0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc'
FROM users WHERE email = 'seller3@marketplace.com'
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 3. WAREHOUSES
-- =====================================================

INSERT INTO warehouses (name, code, country, province, address, status)
VALUES
('Main Warehouse – US',  'WH-US-01', 'US', 'California',    '123 Warehouse Blvd, San Francisco, CA 94103',   'active'),
('Fashion Warehouse – VN','WH-VN-01','VN', 'Ho Chi Minh',   '456 Nguyen Hue, District 1, HCMC',              'active'),
('APAC Fulfillment',     'WH-SG-01', 'SG', 'Central Region','789 Toa Payoh Industrial Park, Singapore 319263','active')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 4. TOKEN WHITELIST
-- =====================================================

INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
('MATIC', '0x0000000000000000000000000000000000001010', 137,   18, TRUE),
('USDT',  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 137,   6,  TRUE),
('USDC',  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 137,   6,  TRUE),
('ETH',   '0x0000000000000000000000000000000000000000', 1,     18, TRUE),
('WBTC',  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', 1,     8,  TRUE)
ON CONFLICT (token_address, chain_id) DO NOTHING;

-- =====================================================
-- 5. EXCHANGE RATES
-- =====================================================

INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 0.62,    'CoinGecko' FROM token_whitelist WHERE symbol='MATIC' AND chain_id=137
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 1.00,    'CoinGecko' FROM token_whitelist WHERE symbol='USDT'  AND chain_id=137
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 1.00,    'CoinGecko' FROM token_whitelist WHERE symbol='USDC'  AND chain_id=137
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 3200.00, 'CoinGecko' FROM token_whitelist WHERE symbol='ETH'   AND chain_id=1
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 62000.00,'CoinGecko' FROM token_whitelist WHERE symbol='WBTC'  AND chain_id=1
ON CONFLICT DO NOTHING;

-- =====================================================
-- 6. PRODUCTS  (50 total)
--    Electronics: 20 | Fashion: 20 | Home & Living: 10
--    NOTE: status='active' so they appear in catalog
--    inventory_consistency: total_stock = available + reserved (both start equal/0 reserved)
-- =====================================================

-- helper function to get seller_id by slug
-- We use a DO block so we can use variables cleanly.


DO $$
DECLARE
    sid1      BIGINT;
    sid2      BIGINT;
    sid3      BIGINT;
    wh1       BIGINT;
    wh2       BIGINT;
    inv_id    BIGINT;
    pid       BIGINT;
    tok_matic INT;
    tok_usdt  INT;
    tok_usdc  INT;
    tok_eth   INT;
    tok_wbtc  INT;
BEGIN
    SELECT seller_id    INTO sid1 FROM seller_profiles WHERE slug = 'techzone-store';
    SELECT seller_id    INTO sid2 FROM seller_profiles WHERE slug = 'fashion-hub';
    SELECT seller_id    INTO sid3 FROM seller_profiles WHERE slug = 'home-deco-plus';
    SELECT warehouse_id INTO wh1  FROM warehouses       WHERE code = 'WH-US-01';
    SELECT warehouse_id INTO wh2  FROM warehouses       WHERE code = 'WH-VN-01';
    SELECT token_id     INTO tok_matic FROM token_whitelist WHERE symbol='MATIC' AND chain_id=137;
    SELECT token_id     INTO tok_usdt  FROM token_whitelist WHERE symbol='USDT'  AND chain_id=137;
    SELECT token_id     INTO tok_usdc  FROM token_whitelist WHERE symbol='USDC'  AND chain_id=137;
    SELECT token_id     INTO tok_eth   FROM token_whitelist WHERE symbol='ETH'   AND chain_id=1;
    SELECT token_id     INTO tok_wbtc  FROM token_whitelist WHERE symbol='WBTC'  AND chain_id=1;

    -- ELECTRONICS (sid1, wh1): 1-5 MATIC | 6-10 USDT | 11-15 ETH | 16-20 USDC

    -- 1 MacBook Pro 14 M3
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, is_featured, metadata)
    VALUES (sid1, 'MacBook Pro 14 M3', 'Apple MacBook Pro 14-inch with M3 chip, 16 GB RAM, 512 GB SSD.', 'electronics', 1999, tok_matic, ROUND(1999/0.62::NUMERIC,6), 'active', TRUE, '{"brand":"Apple","warranty":"1 year"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 30, 30, 0);

    -- 2 iPhone 15 Pro Max
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'iPhone 15 Pro Max', 'Apple iPhone 15 Pro Max 256 GB Titanium Black. A17 Pro chip.', 'electronics', 1199, tok_matic, ROUND(1199/0.62::NUMERIC,6), 'active', '{"brand":"Apple","storage":"256GB"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1696446702183-cbd13bc0e0eb?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 50, 50, 0);

    -- 3 Samsung Galaxy S24 Ultra
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Samsung Galaxy S24 Ultra', 'Galaxy S24 Ultra 512 GB. Snapdragon 8 Gen 3, 200 MP quad camera.', 'electronics', 1299, tok_matic, ROUND(1299/0.62::NUMERIC,6), 'active', '{"brand":"Samsung","storage":"512GB"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 40, 40, 0);

    -- 4 Sony WH-1000XM5 Headphones
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Sony WH-1000XM5 Headphones', 'Industry-leading noise-cancelling wireless headphones. 30-hr battery.', 'electronics', 349, tok_matic, ROUND(349/0.62::NUMERIC,6), 'active', '{"brand":"Sony","type":"Over-ear"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 80, 80, 0);

    -- 5 iPad Pro 12.9 M2
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'iPad Pro 12.9 M2', 'Apple iPad Pro 12.9-inch with M2 chip, 256 GB Wi-Fi. For creatives.', 'electronics', 1099, tok_matic, ROUND(1099/0.62::NUMERIC,6), 'active', '{"brand":"Apple","storage":"256GB"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 25, 25, 0);

    -- ELECTRONICS 6-10: USDT

    -- 6 ASUS ROG Zephyrus G14
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'ASUS ROG Zephyrus G14', '14 gaming laptop, Ryzen 9 7940HS, RTX 4060 8 GB, 16 GB RAM.', 'electronics', 1499, tok_usdt, 1499, 'active', '{"brand":"ASUS","gpu":"RTX 4060"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 20, 20, 0);

    -- 7 Dell XPS 15 OLED
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Dell XPS 15 OLED', '15 OLED laptop, Core i7-13700H, RTX 4060, 32 GB RAM.', 'electronics', 1799, tok_usdt, 1799, 'active', '{"brand":"Dell","display":"OLED"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 15, 15, 0);

    -- 8 Apple Watch Series 9
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Apple Watch Series 9', 'Apple Watch Series 9 GPS 45 mm Midnight. Health sensors.', 'electronics', 429, tok_usdt, 429, 'active', '{"brand":"Apple","size":"45mm"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 60, 60, 0);

    -- 9 Logitech MX Master 3S
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Logitech MX Master 3S', 'Advanced wireless mouse. 8K DPI, near-silent clicks, 70-day battery.', 'electronics', 99, tok_usdt, 99, 'active', '{"brand":"Logitech","dpi":8000}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 120, 120, 0);

    -- 10 Keychron Q5 Keyboard
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Keychron Q5 Keyboard', 'Full-size 96pct hot-swap mechanical keyboard, Gateron G Pro switches.', 'electronics', 179, tok_usdt, 179, 'active', '{"brand":"Keychron","layout":"96pct"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 70, 70, 0);

    -- ELECTRONICS 11-15: ETH

    -- 11 Sony PlayStation 5
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Sony PlayStation 5', 'PS5 console with DualSense controller. Ultra-high-speed SSD, 4K gameplay.', 'electronics', 499, tok_eth, ROUND(499/3200::NUMERIC,6), 'active', '{"brand":"Sony","resolution":"4K"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 35, 35, 0);

    -- 12 NVIDIA GeForce RTX 4080
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'NVIDIA GeForce RTX 4080', 'RTX 4080 16 GB GDDR6X MSI Gaming X Trio edition.', 'electronics', 1199, tok_eth, ROUND(1199/3200::NUMERIC,6), 'active', '{"brand":"MSI","vram":"16GB"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 18, 18, 0);

    -- 13 GoPro HERO12 Black
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'GoPro HERO12 Black', '5.3K60 video, HyperSmooth 6.0 stabilisation, waterproof to 10 m.', 'electronics', 399, tok_eth, ROUND(399/3200::NUMERIC,6), 'active', '{"brand":"GoPro","resolution":"5.3K"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1617297695641-4b12b96afe05?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 45, 45, 0);

    -- 14 DJI Mini 4 Pro Drone
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'DJI Mini 4 Pro Drone', 'Foldable drone, 4K/60fps HDR video, 20 km transmission.', 'electronics', 759, tok_eth, ROUND(759/3200::NUMERIC,6), 'active', '{"brand":"DJI","max_range_km":20}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 22, 22, 0);

    -- 15 Samsung Odyssey G9 Monitor
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Samsung Odyssey G9 Monitor', '49 curved gaming monitor, QHD 240 Hz, 1 ms GTG.', 'electronics', 1299, tok_eth, ROUND(1299/3200::NUMERIC,6), 'active', '{"brand":"Samsung","refresh_rate":"240Hz"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 12, 12, 0);

    -- ELECTRONICS 16-20: USDC

    -- 16 AirPods Pro 2nd Gen
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'AirPods Pro 2nd Gen', 'Active Noise Cancellation, Adaptive Audio, Personalised Spatial Audio.', 'electronics', 249, tok_usdc, 249, 'active', '{"brand":"Apple","anc":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 90, 90, 0);

    -- 17 Razer BlackWidow V4 Pro
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Razer BlackWidow V4 Pro', 'Wireless mechanical keyboard, Razer Yellow switches, per-key RGB.', 'electronics', 229, tok_usdc, 229, 'active', '{"brand":"Razer","switch":"Yellow Linear"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 55, 55, 0);

    -- 18 Anker 737 Power Bank 24000
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Anker 737 Power Bank 24000', '24000 mAh, 140 W max output, charges MacBook Pro in 73 min.', 'electronics', 159, tok_usdc, 159, 'active', '{"brand":"Anker","capacity_mah":24000}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 100, 100, 0);

    -- 19 Elgato Stream Deck MK.2
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Elgato Stream Deck MK.2', '15 customisable LCD keys, direct studio control, plugin ecosystem.', 'electronics', 149, tok_usdc, 149, 'active', '{"brand":"Elgato","keys":15}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 60, 60, 0);

    -- 20 Kindle Paperwhite 11th Gen
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid1, 'Kindle Paperwhite 11th Gen', '6.8 300 ppi display, warm light, 10-week battery, waterproof IPX8.', 'electronics', 139, tok_usdc, 139, 'active', '{"brand":"Amazon","waterproof":"IPX8"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 110, 110, 0);

    -- FASHION (sid2, wh2): 21-25 MATIC | 26-30 USDT | 31-35 MATIC | 36-40 USDT

    -- 21 Men's Classic Oxford Shirt
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Men's Classic Oxford Shirt', 'Premium 100pct Egyptian cotton Oxford shirt. Slim-fit, button-down collar.', 'fashion', 59, tok_matic, ROUND(59/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"Egyptian Cotton"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0);

    -- 22 Women's Wrap Midi Dress
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Women's Wrap Midi Dress', 'Floral wrap midi dress in sustainable viscose. Adjustable tie waist.', 'fashion', 79, tok_matic, ROUND(79/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"Viscose"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 150, 150, 0);

    -- 23 Men's Slim Fit Chino Pants
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Men's Slim Fit Chino Pants', '97pct cotton chino pants with stretch. Available in 4 colours.', 'fashion', 49, tok_matic, ROUND(49/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"Cotton Stretch"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 180, 180, 0);

    -- 24 Leather Crossbody Bag
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Leather Crossbody Bag', 'Genuine full-grain leather crossbody bag. Adjustable strap, 4 pockets.', 'fashion', 129, tok_matic, ROUND(129/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"Full-grain Leather"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 80, 80, 0);

    -- 25 Women's Running Sneakers
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Women's Running Sneakers', 'Lightweight mesh running shoes, responsive foam sole, reflective accents.', 'fashion', 89, tok_matic, ROUND(89/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","sole":"Responsive Foam"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 160, 160, 0);

    -- 26 Unisex Puffer Jacket
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Unisex Puffer Jacket', 'Water-resistant puffer jacket with recycled fill. Packable.', 'fashion', 119, tok_usdt, 119, 'active', '{"brand":"FashionHub","material":"Recycled Fill"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 100, 100, 0);

    -- 27 Silk Scarf 90x90
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Silk Scarf 90x90', 'Hand-rolled 100pct silk twill scarf. Original artist print, gift-boxed.', 'fashion', 95, tok_usdt, 95, 'active', '{"brand":"FashionHub","material":"Silk Twill"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1601924351433-3d7688bf2f8d?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 70, 70, 0);

    -- 28 Men's Merino Wool Sweater
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Men's Merino Wool Sweater', 'Fine-knit 100pct merino wool crewneck. Naturally temperature-regulating.', 'fashion', 109, tok_usdt, 109, 'active', '{"brand":"FashionHub","material":"Merino Wool"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 90, 90, 0);

    -- 29 Canvas Backpack 20L
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Canvas Backpack 20L', 'Waxed canvas backpack, laptop sleeve 15in, vegan leather trims.', 'fashion', 85, tok_usdt, 85, 'active', '{"brand":"FashionHub","capacity_L":20}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 130, 130, 0);

    -- 30 Women's High-Rise Yoga Pants
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Women's High-Rise Yoga Pants', 'Four-way stretch fabric, squat-proof, side pockets for phone.', 'fashion', 69, tok_usdt, 69, 'active', '{"brand":"FashionHub","fabric":"4-way Stretch"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0);

    -- 31 Polarised Aviator Sunglasses
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Polarised Aviator Sunglasses', 'UV400 polarised lenses, lightweight titanium frame. Unisex.', 'fashion', 75, tok_matic, ROUND(75/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","uv":"UV400"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 120, 120, 0);

    -- 32 Leather Chelsea Boots
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Leather Chelsea Boots', 'Genuine leather Chelsea boots, elastic side panels, stacked heel.', 'fashion', 149, tok_matic, ROUND(149/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"Genuine Leather"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 80, 80, 0);

    -- 33 Cashmere Beanie Hat
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Cashmere Beanie Hat', '100pct Grade-A cashmere, one size fits most. Ribbed knit, super soft.', 'fashion', 45, tok_matic, ROUND(45/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"100pct Cashmere"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 150, 150, 0);

    -- 34 Slim Leather Wallet
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Slim Leather Wallet', 'Minimalist bi-fold genuine leather wallet, RFID blocking, 6-card slots.', 'fashion', 39, tok_matic, ROUND(39/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","rfid_blocking":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0);

    -- 35 Linen Wide-Leg Trousers
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Linen Wide-Leg Trousers', 'Breathable 100pct linen wide-leg trousers. Elastic waist, side pockets.', 'fashion', 65, tok_matic, ROUND(65/0.62::NUMERIC,6), 'active', '{"brand":"FashionHub","material":"100pct Linen"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ab3?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 140, 140, 0);

    -- 36 Structured Blazer
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Structured Blazer', 'Single-breasted structured blazer in premium suiting fabric.', 'fashion', 189, tok_usdt, 189, 'active', '{"brand":"FashionHub","fit":"Structured"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 60, 60, 0);

    -- 37 Terry Cloth Bathrobe
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Terry Cloth Bathrobe', '100pct Turkish cotton terry bathrobe. Shawl collar, 2 pockets.', 'fashion', 55, tok_usdt, 55, 'active', '{"brand":"FashionHub","material":"Turkish Cotton"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 90, 90, 0);

    -- 38 Straw Beach Hat
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Straw Beach Hat', 'Wide-brim natural straw hat with adjustable inner band. UPF 50+.', 'fashion', 35, tok_usdt, 35, 'active', '{"brand":"FashionHub","upf":"50+"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0);

    -- 39 Graphic Print Tee
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Graphic Print Tee', 'Heavyweight 100pct organic cotton unisex t-shirt. Screen-print graphic.', 'fashion', 29, tok_usdt, 29, 'active', '{"brand":"FashionHub","material":"Organic Cotton"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 300, 300, 0);

    -- 40 Denim Jacket Classic
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid2, 'Denim Jacket Classic', 'Classic denim jacket with chest pockets and button-up front. Unisex.', 'fashion', 99, tok_usdt, 99, 'active', '{"brand":"FashionHub","material":"100pct Denim"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 110, 110, 0);

    -- HOME (sid3, wh1): 41-45 USDC | 46-50 MATIC

    -- 41 Ergonomic Office Chair
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, is_featured, metadata)
    VALUES (sid3, 'Ergonomic Office Chair', 'Mesh back ergonomic chair, lumbar support, 4D armrests, 150 kg capacity.', 'home', 349, tok_usdc, 349, 'active', TRUE, '{"brand":"HomeDeco","armrests":"4D"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 40, 40, 0);

    -- 42 Standing Desk 140x70 cm
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Standing Desk 140x70 cm', 'Electric height-adjustable standing desk. 140x70 cm bamboo top, dual motor.', 'home', 599, tok_usdc, 599, 'active', '{"brand":"HomeDeco","motor":"Dual"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1593642634367-d91a135587b5?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 20, 20, 0);

    -- 43 Aromatherapy Diffuser 500ml
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Aromatherapy Diffuser 500ml', 'Ultrasonic essential-oil diffuser, 7-colour LED, 10-hr continuous mist.', 'home', 45, tok_usdc, 45, 'active', '{"brand":"HomeDeco","capacity_ml":500}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 150, 150, 0);

    -- 44 Bamboo Cutting Board Set 3-pc
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Bamboo Cutting Board Set 3-pc', 'Eco-friendly bamboo cutting board set, 3 sizes, juice groove.', 'home', 39, tok_usdc, 39, 'active', '{"brand":"HomeDeco","material":"Bamboo","pieces":3}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1528750717929-32abb73d3bd9?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 200, 200, 0);

    -- 45 Smart LED Bulb E27 4-pack
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Smart LED Bulb E27 4-pack', 'Tunable white + RGB Wi-Fi bulb, works with Alexa/Google Home, 800 lm.', 'home', 49, tok_usdc, 49, 'active', '{"brand":"HomeDeco","lumens":800,"pack":4}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 300, 300, 0);

    -- 46 Cast Iron Dutch Oven 5.5 qt
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Cast Iron Dutch Oven 5.5 qt', 'Enamelled cast-iron Dutch oven, oven-safe to 260 C. Includes lid.', 'home', 129, tok_matic, ROUND(129/0.62::NUMERIC,6), 'active', '{"brand":"HomeDeco","capacity_qt":5.5}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 60, 60, 0);

    -- 47 Memory Foam Pillow
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Memory Foam Pillow', 'Contour memory-foam pillow with cooling gel layer. Removable bamboo cover.', 'home', 59, tok_matic, ROUND(59/0.62::NUMERIC,6), 'active', '{"brand":"HomeDeco","fill":"Memory Foam"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 120, 120, 0);

    -- 48 Weighted Blanket 15 lb
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Weighted Blanket 15 lb', 'Glass-bead weighted blanket 15 lb. Promotes deeper sleep.', 'home', 89, tok_matic, ROUND(89/0.62::NUMERIC,6), 'active', '{"brand":"HomeDeco","weight_lb":15}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 80, 80, 0);

    -- 49 Air Purifier HEPA H13
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Air Purifier HEPA H13', 'True HEPA H13 air purifier, 380 m2/h CADR, removes 99.97pct particles.', 'home', 199, tok_matic, ROUND(199/0.62::NUMERIC,6), 'active', '{"brand":"HomeDeco","hepa":"H13"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 55, 55, 0);

    -- 50 Modular Shelving System
    INSERT INTO products (seller_id, name, description, category, base_price_usd, token_id, price_in_token, status, metadata)
    VALUES (sid3, 'Modular Shelving System', 'Wall-mounted modular wooden shelving, 25 kg per shelf.', 'home', 159, tok_matic, ROUND(159/0.62::NUMERIC,6), 'active', '{"brand":"HomeDeco","material":"Pine Wood"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 40, 40, 0);

END $$;


-- =====================================================
-- 7. COUPONS
-- =====================================================

INSERT INTO coupons (code, discount_type, discount_value, min_purchase, max_uses, valid_from, valid_until, status)
VALUES
('WELCOME10',  'percentage', 10.00,  0.00,   1000, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active'),
('TECH50',     'fixed',      50.00,  200.00, 500,  '2026-01-01 00:00:00', '2026-06-30 23:59:59', 'active'),
('FASHION20',  'percentage', 20.00,  50.00,  300,  '2026-01-01 00:00:00', '2026-09-30 23:59:59', 'active'),
('FREESHIP',   'fixed',       5.00,   0.00,  2000, '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active'),
('CRYPTO15',   'percentage', 15.00,  100.00, 200,  '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active')
ON CONFLICT (code) DO NOTHING;

COMMIT;


