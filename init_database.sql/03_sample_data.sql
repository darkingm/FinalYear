-- =====================================================
-- SAMPLE DATA FOR WEB3 MARKETPLACE
-- Testing & Demonstration Data
--
-- Prerequisites: run docs/web3_marketplace_schema.sql first
-- Matches the live schema as of 2026-02-25
-- =====================================================

BEGIN;

-- Enable pgcrypto for gen_random_uuid() and crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- SECTION 1: USERS & AUTHENTICATION
-- =====================================================

-- password_hash = bcrypt('password123')
-- wallet_address is optional (NULL for OAuth-only users)
INSERT INTO users (email, wallet_address, username, password_hash, google_id, avatar_url, paypal_email, role, status) VALUES
('admin@marketplace.com',   NULL,                                          'admin_master',  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NULL, NULL, NULL, 'admin', 'active'),
('john.buyer@email.com',    '0x2345678901234567890123456789012345678901',   'john_buyer',    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NULL, NULL, 'john.buyer@paypal.test', 'buyer', 'active'),
('jane.seller@email.com',   '0x3456789012345678901234567890123456789012',   'jane_tech',     '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NULL, NULL, 'jane.seller@paypal.test', 'seller', 'active'),
('mike.seller@email.com',   '0x4567890123456789012345678901234567890123',   'mike_fashion',  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', NULL, NULL, 'mike.seller@paypal.test', 'seller', 'active'),
('sarah.buyer@email.com',   '0x5678901234567890123456789012345678901234',   'sarah_shopper', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'google_sarah_123', 'https://lh3.googleusercontent.com/a/default-user', 'sarah.buyer@paypal.test', 'buyer', 'active')
ON CONFLICT (email) DO NOTHING;

-- Insert seller profiles
-- user_id references: jane_tech = id from row 3, mike_fashion = id from row 4
-- We use a subquery to resolve user_id by email to avoid hardcoding IDs
INSERT INTO seller_profiles (user_id, display_name, description, payout_wallet, kyc_status, kyc_verified_at, rating_avg, total_sales)
SELECT user_id, 'TechGadgets Pro', 'Premium electronics and gadgets', '0x3456789012345678901234567890123456789012', 'verified', NOW() - INTERVAL '30 days', 4.85, 150
FROM users WHERE email = 'jane.seller@email.com'
UNION ALL
SELECT user_id, 'Fashion Avenue', 'Trendy clothing and accessories', '0x4567890123456789012345678901234567890123', 'verified', NOW() - INTERVAL '60 days', 4.60, 89
FROM users WHERE email = 'mike.seller@email.com'
ON CONFLICT (user_id) DO NOTHING;

-- Insert shipping addresses
INSERT INTO addresses (user_id, full_name, phone, country, province, district, address_line, postal_code, is_default)
SELECT user_id, 'John Doe', '+1-555-0101', 'US', 'California', 'San Francisco', '123 Main St, Apt 4B', '94102', TRUE
FROM users WHERE email = 'john.buyer@email.com'
UNION ALL
SELECT user_id, 'John Doe', '+1-555-0101', 'US', 'New York', 'Manhattan', '456 Park Ave', '10001', FALSE
FROM users WHERE email = 'john.buyer@email.com'
UNION ALL
SELECT user_id, 'Sarah Smith', '+1-555-0202', 'US', 'Texas', 'Austin', '789 Oak Drive', '73301', TRUE
FROM users WHERE email = 'sarah.buyer@email.com';

-- =====================================================
-- SECTION 2: WAREHOUSES & INVENTORY SETUP
-- =====================================================

INSERT INTO warehouses (name, code, country, province, address, status) VALUES
('West Coast Warehouse', 'WH-WC-001', 'US', 'California', '1000 Warehouse Blvd, Los Angeles, CA 90001', 'active'),
('East Coast Warehouse', 'WH-EC-001', 'US', 'New York',   '2000 Distribution Dr, New York, NY 10001',   'active'),
('Central Warehouse',    'WH-CT-001', 'US', 'Texas',      '3000 Logistics Ln, Dallas, TX 75201',        'active')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SECTION 3: PRODUCTS & CATALOG
-- =====================================================

-- Products from TechGadgets Pro (seller_id resolved dynamically)
WITH tech_seller AS (
  SELECT sp.seller_id
  FROM seller_profiles sp
  JOIN users u ON sp.user_id = u.user_id
  WHERE u.email = 'jane.seller@email.com'
  LIMIT 1
),
fashion_seller AS (
  SELECT sp.seller_id
  FROM seller_profiles sp
  JOIN users u ON sp.user_id = u.user_id
  WHERE u.email = 'mike.seller@email.com'
  LIMIT 1
),
inserted_products AS (
  INSERT INTO products (seller_id, name, description, category, base_price_usd, metadata, status)
  -- TechGadgets Pro products
  SELECT ts.seller_id, n, d, c, p,
         jsonb_build_object('category', c, 'images', jsonb_build_array('/placeholder-product.svg'), 'seed_tag', 'sample_data.sql'),
         'active'
  FROM tech_seller ts,
  (VALUES
    ('Premium Wireless Headphones', 'High-fidelity wireless headphones with active noise cancellation', 'Electronics', 299.99::DECIMAL),
    ('Smart Watch Pro',             'Advanced fitness tracker with heart rate monitoring',               'Electronics', 399.99),
    ('Portable Bluetooth Speaker',  'Waterproof speaker with 20-hour battery life',                     'Electronics',  79.99),
    ('USB-C Hub 7-in-1',            'Multi-port adapter for laptops and tablets',                       'Electronics',  49.99),
    ('Wireless Charging Pad',       'Fast wireless charger compatible with all Qi devices',             'Electronics',  29.99)
  ) AS v(n, d, c, p)
  UNION ALL
  -- Fashion Avenue products
  SELECT fs.seller_id, n, d, c, p,
         jsonb_build_object('category', c, 'images', jsonb_build_array('/placeholder-product.svg'), 'seed_tag', 'sample_data.sql'),
         'active'
  FROM fashion_seller fs,
  (VALUES
    ('Premium Cotton T-Shirt',  'Soft, breathable cotton tee in multiple colors',           'Clothing',     24.99::DECIMAL),
    ('Denim Jeans Classic Fit', 'Comfortable denim jeans with classic styling',             'Clothing',     59.99),
    ('Leather Wallet',          'Genuine leather bifold wallet with RFID protection',       'Accessories',  39.99),
    ('Unisex Backpack',         'Durable canvas backpack with laptop compartment',          'Accessories',  69.99),
    ('Sunglasses UV400',        'Polarized sunglasses with UV protection',                  'Accessories',  89.99)
  ) AS v(n, d, c, p)
  RETURNING product_id, name
),
numbered AS (
  SELECT product_id, name, ROW_NUMBER() OVER (ORDER BY product_id) AS rn
  FROM inserted_products
)
-- Save product IDs for later sections using a temp table
SELECT * INTO TEMP tmp_products FROM numbered;

-- Insert product images using the temp table
INSERT INTO product_images (product_id, image_url, sort_order, is_primary, alt_text)
SELECT p.product_id, url, ord, prim, alt
FROM tmp_products p
JOIN (VALUES
  (1, 'https://images.example.com/headphones-main.jpg',  1, TRUE,  'Wireless headphones main view'),
  (1, 'https://images.example.com/headphones-side.jpg',  2, FALSE, 'Wireless headphones side view'),
  (1, 'https://images.example.com/headphones-case.jpg',  3, FALSE, 'Headphones with case'),
  (2, 'https://images.example.com/smartwatch-main.jpg',  1, TRUE,  'Smart watch display'),
  (2, 'https://images.example.com/smartwatch-black.jpg', 2, FALSE, 'Smart watch black'),
  (3, 'https://images.example.com/speaker-main.jpg',     1, TRUE,  'Bluetooth speaker'),
  (4, 'https://images.example.com/usb-hub-main.jpg',     1, TRUE,  'USB-C hub'),
  (5, 'https://images.example.com/charger-main.jpg',     1, TRUE,  'Wireless charging pad'),
  (6, 'https://images.example.com/tshirt-white.jpg',     1, TRUE,  'White cotton t-shirt'),
  (6, 'https://images.example.com/tshirt-black.jpg',     2, FALSE, 'Black cotton t-shirt'),
  (7, 'https://images.example.com/jeans-blue.jpg',       1, TRUE,  'Blue denim jeans'),
  (8, 'https://images.example.com/wallet-brown.jpg',     1, TRUE,  'Brown leather wallet'),
  (9, 'https://images.example.com/backpack-main.jpg',    1, TRUE,  'Canvas backpack'),
  (10,'https://images.example.com/sunglasses-main.jpg',  1, TRUE,  'Polarized sunglasses')
) AS img(rn, url, ord, prim, alt) ON p.rn = img.rn;

-- Insert inventory (product_id resolved via temp table, warehouse by code)
INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved, version)
SELECT p.product_id, w.warehouse_id, stock, avail, res, 0
FROM tmp_products p
JOIN (VALUES
  -- TechGadgets products → West Coast warehouse (WH-WC-001)
  (1,  'WH-WC-001', 100, 95,  5),
  (2,  'WH-WC-001',  75, 70,  5),
  (3,  'WH-WC-001', 150, 148, 2),
  (4,  'WH-WC-001', 200, 200, 0),
  (5,  'WH-WC-001', 180, 175, 5),
  -- Fashion products → East Coast warehouse (WH-EC-001)
  (6,  'WH-EC-001', 500, 480, 20),
  (7,  'WH-EC-001', 300, 290, 10),
  (8,  'WH-EC-001', 150, 145,  5),
  (9,  'WH-EC-001', 200, 195,  5),
  (10, 'WH-EC-001', 100,  98,  2)
) AS inv(rn, wh, stock, avail, res) ON p.rn = inv.rn
JOIN warehouses w ON w.code = inv.wh;

-- Insert product variants (inventory_id resolved via product_id → inventory lookup)
INSERT INTO product_variants (product_id, sku, attributes, inventory_id, status)
SELECT p.product_id, sku, attrs::jsonb, i.inventory_id, 'active'
FROM tmp_products p
JOIN (VALUES
  -- Headphones variants (rn=1)
  (1, 'HP-WH-BLK-001', '{"color": "black"}'),
  (1, 'HP-WH-WHT-001', '{"color": "white"}'),
  (1, 'HP-WH-SLV-001', '{"color": "silver"}'),
  -- Smart Watch variants (rn=2)
  (2, 'SW-PR-BLK-42', '{"color": "black", "size": "42mm"}'),
  (2, 'SW-PR-BLK-46', '{"color": "black", "size": "46mm"}'),
  (2, 'SW-PR-SLV-42', '{"color": "silver", "size": "42mm"}'),
  -- T-Shirt variants (rn=6)
  (6, 'TS-CT-WHT-S',  '{"color": "white", "size": "S"}'),
  (6, 'TS-CT-WHT-M',  '{"color": "white", "size": "M"}'),
  (6, 'TS-CT-WHT-L',  '{"color": "white", "size": "L"}'),
  (6, 'TS-CT-WHT-XL', '{"color": "white", "size": "XL"}'),
  (6, 'TS-CT-BLK-S',  '{"color": "black", "size": "S"}'),
  (6, 'TS-CT-BLK-M',  '{"color": "black", "size": "M"}'),
  (6, 'TS-CT-BLK-L',  '{"color": "black", "size": "L"}'),
  (6, 'TS-CT-BLK-XL', '{"color": "black", "size": "XL"}'),
  -- Jeans variants (rn=7)
  (7, 'JN-DN-BLU-30', '{"color": "blue", "waist": "30"}'),
  (7, 'JN-DN-BLU-32', '{"color": "blue", "waist": "32"}'),
  (7, 'JN-DN-BLU-34', '{"color": "blue", "waist": "34"}'),
  (7, 'JN-DN-BLU-36', '{"color": "blue", "waist": "36"}')
) AS v(rn, sku, attrs) ON p.rn = v.rn
JOIN inventory i ON i.product_id = p.product_id;

-- =====================================================
-- SECTION 4: CRYPTO TOKENS
-- =====================================================

INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, oracle_price_feed, is_active) VALUES
('ETH',  '0x0000000000000000000000000000000000000000', 1,   18, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', TRUE),
('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 1,    6, '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', TRUE),
('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1,    6, '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', TRUE),
('DAI',  '0x6b175474e89094c44da98b954eedeac495271d0f', 1,   18, '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', TRUE),
('WETH', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 1,   18, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', TRUE),
-- Polygon tokens (used by payment-service)
('USDT', '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 137,   6, '0x0A6513e40db6EB1b165753AD52E80663aeA50545', TRUE),
('USDC', '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 137,   6, '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7', TRUE)
ON CONFLICT (token_address, chain_id) DO NOTHING;

-- Insert exchange rates (snapshot)
INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, rate, 'Chainlink'
FROM token_whitelist tw
JOIN (VALUES
  ('ETH',  1, 2450.50::DECIMAL),
  ('USDT', 1, 1.00),
  ('USDC', 1, 1.00),
  ('DAI',  1, 1.00),
  ('WETH', 1, 2450.50)
) AS v(sym, cid, rate) ON tw.symbol = v.sym AND tw.chain_id = v.cid;

-- =====================================================
-- SECTION 5: SHOPPING CARTS
-- =====================================================

INSERT INTO carts (user_id, status)
SELECT user_id, 'active' FROM users WHERE email = 'john.buyer@email.com'
UNION ALL
SELECT user_id, 'active' FROM users WHERE email = 'sarah.buyer@email.com';

-- Add items to John's cart (cart 1)
INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_snapshot)
SELECT c.cart_id, p1.product_id, pv1.variant_id, 1, 299.99
FROM carts c
JOIN users u ON c.user_id = u.user_id AND u.email = 'john.buyer@email.com'
CROSS JOIN tmp_products p1
LEFT JOIN product_variants pv1 ON pv1.product_id = p1.product_id AND pv1.sku = 'HP-WH-BLK-001'
WHERE p1.rn = 1
LIMIT 1;

INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_snapshot)
SELECT c.cart_id, p3.product_id, NULL, 1, 79.99
FROM carts c
JOIN users u ON c.user_id = u.user_id AND u.email = 'john.buyer@email.com'
CROSS JOIN tmp_products p3
WHERE p3.rn = 3
LIMIT 1;

-- =====================================================
-- SECTION 6: ORDERS & PAYMENTS
-- =====================================================

-- We resolve all foreign keys dynamically
WITH ids AS (
  SELECT
    (SELECT user_id FROM users WHERE email = 'john.buyer@email.com')  AS john_id,
    (SELECT user_id FROM users WHERE email = 'sarah.buyer@email.com') AS sarah_id,
    (SELECT sp.seller_id FROM seller_profiles sp JOIN users u ON sp.user_id = u.user_id WHERE u.email = 'jane.seller@email.com')  AS tech_seller_id,
    (SELECT sp.seller_id FROM seller_profiles sp JOIN users u ON sp.user_id = u.user_id WHERE u.email = 'mike.seller@email.com') AS fashion_seller_id,
    (SELECT address_id FROM addresses a JOIN users u ON a.user_id = u.user_id WHERE u.email = 'john.buyer@email.com'  AND a.is_default = TRUE) AS john_addr,
    (SELECT address_id FROM addresses a JOIN users u ON a.user_id = u.user_id WHERE u.email = 'sarah.buyer@email.com' AND a.is_default = TRUE) AS sarah_addr
),
seed_orders AS (
  INSERT INTO orders (
    buyer_id, seller_id, shipping_address_id, order_number,
    product_id, internal_order_id,
    quantity, price_usd, subtotal, shipping_fee, total_amount,
    payment_method, status, metadata
  )
  SELECT * FROM (
    VALUES
      -- Order 1: John bought Smart Watch Pro from TechGadgets (delivered)
      ((SELECT john_id FROM ids), (SELECT tech_seller_id FROM ids), (SELECT john_addr FROM ids),
       'ORD-2024-00001',
       (SELECT product_id FROM tmp_products WHERE rn = 2), gen_random_uuid()::text,
       1, 399.99::DECIMAL, 399.99::DECIMAL, 15.00::DECIMAL, 414.99::DECIMAL,
       'crypto', 'delivered', '{"note": "Seeded order"}'::jsonb),
      -- Order 2: Sarah bought T-Shirts from Fashion Avenue (delivered)
      ((SELECT sarah_id FROM ids), (SELECT fashion_seller_id FROM ids), (SELECT sarah_addr FROM ids),
       'ORD-2024-00002',
       (SELECT product_id FROM tmp_products WHERE rn = 6), gen_random_uuid()::text,
       3, 24.99::DECIMAL, 74.97::DECIMAL, 10.00::DECIMAL, 84.97::DECIMAL,
       'crypto', 'delivered', '{"note": "Seeded order"}'::jsonb),
      -- Order 3: John bought Headphones from TechGadgets (shipped)
      ((SELECT john_id FROM ids), (SELECT tech_seller_id FROM ids), (SELECT john_addr FROM ids),
       'ORD-2024-00003',
       (SELECT product_id FROM tmp_products WHERE rn = 1), gen_random_uuid()::text,
       2, 299.99::DECIMAL, 599.98::DECIMAL, 15.00::DECIMAL, 614.98::DECIMAL,
       'crypto', 'shipped', '{"note": "Seeded order"}'::jsonb),
      -- Order 4: Sarah bought Jeans from Fashion Avenue (processing)
      ((SELECT sarah_id FROM ids), (SELECT fashion_seller_id FROM ids), (SELECT sarah_addr FROM ids),
       'ORD-2024-00004',
       (SELECT product_id FROM tmp_products WHERE rn = 7), gen_random_uuid()::text,
       1, 59.99::DECIMAL, 59.99::DECIMAL, 10.00::DECIMAL, 69.99::DECIMAL,
       'paypal', 'processing', '{"note": "Seeded order"}'::jsonb)
  ) AS v(buyer_id, seller_id, shipping_address_id, order_number,
         product_id, internal_order_id,
         quantity, price_usd, subtotal, shipping_fee, total_amount,
         payment_method, status, metadata)
  RETURNING order_id, order_number, buyer_id, seller_id, status, product_id
)
SELECT * INTO TEMP tmp_orders FROM seed_orders;

-- Add order items
INSERT INTO order_items (order_id, product_id, variant_id, quantity, price_snapshot, subtotal)
SELECT o.order_id, o.product_id, pv.variant_id, qty, price, sub
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', 'SW-PR-BLK-42', 1, 399.99::DECIMAL, 399.99::DECIMAL),
  ('ORD-2024-00002', 'TS-CT-WHT-S',  2,  24.99,           49.98),
  ('ORD-2024-00003', 'HP-WH-BLK-001',2, 299.99,          599.98),
  ('ORD-2024-00004', 'JN-DN-BLU-32', 1,  59.99,           59.99)
) AS v(onum, sku, qty, price, sub) ON o.order_number = v.onum
LEFT JOIN product_variants pv ON pv.sku = v.sku;

-- Create order_payments (for the schema's order_payments table)
INSERT INTO order_payments (order_id, token_id, amount, tx_hash, chain_id, block_number, status, verified_by_rpc, verified_by_indexer, confirmations)
SELECT o.order_id, tw.token_id, amt, txh, 1, blk, st, rpc, idx, conf
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', 'USDT', 414.990000::DECIMAL(36,18), '0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234', 18500000::BIGINT, 'confirmed', TRUE, TRUE,  15),
  ('ORD-2024-00002', 'USDC',  84.970000,                 '0xefab5678901234efab5678901234efab5678901234efab5678901234efab5678', 18500100,          'confirmed', TRUE, TRUE,  12),
  ('ORD-2024-00003', 'ETH',    0.251020000000000000,     '0x1234abcd5678efab1234abcd5678efab1234abcd5678efab1234abcd5678efab', 18500200,          'confirmed', TRUE, TRUE,   8),
  ('ORD-2024-00004', 'USDT',  69.990000,                 '0x9876fedc5432ba109876fedc5432ba109876fedc5432ba109876fedc5432ba10', 18500250,          'confirmed',TRUE, FALSE,  3)
) AS v(onum, sym, amt, txh, blk, st, rpc, idx, conf) ON o.order_number = v.onum
JOIN token_whitelist tw ON tw.symbol = v.sym AND tw.chain_id = 1;

-- Create payments (for the payment-service's payments table)
INSERT INTO payments (order_id, tx_hash, chain_id, status, from_address, to_address, block_number, verified_by_rpc, verified_by_indexer, confirmations)
SELECT o.order_id, txh, 1, st,
       '0x2345678901234567890123456789012345678901',  -- buyer address placeholder
       '0x0000000000000000000000000000000000000000',  -- escrow contract placeholder
       blk, rpc, idx, conf
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', '0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234', 18500000::BIGINT, 'confirmed', TRUE, TRUE,  15),
  ('ORD-2024-00002', '0xefab5678901234efab5678901234efab5678901234efab5678901234efab5678', 18500100,          'confirmed', TRUE, TRUE,  12),
  ('ORD-2024-00003', '0x1234abcd5678efab1234abcd5678efab1234abcd5678efab1234abcd5678efab', 18500200,          'confirmed', TRUE, TRUE,   8),
  ('ORD-2024-00004', '0x9876fedc5432ba109876fedc5432ba109876fedc5432ba109876fedc5432ba10', 18500250,          'confirmed',TRUE, FALSE,  3)
) AS v(onum, txh, blk, st, rpc, idx, conf) ON o.order_number = v.onum
WHERE o.status IN ('delivered', 'shipped', 'processing');

-- Create shipments
INSERT INTO shipments (order_id, carrier, tracking_code, shipping_fee, status, shipped_at, delivered_at)
SELECT o.order_id, carrier, track, fee, st, ship, deliv
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', 'FedEx', 'FDX1234567890',  15.00::DECIMAL, 'delivered',  NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),
  ('ORD-2024-00002', 'USPS',  'USPS9876543210', 10.00,          'delivered',  NOW() - INTERVAL '8 days',  NOW() - INTERVAL '5 days'),
  ('ORD-2024-00003', 'DHL',   'DHL5555666677',  15.00,          'in_transit', NOW() - INTERVAL '2 days',  NULL::TIMESTAMP)
) AS v(onum, carrier, track, fee, st, ship, deliv) ON o.order_number = v.onum;

-- Create platform fees
INSERT INTO platform_fees (order_id, fee_amount_usd, fee_percentage, collector_wallet, status)
SELECT o.order_id, fee, pct, '0x9999999999999999999999999999999999999999', st
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', 12.45::DECIMAL, 3.00::DECIMAL, 'collected'),
  ('ORD-2024-00002',  2.55,          3.00,          'collected'),
  ('ORD-2024-00003', 18.45,          3.00,          'collected'),
  ('ORD-2024-00004',  2.10,          3.00,          'pending')
) AS v(onum, fee, pct, st) ON o.order_number = v.onum;

-- =====================================================
-- SECTION 7: REVIEWS
-- =====================================================

INSERT INTO reviews (order_id, product_id, buyer_id, rating, comment, status)
SELECT o.order_id, o.product_id, o.buyer_id, rating, cmt, 'published'
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', 5, 'Excellent smart watch! Battery life is amazing and the fitness tracking is very accurate.'),
  ('ORD-2024-00002', 4, 'Good quality t-shirt, very comfortable. Color is exactly as shown.')
) AS v(onum, rating, cmt) ON o.order_number = v.onum;

