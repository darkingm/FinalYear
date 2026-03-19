-- =====================================================
-- SEED: Coin-specific sample products
-- 3-5 products per coin × 8 coins ≈ 32 products
-- Run AFTER seed.sql (depends on seller_profiles + warehouses)
--
-- Usage:
--   psql -U main_user -d main_db -f seed_coin_products.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. EXTEND TOKEN WHITELIST (idempotent)
-- =====================================================

-- BTC (wrapped on Polygon mainnet — PoS WBTC)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES ('BTC', '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6', 137, 8, TRUE,
        '{"name":"Wrapped Bitcoin","type":"erc20","chain":"Polygon"}')
ON CONFLICT (token_address, chain_id) DO UPDATE SET is_active = TRUE;

-- ETH (already exists chain 1, add Polygon bridged ETH)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES ('ETH', '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', 137, 18, TRUE,
        '{"name":"Wrapped Ether","type":"erc20","chain":"Polygon"}')
ON CONFLICT (token_address, chain_id) DO UPDATE SET is_active = TRUE;

-- BNB (BSC testnet chain 97 — already has native from seed_testnet_tokens; add mainnet)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES ('BNB', '0x0000000000000000000000000000000000000000', 56, 18, TRUE,
        '{"name":"BNB","type":"native","chain":"BSC"}')
ON CONFLICT (token_address, chain_id) DO UPDATE SET is_active = TRUE;

-- SOL (placeholder ERC-20 representation on Polygon for demo)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES ('SOL', '0xd93f7e271cb87c23aaa73edc008a79646d1f9912', 137, 9, TRUE,
        '{"name":"Wrapped SOL","type":"erc20","chain":"Polygon"}')
ON CONFLICT (token_address, chain_id) DO UPDATE SET is_active = TRUE;

-- DOGE (Polygon bridged DOGE)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES ('DOGE', '0x9cb3ed4f0879e3d1a01a8f5a6d6b0c5f24e5ae13', 137, 8, TRUE,
        '{"name":"Wrapped DOGE","type":"erc20","chain":"Polygon"}')
ON CONFLICT (token_address, chain_id) DO UPDATE SET is_active = TRUE;

-- USDT/USDC/MATIC already in main seed.sql (chain 137); just ensure active
UPDATE token_whitelist SET is_active = TRUE
WHERE symbol IN ('USDT','USDC','MATIC') AND chain_id = 137;

-- =====================================================
-- 2. EXCHANGE RATES (approximate, for display)
-- =====================================================

INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 85000.00, 'Manual' FROM token_whitelist WHERE symbol='BTC'  AND chain_id=137 ON CONFLICT DO NOTHING;
INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 3100.00,  'Manual' FROM token_whitelist WHERE symbol='ETH'  AND chain_id=137 ON CONFLICT DO NOTHING;
INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 600.00,   'Manual' FROM token_whitelist WHERE symbol='BNB'  AND chain_id=56  ON CONFLICT DO NOTHING;
INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 145.00,   'Manual' FROM token_whitelist WHERE symbol='SOL'  AND chain_id=137 ON CONFLICT DO NOTHING;
INSERT INTO exchange_rates (token_id, usd_rate, source)
SELECT token_id, 0.18,     'Manual' FROM token_whitelist WHERE symbol='DOGE' AND chain_id=137 ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. PRODUCTS  (DO block — needs seller + warehouse)
-- =====================================================

DO $$
DECLARE
  sid1  BIGINT; -- TechZone Store
  sid2  BIGINT; -- Fashion Hub
  sid3  BIGINT; -- Home Deco Plus
  wh1   BIGINT; -- WH-US-01
  wh2   BIGINT; -- WH-VN-01

  tok_btc   INT;
  tok_eth   INT;
  tok_bnb   INT;
  tok_sol   INT;
  tok_usdt  INT;
  tok_usdc  INT;
  tok_matic INT;
  tok_doge  INT;

  pid BIGINT;
