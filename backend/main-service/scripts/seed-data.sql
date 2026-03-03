-- ============================================================================
-- SEED DATA FOR WEB3 MARKETPLACE (Schema V2)
-- File: backend/main-service/scripts/seed-data.sql
-- Run after docs/init_database.sql
-- ============================================================================

BEGIN;

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) Seed token whitelist (safe if already seeded)
-- ----------------------------------------------------------------------------
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, oracle_price_feed, is_active)
VALUES
  ('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 1, 6, '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', true),
  ('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1, 6, '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', true),
  ('DAI',  '0x6b175474e89094c44da98b954eedeac495271d0f', 1, 18, '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', true),
  ('USDT', '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 137, 6, '0x0A6513e40db6EB1b165753AD52E80663aeA50545', true),
  ('USDC', '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 137, 6, '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7', true)
ON CONFLICT (token_address, chain_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) Seed users (1 seller + 2 buyers + 1 admin)
-- ----------------------------------------------------------------------------
INSERT INTO users (
  email, wallet_address, password_hash, username, role, status, paypal_email
)
VALUES
  (
    'seller@marketplace.com',
    '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    '$2b$10$WliVVMKZzo7T4MFdtpKKWu798pjHIPwl4y6zGtnvisCDVAY7YSLHC',
    'Demo Seller',
    'seller',
    'active',
    'seller@paypal.test'
  ),
  (
    'buyer1@marketplace.com',
    '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
    '$2b$10$WliVVMKZzo7T4MFdtpKKWu798pjHIPwl4y6zGtnvisCDVAY7YSLHC',
    'Buyer One',
    'buyer',
    'active',
    'buyer1@paypal.test'
  ),
  (
    'buyer2@marketplace.com',
    '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
    '$2b$10$WliVVMKZzo7T4MFdtpKKWu798pjHIPwl4y6zGtnvisCDVAY7YSLHC',
    'Buyer Two',
    'buyer',
    'active',
    'buyer2@paypal.test'
  ),
  (
    'admin@marketplace.com',
    NULL,
    '$2b$10$WliVVMKZzo7T4MFdtpKKWu798pjHIPwl4y6zGtnvisCDVAY7YSLHC',
    'Admin Demo',
    'admin',
    'active',
    NULL
  )
ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) Seed 100 products + inventory (equivalent to seed-products.js)
-- ----------------------------------------------------------------------------
WITH seed_seller AS (
  SELECT user_id AS seller_id
  FROM users
  WHERE role = 'seller'
  ORDER BY user_id
  LIMIT 1
),
cfg AS (
  SELECT
    ARRAY['electronics','fashion','home','sports','books','toys']::text[] AS categories,
    ARRAY['Laptop','Smartphone','Tablet','Smartwatch','Headphones','Camera','Speaker','Monitor','Keyboard','Mouse']::text[] AS electronics_names,
    ARRAY['T-Shirt','Jeans','Dress','Jacket','Sneakers','Handbag','Sunglasses','Watch','Belt','Hat']::text[] AS fashion_names,
    ARRAY['Sofa','Table','Chair','Lamp','Rug','Mirror','Vase','Clock','Curtain','Pillow']::text[] AS home_names,
    ARRAY['Basketball','Football','Tennis Racket','Yoga Mat','Dumbbells','Bike','Skateboard','Helmet','Jersey','Shoes']::text[] AS sports_names,
    ARRAY['Novel','Cookbook','Biography','Textbook','Comic','Magazine','Dictionary','Atlas','Guide','Journal']::text[] AS books_names,
    ARRAY['Action Figure','Doll','Puzzle','Board Game','Robot','Car','Plane','Building Blocks','Teddy Bear','Yo-Yo']::text[] AS toys_names,
    ARRAY['Premium','Deluxe','Pro','Elite','Ultimate','Classic','Modern','Vintage','Limited','Special']::text[] AS brands,
    ARRAY['Amazing','Awesome','Best','Quality','Top','Great','Super','Mega','Ultra','Perfect']::text[] AS adjectives,
    ARRAY['USDT','USDC','DAI','MATIC','ETH']::text[] AS tokens
),
gen AS (
  SELECT
    g.i,
    (cfg.categories[1 + FLOOR(random() * array_length(cfg.categories, 1))::int]) AS category,
    cfg.electronics_names,
    cfg.fashion_names,
    cfg.home_names,
    cfg.sports_names,
    cfg.books_names,
    cfg.toys_names,
    cfg.brands,
    cfg.adjectives,
    cfg.tokens
  FROM generate_series(1, 100) AS g(i)
  CROSS JOIN cfg
),
prepared AS (
  SELECT
    i,
    category,
    CASE category
      WHEN 'electronics' THEN electronics_names[1 + FLOOR(random() * array_length(electronics_names, 1))::int]
      WHEN 'fashion' THEN fashion_names[1 + FLOOR(random() * array_length(fashion_names, 1))::int]
      WHEN 'home' THEN home_names[1 + FLOOR(random() * array_length(home_names, 1))::int]
      WHEN 'sports' THEN sports_names[1 + FLOOR(random() * array_length(sports_names, 1))::int]
      WHEN 'books' THEN books_names[1 + FLOOR(random() * array_length(books_names, 1))::int]
      ELSE toys_names[1 + FLOOR(random() * array_length(toys_names, 1))::int]
    END AS base_name,
    brands[1 + FLOOR(random() * array_length(brands, 1))::int] AS brand,
    adjectives[1 + FLOOR(random() * array_length(adjectives, 1))::int] AS adjective,
    ROUND((10 + random() * 990)::numeric, 2) AS price_usd,
    (1 + FLOOR(random() * 100)::int) AS stock,
    tokens
  FROM gen
),
inserted_products AS (
  INSERT INTO products (seller_id, name, description, base_price_usd, metadata, status)
  SELECT
    s.seller_id,
    CONCAT(p.adjective, ' ', p.brand, ' ', p.base_name) AS name,
    CONCAT(
      'High quality ', LOWER(p.base_name),
      ' for sale. ', p.adjective, ' condition, ', LOWER(p.brand),
      ' brand. Perfect for everyday use.'
    ) AS description,
    p.price_usd,
    jsonb_build_object(
      'category', p.category,
      'images', jsonb_build_array('/placeholder-product.svg'),
      'accepted_tokens', jsonb_build_object(
        'crypto',
        to_jsonb(
          ARRAY(
            SELECT DISTINCT t
            FROM unnest(p.tokens) AS t
            ORDER BY random()
            LIMIT (2 + FLOOR(random() * 3)::int)
          )
        ),
        'fiat',
        CASE WHEN random() > 0.5
          THEN jsonb_build_array('paypal')
          ELSE '[]'::jsonb
        END
      ),
      'attributes', jsonb_build_object(
        'brand', p.brand,
        'condition', 'New'
      ),
      'seed_tag', 'seed-data.sql'
    ) AS metadata,
    'active'
  FROM prepared p
  CROSS JOIN seed_seller s
  RETURNING product_id
),
numbered_products AS (
  SELECT product_id, row_number() OVER (ORDER BY product_id) AS rn
  FROM inserted_products
),
prepared_stock AS (
  SELECT
    np.product_id,
    (1 + FLOOR(random() * 100)::int) AS stock
  FROM numbered_products np
)
INSERT INTO inventory (product_id, total_stock, available, reserved, version)
SELECT product_id, stock, stock, 0, 0
FROM prepared_stock;

-- ----------------------------------------------------------------------------
-- 4) Seed sample orders/payments/disputes for UI testing
-- ----------------------------------------------------------------------------
WITH ids AS (
  SELECT
    (SELECT user_id FROM users WHERE email = 'seller@marketplace.com' LIMIT 1) AS seller_id,
    (SELECT user_id FROM users WHERE email = 'buyer1@marketplace.com' LIMIT 1) AS buyer1_id,
    (SELECT user_id FROM users WHERE email = 'buyer2@marketplace.com' LIMIT 1) AS buyer2_id,
    (SELECT token_id FROM token_whitelist WHERE symbol = 'USDC' AND chain_id = 137 LIMIT 1) AS token_id
),
picked_products AS (
  SELECT p.product_id, p.base_price_usd, p.seller_id
  FROM products p
  WHERE p.seller_id = (SELECT seller_id FROM ids)
    AND p.metadata->>'seed_tag' = 'seed-data.sql'
  ORDER BY p.product_id
  LIMIT 12
),
seed_orders AS (
  INSERT INTO orders (
    internal_order_id,
    buyer_id,
    seller_id,
    product_id,
    quantity,
    price_usd,
    token_id,
    amount_token,
    chain_id,
    escrow_contract,
    payment_method,
    status,
    metadata
  )
  SELECT
    gen_random_uuid()::text,
    CASE WHEN row_number() OVER (ORDER BY pp.product_id) % 2 = 0
      THEN (SELECT buyer1_id FROM ids)
      ELSE (SELECT buyer2_id FROM ids)
    END,
    pp.seller_id,
    pp.product_id,
    (1 + FLOOR(random() * 3)::int) AS quantity,
    ROUND((pp.base_price_usd * (1 + FLOOR(random() * 3)::int))::numeric, 2) AS price_usd,
    (SELECT token_id FROM ids),
    ROUND((pp.base_price_usd / 1.0)::numeric, 6),
    137,
    '0x0000000000000000000000000000000000000000',
    CASE WHEN random() > 0.5 THEN 'crypto' ELSE 'paypal' END,
    CASE
      WHEN random() < 0.20 THEN 'UNPAID'
      WHEN random() < 0.45 THEN 'PAID'
      WHEN random() < 0.70 THEN 'DELIVERING'
      WHEN random() < 0.90 THEN 'COMPLETED'
      ELSE 'DISPUTED'
    END,
    jsonb_build_object('note', 'Seeded order for testing')
  FROM picked_products pp
  RETURNING order_id, buyer_id, seller_id, status
)
INSERT INTO payments (
  order_id,
  tx_hash,
  chain_id,
  from_address,
  to_address,
  block_number,
  block_timestamp,
  gas_used,
  gas_price,
  status,
  verified_by_rpc,
  verified_by_indexer,
  confirmations
)
SELECT
  o.order_id,
  CONCAT('0x', md5(random()::text || clock_timestamp()::text), md5(random()::text || clock_timestamp()::text)),
  137,
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  '0x0000000000000000000000000000000000000000',
  (1000000 + FLOOR(random() * 100000)::bigint),
  NOW() - (FLOOR(random() * 72)::text || ' hours')::interval,
  (21000 + FLOOR(random() * 50000)::bigint),
  30000000000,
  CASE WHEN o.status IN ('PAID', 'DELIVERING', 'COMPLETED') THEN 'confirmed' ELSE 'pending' END,
  true,
  CASE WHEN random() > 0.4 THEN true ELSE false END,
  (1 + FLOOR(random() * 50)::int)
FROM seed_orders o
WHERE o.status IN ('PAID', 'DELIVERING', 'COMPLETED');

-- Add 2 sample disputes if enough disputed orders exist
INSERT INTO disputes (order_id, raised_by, reason, evidence_urls, status, resolution)
SELECT
  o.order_id,
  o.buyer_id,
  'Item not as described',
  ARRAY['https://example.com/evidence-1.jpg', 'https://example.com/evidence-2.jpg'],
  'open',
  NULL
FROM orders o
WHERE o.status = 'DISPUTED'
ORDER BY o.created_at DESC
LIMIT 2;

COMMIT;

-- ============================================================================
-- Quick verification
-- ============================================================================
SELECT 'users' AS table_name, COUNT(*) AS total FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'disputes', COUNT(*) FROM disputes
ORDER BY table_name;