-- =====================================================
-- SECTION 8: NOTIFICATIONS
-- =====================================================

INSERT INTO notifications (user_id, type, title, message, is_read)
SELECT user_id, t, title, msg, rd
FROM users u
JOIN (VALUES
  ('john.buyer@email.com',  'order',   'Order Shipped',     'Your order #ORD-2024-00003 has been shipped via DHL. Tracking: DHL5555666677', FALSE),
  ('john.buyer@email.com',  'order',   'Order Delivered',   'Your order #ORD-2024-00001 has been delivered!', TRUE),
  ('sarah.buyer@email.com', 'order',   'Order Delivered',   'Your order #ORD-2024-00002 has been delivered!', TRUE),
  ('sarah.buyer@email.com', 'payment', 'Payment Confirmed', 'Your payment of 84.97 USDC has been confirmed.', TRUE)
) AS v(email, t, title, msg, rd) ON u.email = v.email;

-- =====================================================
-- SECTION 9: COUPONS
-- =====================================================

INSERT INTO coupons (code, discount_type, discount_value, min_purchase, max_uses, used_count, valid_from, valid_until, status) VALUES
('WELCOME10', 'percentage', 10.00, 50.00,  100, 12,  NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 'active'),
('SAVE20',    'fixed',      20.00, 100.00,  50,  8,  NOW() - INTERVAL '15 days', NOW() + INTERVAL '45 days', 'active'),
('FLASH50',   'percentage', 50.00, 200.00,  20, 20,  NOW() - INTERVAL '5 days',  NOW() - INTERVAL '1 day',  'expired'),
('NEWUSER15', 'percentage', 15.00, 30.00, 1000, 145, NOW() - INTERVAL '60 days', NOW() + INTERVAL '30 days', 'active')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- SECTION 10: INVENTORY LOCKS (ACTIVE)
-- =====================================================

INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status)
SELECT i.inventory_id, NULL, 2, NOW() + INTERVAL '10 minutes', 'active'
FROM tmp_products p
JOIN inventory i ON i.product_id = p.product_id
WHERE p.rn = 1
LIMIT 1;

INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status)
SELECT i.inventory_id, NULL, 1, NOW() + INTERVAL '12 minutes', 'active'
FROM tmp_products p
JOIN inventory i ON i.product_id = p.product_id
WHERE p.rn = 6
LIMIT 1;

-- =====================================================
-- SECTION 11: AUDIT LOGS
-- =====================================================

INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, changed_by)
SELECT 'order', o.order_id, act, old::jsonb, new::jsonb,
       (SELECT user_id FROM users WHERE email = 'admin@marketplace.com')
FROM tmp_orders o
JOIN (VALUES
  ('ORD-2024-00001', 'status_changed', '{"status": "confirmed"}', '{"status": "shipped"}'),
  ('ORD-2024-00001', 'status_changed', '{"status": "shipped"}',   '{"status": "delivered"}')
) AS v(onum, act, old, new) ON o.order_number = v.onum;

-- Clean up temp tables
DROP TABLE IF EXISTS tmp_products;
DROP TABLE IF EXISTS tmp_orders;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

SELECT 'Total Users:' as metric, COUNT(*) as count FROM users
UNION ALL SELECT 'Total Sellers:',          COUNT(*) FROM seller_profiles
UNION ALL SELECT 'Total Products:',         COUNT(*) FROM products
UNION ALL SELECT 'Total Orders:',           COUNT(*) FROM orders
UNION ALL SELECT 'Total Order Payments:',   COUNT(*) FROM order_payments
UNION ALL SELECT 'Total Payments:',         COUNT(*) FROM payments
UNION ALL SELECT 'Total Reviews:',          COUNT(*) FROM reviews
UNION ALL SELECT 'Total Inventory:',        COUNT(*) FROM inventory
UNION ALL SELECT 'Active Carts:',           COUNT(*) FROM carts WHERE status = 'active'
UNION ALL SELECT 'Active Locks:',           COUNT(*) FROM inventory_locks WHERE status = 'active';

-- Show product ratings
SELECT p.product_id, p.name, p.rating_avg, p.review_count
FROM products p WHERE p.review_count > 0
ORDER BY p.rating_avg DESC;

-- Show inventory status
SELECT p.name AS product_name, w.name AS warehouse_name, i.total_stock, i.available, i.reserved
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN warehouses w ON i.warehouse_id = w.warehouse_id
ORDER BY p.product_id;

-- Show recent orders with payment status
SELECT o.order_number, u.email AS buyer_email, o.total_amount, o.payment_method,
       o.status AS order_status, op.amount AS paid_amount, tw.symbol AS payment_token, op.status AS payment_status
FROM orders o
JOIN users u ON o.buyer_id = u.user_id
LEFT JOIN order_payments op ON o.order_id = op.order_id
LEFT JOIN token_whitelist tw ON op.token_id = tw.token_id
ORDER BY o.created_at DESC;

-- =====================================================
-- END OF SAMPLE DATA
-- =====================================================

SELECT 'Sample data inserted successfully!' AS message;