BEGIN
  SELECT seller_id INTO sid1 FROM seller_profiles WHERE slug='techzone-store';
  SELECT seller_id INTO sid2 FROM seller_profiles WHERE slug='fashion-hub';
  SELECT seller_id INTO sid3 FROM seller_profiles WHERE slug='home-deco-plus';
  SELECT warehouse_id INTO wh1 FROM warehouses WHERE code='WH-US-01';
  SELECT warehouse_id INTO wh2 FROM warehouses WHERE code='WH-VN-01';

  SELECT token_id INTO tok_btc   FROM token_whitelist WHERE symbol='BTC'   AND chain_id=137;
  SELECT token_id INTO tok_eth   FROM token_whitelist WHERE symbol='ETH'   AND chain_id=137;
  SELECT token_id INTO tok_bnb   FROM token_whitelist WHERE symbol='BNB'   AND chain_id=56;
  SELECT token_id INTO tok_sol   FROM token_whitelist WHERE symbol='SOL'   AND chain_id=137;
  SELECT token_id INTO tok_usdt  FROM token_whitelist WHERE symbol='USDT'  AND chain_id=137;
  SELECT token_id INTO tok_usdc  FROM token_whitelist WHERE symbol='USDC'  AND chain_id=137;
  SELECT token_id INTO tok_matic FROM token_whitelist WHERE symbol='MATIC' AND chain_id=137;
  SELECT token_id INTO tok_doge  FROM token_whitelist WHERE symbol='DOGE'  AND chain_id=137;

  -- ─── BTC Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Ledger Nano X','Hardware wallet supporting 5500+ coins. Bluetooth + USB-C. Best-in-class cold storage.','electronics',149.00,'active','{"brand":"Ledger","coins_supported":5500}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=800',0,TRUE,'Ledger Nano X');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,60,60,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_btc,0.00175,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Trezor Model T','Open-source hardware wallet with touchscreen. Full BTC/ETH/ERC-20 support.','electronics',219.00,'active','{"brand":"Trezor","display":"Touchscreen"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1642790551116-18e4f6fa4aba?w=800',0,TRUE,'Trezor Model T');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,40,40,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_btc,0.00257,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Bitcoin Miner Antminer S19k','Bitmain Antminer S19k Pro — 120 TH/s, 2760W. Proven BTC mining performance.','electronics',1899.00,'active','{"brand":"Bitmain","hashrate":"120 TH/s","power_w":2760}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=800',0,TRUE,'Antminer S19k');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,8,8,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_btc,0.02234,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Bitcoin Logo Hoodie','Premium cotton hoodie with embroidered BTC logo. Unisex, sizes S–3XL.','fashion',65.00,'active','{"brand":"CryptoWear","material":"90% Cotton 10% Poly"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=800',0,TRUE,'BTC Hoodie');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,200,200,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_btc,0.000765,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'ColdCard Mk4 Wallet','Air-gapped Bitcoin-only signing device. PSBT, NFC, USB-C.','electronics',199.00,'active','{"brand":"Coinkite","bitcoin_only":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',0,TRUE,'ColdCard Mk4');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,30,30,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_btc,0.00234,TRUE);

  -- ─── ETH Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'MetaMask Hardware Bundle','MetaMask + Keystone Pro bundle. Best ETH/EVM hot-cold combo.','electronics',189.00,'active','{"brand":"MetaMask","chains":"EVM All"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1657299143792-f0df42c8b0c7?w=800',0,TRUE,'MetaMask Bundle');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,45,45,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_eth,0.061,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Ethereum Logo T-Shirt','Heavyweight 220gsm organic cotton tee with ETH diamond logo.','fashion',39.00,'active','{"brand":"CryptoWear","material":"Organic Cotton 220gsm"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',0,TRUE,'ETH T-Shirt');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,300,300,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_eth,0.01258,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Ethereum Node Server Pre-built','Mini-PC pre-configured Ethereum full node — 2TB SSD, 32GB RAM, NUC13.','electronics',899.00,'active','{"brand":"Custom","storage":"2TB NVMe","ram":"32GB"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',0,TRUE,'Ethereum Node');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,10,10,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_eth,0.29,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid3,'Ethereum Neon Wall Art','LED neon ETH diamond sign. USB powered, dimmable, 40cm × 40cm.','home',89.00,'active','{"brand":"NeonCraft","size":"40x40cm","power":"USB"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',0,TRUE,'ETH Neon Sign');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,80,80,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_eth,0.0287,TRUE);

  -- ─── BNB Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Binance Smart Watch','Custom BNB-branded smartwatch — fitness tracking + crypto alerts on wrist.','electronics',299.00,'active','{"brand":"BinanceGear","platform":"BSC"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800',0,TRUE,'BNB Smartwatch');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,50,50,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_bnb,0.498,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'BNB Chain Hoodie','Pullover hoodie with BNB Chain logo. Premium 350gsm fleece.','fashion',75.00,'active','{"brand":"CryptoWear","weight_gsm":350}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=800',0,TRUE,'BNB Hoodie');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,150,150,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_bnb,0.125,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'DeFi Yield Farming Guide Book','500-page physical hardcover book on BSC DeFi, yield farming, and tokenomics.','electronics',49.00,'active','{"pages":500,"cover":"Hardcover","edition":"2025"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800',0,TRUE,'DeFi Guide Book');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,200,200,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_bnb,0.0817,TRUE);

  -- ─── SOL Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Solana Saga 2 Phone','Solana Saga 2 Android phone with native Solana Pay, Seed Vault, dApp Store.','electronics',599.00,'active','{"brand":"Solana Mobile","os":"Android 14","storage":"512GB"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800',0,TRUE,'Solana Saga 2');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,25,25,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_sol,4.13,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Solana Logo Cap','Embroidered Solana gradient logo cap. Adjustable snapback, one size.','fashion',35.00,'active','{"brand":"CryptoWear","closure":"Snapback"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800',0,TRUE,'Solana Cap');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,250,250,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_sol,0.241,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Phantom Wallet Sticker Pack','50-pack holographic stickers featuring Solana, Phantom, and Web3 meme designs.','electronics',12.00,'active','{"count":50,"finish":"Holographic","waterproof":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1558618047-f7da25f46c7f?w=800',0,TRUE,'Sticker Pack');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,500,500,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_sol,0.0828,TRUE);

  -- ─── USDT Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Logitech G502 X Plus Mouse','Wireless gaming mouse, 100–25600 DPI, LIGHTFORCE hybrid switches.','electronics',159.00,'active','{"brand":"Logitech","dpi":25600,"wireless":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800',0,TRUE,'G502 X Plus');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,90,90,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_usdt,159.00,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid3,'Smart Desk Lamp RGB','USB-C powered smart lamp, 16M colors, app control, wireless charging base.','home',59.00,'active','{"brand":"BenQ","colors":"16M","wireless_charging":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800',0,TRUE,'Smart Desk Lamp');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,120,120,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_usdt,59.00,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Premium Leather Sneakers','Full-grain leather low-top sneakers, rubber sole, unisex, EU 36-46.','fashion',129.00,'active','{"brand":"UrbanStep","material":"Full-grain Leather","sole":"Rubber"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',0,TRUE,'Leather Sneakers');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,180,180,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_usdt,129.00,TRUE);

  -- ─── USDC Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Sony A7 IV Mirrorless Camera','33MP full-frame mirrorless camera. 4K60, 10-bit S-Log3, 5-axis IBIS.','electronics',2499.00,'active','{"brand":"Sony","sensor":"33MP Full-Frame","video":"4K60 10bit"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',0,TRUE,'Sony A7 IV');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,15,15,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_usdc,2499.00,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Herman Miller Aeron Chair (Remastered)','Iconic ergonomic office chair. 8Z Pellicle mesh, PostureFit SL, 12-year warranty.','home',1795.00,'active','{"brand":"Herman Miller","warranty_years":12,"sizes":"A/B/C"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800',0,TRUE,'Herman Miller Aeron');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,12,12,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_usdc,1795.00,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Rolex Submariner Display Case','Watch display box for 6 timepieces — glass lid, velvet interior, lockable.','fashion',249.00,'active','{"brand":"WatchCraft","capacity":6,"material":"Mahogany + Glass"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1548171915-e79a6a611e6e?w=800',0,TRUE,'Watch Display Case');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,40,40,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_usdc,249.00,TRUE);

  -- ─── MATIC Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid1,'Polygon NFT Art Print','High-quality 50×70 cm giclee print of a Polygon-native NFT artwork. Signed.','electronics',79.00,'active','{"size":"50x70cm","finish":"Giclee","signed":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',0,TRUE,'NFT Art Print');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,60,60,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_matic,112.0,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Polygon MATIC Cap + Tee Bundle','Bundle: embroidered MATIC cap + premium tee. Perfect Web3 casual outfit.','fashion',69.00,'active','{"brand":"CryptoWear","includes":["Cap","T-Shirt"]}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',0,TRUE,'MATIC Bundle');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,200,200,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_matic,97.7,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid3,'Gaming Chair with Crypto Branding','RGB gaming chair, Polygon logo embroidery, lumbar + neck pillow, 150kg max.','home',289.00,'active','{"brand":"SecretLab Alt","max_weight_kg":150,"rgb":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800',0,TRUE,'Crypto Gaming Chair');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,20,20,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_matic,409.0,TRUE);

  -- ─── DOGE Products ────────────────────────────────

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'Doge Meme Plushie (XL)','Jumbo 50cm Shiba Inu Doge plushie. Ultra-soft, machine washable. To the moon!','fashion',29.00,'active','{"size":"50cm","material":"Ultra-soft plush","washable":true}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1546015720-b8b30df5aa27?w=800',0,TRUE,'Doge Plushie XL');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,500,500,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_doge,161.0,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid2,'DOGE to the Moon T-Shirt','Funny screen-print "To the Moon" DOGE tee. 100% organic cotton.','fashion',25.00,'active','{"brand":"MemeWear","material":"Organic Cotton","print":"Screen"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',0,TRUE,'DOGE Tee');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh2,400,400,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_doge,138.9,TRUE);

  INSERT INTO products (seller_id,name,description,category,base_price_usd,status,metadata)
  VALUES (sid3,'Doge Desk Mat (XL)','Extra-large 90×40cm desk mat with Doge meme print. Non-slip rubber base.','home',19.00,'active','{"size":"90x40cm","base":"Non-slip Rubber"}')
  RETURNING product_id INTO pid;
  INSERT INTO product_images VALUES (DEFAULT,pid,'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800',0,TRUE,'Doge Desk Mat');
  INSERT INTO inventory VALUES (DEFAULT,pid,wh1,300,300,0,0,NOW());
  INSERT INTO product_accepted_tokens (product_id,token_id,price_in_token,is_primary) VALUES (pid,tok_doge,105.6,TRUE);

END $$;

COMMIT;

-- Verify
SELECT p.name, p.base_price_usd, tw.symbol, pat.price_in_token
FROM products p
JOIN product_accepted_tokens pat ON pat.product_id = p.product_id
JOIN token_whitelist tw ON tw.token_id = pat.token_id
ORDER BY tw.symbol, p.base_price_usd;
