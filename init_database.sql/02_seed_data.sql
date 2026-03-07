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
    sid1 BIGINT; -- TechZone
    sid2 BIGINT; -- Fashion Hub
    sid3 BIGINT; -- Home Deco
    wh1  BIGINT; -- WH-US-01
    wh2  BIGINT; -- WH-VN-01
    inv_id BIGINT;
    pid    BIGINT;
BEGIN
    SELECT seller_id INTO sid1 FROM seller_profiles WHERE slug = 'techzone-store';
    SELECT seller_id INTO sid2 FROM seller_profiles WHERE slug = 'fashion-hub';
    SELECT seller_id INTO sid3 FROM seller_profiles WHERE slug = 'home-deco-plus';
    SELECT warehouse_id INTO wh1 FROM warehouses WHERE code = 'WH-US-01';
    SELECT warehouse_id INTO wh2 FROM warehouses WHERE code = 'WH-VN-01';

    -- ─────────────────────────────────────────
    -- ELECTRONICS (seller1, wh1)
    -- ─────────────────────────────────────────

    -- 1
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, is_featured, metadata)
    VALUES (sid1, 'MacBook Pro 14" M3', 'Apple MacBook Pro 14-inch with M3 chip, 16 GB RAM, 512 GB SSD. Stunning Liquid Retina XDR display.', 'electronics', 1999.00, 'active', TRUE,
            '{"brand":"Apple","model":"MPHE3LL/A","warranty":"1 year"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary, alt_text) VALUES (pid, '/images/products/macbook-pro-14.jpg', 0, TRUE, 'MacBook Pro 14" M3');
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 30, 30, 0) RETURNING inventory_id INTO inv_id;

    -- 2
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'iPhone 15 Pro Max', 'Apple iPhone 15 Pro Max 256 GB – Titanium Black. A17 Pro chip, ProRAW camera.', 'electronics', 1199.00, 'active',
            '{"brand":"Apple","storage":"256GB","color":"Black Titanium"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary, alt_text) VALUES (pid, '/images/products/iphone-15-pro-max.jpg', 0, TRUE, 'iPhone 15 Pro Max');
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 50, 50, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, price_override, inventory_id, status)
    VALUES (pid, 'IP15PM-256-BLK', '{"storage":"256GB","color":"Black Titanium"}', 1199.00, inv_id, 'active'),
           (pid, 'IP15PM-512-NAT', '{"storage":"512GB","color":"Natural Titanium"}', 1399.00, inv_id, 'active');

    -- 3
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Samsung Galaxy S24 Ultra', 'Galaxy S24 Ultra 512 GB Titanium Gray. Snapdragon 8 Gen 3, 200 MP quad camera.', 'electronics', 1299.00, 'active',
            '{"brand":"Samsung","storage":"512GB"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/samsung-s24-ultra.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 40, 40, 0);

    -- 4
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Sony WH-1000XM5 Headphones', 'Industry-leading noise-cancelling wireless headphones. 30-hr battery life.', 'electronics', 349.00, 'active',
            '{"brand":"Sony","type":"Over-ear","battery_hours":30}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/sony-wh1000xm5.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 80, 80, 0);

    -- 5
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'iPad Pro 12.9" M2', 'Apple iPad Pro 12.9-inch with M2 chip, 256 GB Wi-Fi. Perfect for creatives.', 'electronics', 1099.00, 'active',
            '{"brand":"Apple","storage":"256GB","connectivity":"Wi-Fi"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/ipad-pro-129.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 25, 25, 0);

    -- 6
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'ASUS ROG Zephyrus G14', '14" gaming laptop, Ryzen 9 7940HS, RTX 4060 8 GB, 16 GB RAM, 1 TB NVMe.', 'electronics', 1499.00, 'active',
            '{"brand":"ASUS","gpu":"RTX 4060","cpu":"Ryzen 9 7940HS"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/asus-rog-g14.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 20, 20, 0);

    -- 7
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Dell XPS 15 OLED', '15" OLED laptop, Intel Core i7-13700H, RTX 4060, 32 GB RAM, 1 TB SSD.', 'electronics', 1799.00, 'active',
            '{"brand":"Dell","display":"OLED","cpu":"i7-13700H"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/dell-xps-15.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 15, 15, 0);

    -- 8
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Apple Watch Series 9', 'Apple Watch Series 9 GPS 45 mm – Midnight. Double Tap gesture, advanced health sensors.', 'electronics', 429.00, 'active',
            '{"brand":"Apple","size":"45mm","gps":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/apple-watch-s9.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 60, 60, 0);

    -- 9
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Logitech MX Master 3S', 'Advanced wireless mouse. 8 K DPI, near-silent clicks, 70-day battery.', 'electronics', 99.00, 'active',
            '{"brand":"Logitech","dpi":8000,"wireless":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/logitech-mx-master-3s.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 120, 120, 0);

    -- 10
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Mechanical Keyboard Keychron Q5', 'Full-size 96% hot-swap mechanical keyboard, Gateron G Pro switches.', 'electronics', 179.00, 'active',
            '{"brand":"Keychron","layout":"96%","switch":"Gateron G Pro"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/keychron-q5.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 70, 70, 0);

    -- 11
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Sony PlayStation 5', 'PS5 console with DualSense controller. Ultra-high-speed SSD, 4K gameplay.', 'electronics', 499.00, 'active',
            '{"brand":"Sony","storage":"825GB SSD","resolution":"4K"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/ps5-console.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 35, 35, 0);

    -- 12
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'NVIDIA GeForce RTX 4080', 'GPU: NVIDIA RTX 4080 16 GB GDDR6X – MSI Gaming X Trio edition.', 'electronics', 1199.00, 'active',
            '{"brand":"MSI","vram":"16GB","tdp":"320W"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/rtx-4080.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 18, 18, 0);

    -- 13
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'GoPro HERO12 Black', '5.3K60 video, HyperSmooth 6.0 stabilisation, waterproof to 10 m.', 'electronics', 399.00, 'active',
            '{"brand":"GoPro","resolution":"5.3K","waterproof_depth":"10m"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/gopro-hero12.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 45, 45, 0);

    -- 14
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'DJI Mini 4 Pro Drone', 'Foldable drone, 4K/60fps HDR video, 20 km transmission, 34-min flight time.', 'electronics', 759.00, 'active',
            '{"brand":"DJI","max_range_km":20,"flight_time_min":34}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/dji-mini-4-pro.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 22, 22, 0);

    -- 15
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Samsung 49" Odyssey G9 Monitor', 'Curved gaming monitor, QHD 240 Hz, 1 ms GTG, G-Sync compatible.', 'electronics', 1299.00, 'active',
            '{"brand":"Samsung","size":"49 inch","refresh_rate":"240Hz"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/samsung-odyssey-g9.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 12, 12, 0);

    -- 16
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'AirPods Pro 2nd Gen', 'Active Noise Cancellation, Adaptive Audio, Personalised Spatial Audio.', 'electronics', 249.00, 'active',
            '{"brand":"Apple","anc":true,"spatial_audio":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/airpods-pro-2.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 90, 90, 0);

    -- 17
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Razer BlackWidow V4 Pro', 'Wireless mechanical keyboard, Razer Yellow switches, per-key RGB.', 'electronics', 229.00, 'active',
            '{"brand":"Razer","switch":"Yellow Linear","wireless":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/razer-blackwidow-v4.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 55, 55, 0);

    -- 18
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Anker 737 Power Bank 24000', '24000 mAh, 140 W max output, charges MacBook Pro in 73 min.', 'electronics', 159.00, 'active',
            '{"brand":"Anker","capacity_mah":24000,"max_watt":140}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/anker-737-powerbank.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 100, 100, 0);

    -- 19
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Elgato Stream Deck MK.2', '15 customisable LCD keys, direct studio control, plugin ecosystem.', 'electronics', 149.00, 'active',
            '{"brand":"Elgato","keys":15,"usb":"Type-C"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/elgato-stream-deck.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 60, 60, 0);

    -- 20
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid1, 'Kindle Paperwhite 11th Gen', '6.8" 300 ppi display, warm light, 10-week battery, waterproof IPX8.', 'electronics', 139.00, 'active',
            '{"brand":"Amazon","storage":"8GB","waterproof":"IPX8"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/kindle-paperwhite.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 110, 110, 0);

    -- ─────────────────────────────────────────
    -- FASHION (seller2, wh2)
    -- ─────────────────────────────────────────

    -- 21
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Men''s Classic Oxford Shirt', 'Premium 100% Egyptian cotton Oxford shirt. Slim-fit, button-down collar.', 'fashion', 59.00, 'active',
            '{"brand":"FashionHub","material":"Egyptian Cotton"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/mens-oxford-shirt.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'MOS-S-WHT', '{"size":"S","color":"White"}', inv_id),
        (pid, 'MOS-M-WHT', '{"size":"M","color":"White"}', inv_id),
        (pid, 'MOS-L-WHT', '{"size":"L","color":"White"}', inv_id),
        (pid, 'MOS-XL-WHT','{"size":"XL","color":"White"}', inv_id),
        (pid, 'MOS-M-BLU', '{"size":"M","color":"Sky Blue"}', inv_id);

    -- 22
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Women''s Wrap Midi Dress', 'Floral wrap midi dress in sustainable viscose. Adjustable tie waist.', 'fashion', 79.00, 'active',
            '{"brand":"FashionHub","material":"Viscose","sustainable":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/womens-wrap-dress.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 150, 150, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'WWD-XS-FLR','{"size":"XS","color":"Floral Pink"}', inv_id),
        (pid, 'WWD-S-FLR', '{"size":"S","color":"Floral Pink"}',  inv_id),
        (pid, 'WWD-M-FLR', '{"size":"M","color":"Floral Pink"}',  inv_id),
        (pid, 'WWD-L-FLR', '{"size":"L","color":"Floral Pink"}',  inv_id);

    -- 23
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Men''s Slim Fit Chino Pants', '97% cotton chino pants with stretch. Available in 4 colours.', 'fashion', 49.00, 'active',
            '{"brand":"FashionHub","material":"Cotton Stretch"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/mens-chino-pants.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 180, 180, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'MCP-30-KHK','{"waist":"30","color":"Khaki"}', inv_id),
        (pid, 'MCP-32-KHK','{"waist":"32","color":"Khaki"}', inv_id),
        (pid, 'MCP-34-NVY','{"waist":"34","color":"Navy"}',  inv_id);

    -- 24
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Leather Crossbody Bag', 'Genuine full-grain leather crossbody bag. Adjustable strap, 4 pockets.', 'fashion', 129.00, 'active',
            '{"brand":"FashionHub","material":"Full-grain Leather"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/leather-crossbody-bag.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 80, 80, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'LCB-BLK','{"color":"Black"}', inv_id),
        (pid, 'LCB-TAN','{"color":"Tan"}',   inv_id),
        (pid, 'LCB-BRN','{"color":"Brown"}', inv_id);

    -- 25
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Women''s Running Sneakers', 'Lightweight mesh running shoes, responsive foam sole, reflective accents.', 'fashion', 89.00, 'active',
            '{"brand":"FashionHub","sole":"Responsive Foam","closure":"Lace-up"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/womens-running-sneakers.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 160, 160, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'WRS-36-WHT','{"eu_size":"36","color":"White"}', inv_id),
        (pid, 'WRS-37-WHT','{"eu_size":"37","color":"White"}', inv_id),
        (pid, 'WRS-38-WHT','{"eu_size":"38","color":"White"}', inv_id),
        (pid, 'WRS-39-BLK','{"eu_size":"39","color":"Black"}', inv_id),
        (pid, 'WRS-40-BLK','{"eu_size":"40","color":"Black"}', inv_id);

    -- 26
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Unisex Puffer Jacket', 'Water-resistant puffer jacket with recycled fill. Packable into chest pocket.', 'fashion', 119.00, 'active',
            '{"brand":"FashionHub","material":"Recycled Fill","packable":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/puffer-jacket.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 100, 100, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'UPJ-S-BLK', '{"size":"S","color":"Black"}',  inv_id),
        (pid, 'UPJ-M-BLK', '{"size":"M","color":"Black"}',  inv_id),
        (pid, 'UPJ-L-OLV', '{"size":"L","color":"Olive"}',  inv_id),
        (pid, 'UPJ-XL-OLV','{"size":"XL","color":"Olive"}', inv_id);

    -- 27
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Silk Scarf 90x90', 'Hand-rolled 100% silk twill scarf. Original artist print, gift-boxed.', 'fashion', 95.00, 'active',
            '{"brand":"FashionHub","material":"Silk Twill","size":"90x90 cm"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/silk-scarf.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 70, 70, 0);

    -- 28
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Men''s Merino Wool Sweater', 'Fine-knit 100% merino wool crewneck. Naturally temperature-regulating.', 'fashion', 109.00, 'active',
            '{"brand":"FashionHub","material":"100% Merino Wool"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/merino-sweater.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 90, 90, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'MMS-S-GRY', '{"size":"S","color":"Grey"}',  inv_id),
        (pid, 'MMS-M-GRY', '{"size":"M","color":"Grey"}',  inv_id),
        (pid, 'MMS-L-BLK', '{"size":"L","color":"Black"}', inv_id),
        (pid, 'MMS-XL-NVY','{"size":"XL","color":"Navy"}', inv_id);

    -- 29
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Canvas Backpack 20L', 'Waxed canvas backpack, laptop sleeve 15", vegan leather trims.', 'fashion', 85.00, 'active',
            '{"brand":"FashionHub","capacity_L":20,"laptop_fit":"15 inch"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/canvas-backpack.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 130, 130, 0);

    -- 30
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Women''s High-Rise Yoga Pants', 'Four-way stretch fabric, squat-proof, side pockets for phone.', 'fashion', 69.00, 'active',
            '{"brand":"FashionHub","fabric":"4-way Stretch","squat_proof":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/yoga-pants.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'WHRP-XS-BLK','{"size":"XS","color":"Black"}',  inv_id),
        (pid, 'WHRP-S-BLK', '{"size":"S","color":"Black"}',   inv_id),
        (pid, 'WHRP-M-BLK', '{"size":"M","color":"Black"}',   inv_id),
        (pid, 'WHRP-L-NVY', '{"size":"L","color":"Navy"}',    inv_id),
        (pid, 'WHRP-XL-NVY','{"size":"XL","color":"Navy"}',   inv_id);

    -- 31
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Polarised Aviator Sunglasses', 'UV400 polarised lenses, lightweight titanium frame. Unisex classic style.', 'fashion', 75.00, 'active',
            '{"brand":"FashionHub","uv":"UV400","frame":"Titanium"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/aviator-sunglasses.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 120, 120, 0);

    -- 32
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Leather Chelsea Boots', 'Genuine leather Chelsea boots, elastic side panels, stacked heel.', 'fashion', 149.00, 'active',
            '{"brand":"FashionHub","material":"Genuine Leather","heel":"Stacked"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/chelsea-boots.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 80, 80, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'LCB-EU40-BLK','{"eu_size":"40","color":"Black"}', inv_id),
        (pid, 'LCB-EU41-BLK','{"eu_size":"41","color":"Black"}', inv_id),
        (pid, 'LCB-EU42-BLK','{"eu_size":"42","color":"Black"}', inv_id),
        (pid, 'LCB-EU43-BRN','{"eu_size":"43","color":"Brown"}', inv_id);

    -- 33
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Cashmere Beanie Hat', '100% Grade-A cashmere, one size fits most. Ribbed knit, super soft.', 'fashion', 45.00, 'active',
            '{"brand":"FashionHub","material":"100% Cashmere"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/cashmere-beanie.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 150, 150, 0);

    -- 34
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Slim Leather Wallet', 'Minimalist bi-fold genuine leather wallet, RFID blocking, 6-card slots.', 'fashion', 39.00, 'active',
            '{"brand":"FashionHub","material":"Genuine Leather","rfid_blocking":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/slim-leather-wallet.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0);

    -- 35
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Linen Wide-Leg Trousers', 'Breathable 100% linen wide-leg trousers. Elastic waist, side pockets.', 'fashion', 65.00, 'active',
            '{"brand":"FashionHub","material":"100% Linen"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/linen-trousers.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 140, 140, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'LWLT-S-BEI','{"size":"S","color":"Beige"}',  inv_id),
        (pid, 'LWLT-M-BEI','{"size":"M","color":"Beige"}',  inv_id),
        (pid, 'LWLT-L-WHT','{"size":"L","color":"White"}',  inv_id),
        (pid, 'LWLT-XL-WHT','{"size":"XL","color":"White"}',inv_id);

    -- 36
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Structured Blazer', 'Single-breasted structured blazer in premium suiting fabric.', 'fashion', 189.00, 'active',
            '{"brand":"FashionHub","fit":"Structured","lining":"Full"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/structured-blazer.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 60, 60, 0);

    -- 37
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Terry Cloth Bathrobe', '100% Turkish cotton terry bathrobe. Shawl collar, 2 pockets.', 'fashion', 55.00, 'active',
            '{"brand":"FashionHub","material":"Turkish Cotton","collar":"Shawl"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/terry-bathrobe.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 90, 90, 0);

    -- 38
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Straw Beach Hat', 'Wide-brim natural straw hat with adjustable inner band. UPF 50+.', 'fashion', 35.00, 'active',
            '{"brand":"FashionHub","upf":"50+","brim":"Wide"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/straw-beach-hat.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 200, 200, 0);

    -- 39
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Graphic Print Tee', 'Heavyweight 100% organic cotton unisex t-shirt. Unique screen-print graphic.', 'fashion', 29.00, 'active',
            '{"brand":"FashionHub","material":"Organic Cotton","print":"Screen Print"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/graphic-tee.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 300, 300, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'GPT-S-WHT', '{"size":"S","color":"White"}',  inv_id),
        (pid, 'GPT-M-WHT', '{"size":"M","color":"White"}',  inv_id),
        (pid, 'GPT-L-BLK', '{"size":"L","color":"Black"}',  inv_id),
        (pid, 'GPT-XL-BLK','{"size":"XL","color":"Black"}', inv_id);

    -- 40
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid2, 'Denim Jacket Classic', 'Classic denim jacket with chest pockets and button-up front. Unisex.', 'fashion', 99.00, 'active',
            '{"brand":"FashionHub","material":"100% Denim","fit":"Relaxed"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/denim-jacket.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh2, 110, 110, 0) RETURNING inventory_id INTO inv_id;
    INSERT INTO product_variants (product_id, sku, attributes, inventory_id) VALUES
        (pid, 'DJC-S-BLU', '{"size":"S","color":"Blue"}',   inv_id),
        (pid, 'DJC-M-BLU', '{"size":"M","color":"Blue"}',   inv_id),
        (pid, 'DJC-L-BLK', '{"size":"L","color":"Black"}',  inv_id),
        (pid, 'DJC-XL-BLK','{"size":"XL","color":"Black"}', inv_id);

    -- ─────────────────────────────────────────
    -- HOME & LIVING (seller3, wh1)
    -- ─────────────────────────────────────────

    -- 41
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, is_featured, metadata)
    VALUES (sid3, 'Ergonomic Office Chair', 'Mesh back ergonomic chair, lumbar support, 4D armrests, 150 kg capacity.', 'home', 349.00, 'active', TRUE,
            '{"brand":"HomeDeco","max_weight_kg":150,"armrests":"4D"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/ergonomic-chair.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 40, 40, 0);

    -- 42
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Standing Desk 140x70 cm', 'Electric height-adjustable standing desk. 140 × 70 cm bamboo top, dual motor.', 'home', 599.00, 'active',
            '{"brand":"HomeDeco","top_material":"Bamboo","motor":"Dual","width_cm":140}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/standing-desk.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 20, 20, 0);

    -- 43
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Aromatherapy Diffuser 500ml', 'Ultrasonic essential-oil diffuser, 7-colour LED, 10-hr continuous mist.', 'home', 45.00, 'active',
            '{"brand":"HomeDeco","capacity_ml":500,"run_time_hr":10}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/aromatherapy-diffuser.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 150, 150, 0);

    -- 44
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Bamboo Cutting Board Set (3-pc)', 'Eco-friendly bamboo cutting board set, 3 sizes, juice groove, hanging holes.', 'home', 39.00, 'active',
            '{"brand":"HomeDeco","material":"Bamboo","pieces":3}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/bamboo-cutting-board.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 200, 200, 0);

    -- 45
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Smart LED Bulb E27 (4-pack)', 'Tunable white + RGB Wi-Fi bulb, works with Alexa/Google Home, 800 lm.', 'home', 49.00, 'active',
            '{"brand":"HomeDeco","lumens":800,"pack":4,"smart":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/smart-led-bulbs.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 300, 300, 0);

    -- 46
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Cast Iron Dutch Oven 5.5 qt', 'Enamelled cast-iron Dutch oven, oven-safe to 260°C. Includes lid.', 'home', 129.00, 'active',
            '{"brand":"HomeDeco","capacity_qt":5.5,"oven_safe_c":260,"enamel":true}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/cast-iron-dutch-oven.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 60, 60, 0);

    -- 47
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Memory Foam Pillow', 'Contour memory-foam pillow with cooling gel layer. Removable bamboo cover.', 'home', 59.00, 'active',
            '{"brand":"HomeDeco","fill":"Memory Foam","cover":"Bamboo"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/memory-foam-pillow.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 120, 120, 0);

    -- 48
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Weighted Blanket 15 lb', 'Glass-bead weighted blanket 15 lb / 60"×80". Promotes deeper sleep.', 'home', 89.00, 'active',
            '{"brand":"HomeDeco","weight_lb":15,"size":"60x80 inch"}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/weighted-blanket.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 80, 80, 0);

    -- 49
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Air Purifier HEPA H13', 'True HEPA H13 air purifier, 380 m²/h CADR, removes 99.97% particles, quiet mode 24 dB.', 'home', 199.00, 'active',
            '{"brand":"HomeDeco","cadr_m2h":380,"hepa":"H13","noise_db":24}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/air-purifier.jpg', 0, TRUE);
    INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES (pid, wh1, 55, 55, 0);

    -- 50
    INSERT INTO products (seller_id, name, description, category, base_price_usd, status, metadata)
    VALUES (sid3, 'Modular Shelving System', 'Wall-mounted modular wooden shelving, customisable layout, holds up to 25 kg per shelf.', 'home', 159.00, 'active',
            '{"brand":"HomeDeco","material":"Pine Wood","max_weight_kg_per_shelf":25}')
    RETURNING product_id INTO pid;
    INSERT INTO product_images (product_id, image_url, sort_order, is_primary) VALUES (pid, '/images/products/modular-shelving.jpg', 0, TRUE);
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

