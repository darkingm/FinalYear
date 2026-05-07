-- Migration 029: extend every active product to be payable on BNB Smart
-- Chain Testnet (chain 97), in addition to the existing Hardhat ETH (31337)
-- pricing. Without this, the only token the catalog could quote against was
-- ETH on the local chain — buyers funded with tBNB had nothing to spend on.
--
-- Pricing assumptions (rough, for testnet demo only):
--   * BNB  ≈ $600  → $0.01 = 0.0000167 BNB    (18 decimals)
--   * USDT (testnet on chain 97) is treated 1:1 with USD → $0.01 = 0.01 USDT
--   * BUSD same: $0.01 = 0.01 BUSD
--
-- Resilient: ON CONFLICT (product_id, token_id) DO NOTHING — re-running this
-- migration is safe; it only adds rows that don't exist yet.

-- ── BNB on BSC Testnet (token_id resolved by symbol+chain_id) ─────────
INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
SELECT
    p.product_id,
    tw.token_id,
    -- $0.01 / $600 ≈ 0.00001667 BNB; price scales with base_price_usd.
    ROUND( (p.base_price_usd / 600)::numeric, 18 ),
    FALSE  -- never override primary; ETH on Hardhat keeps that flag
FROM products p
CROSS JOIN token_whitelist tw
WHERE p.status = 'active'
  AND tw.symbol = 'BNB'
  AND tw.chain_id = 97
  AND tw.is_active = TRUE
ON CONFLICT (product_id, token_id) DO NOTHING;

-- ── USDT on BSC Testnet ───────────────────────────────────────────────
INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
SELECT
    p.product_id,
    tw.token_id,
    ROUND(p.base_price_usd::numeric, 18),  -- 1 USDT = $1
    FALSE
FROM products p
CROSS JOIN token_whitelist tw
WHERE p.status = 'active'
  AND tw.symbol = 'USDT'
  AND tw.chain_id = 97
  AND tw.is_active = TRUE
ON CONFLICT (product_id, token_id) DO NOTHING;

-- ── BUSD on BSC Testnet (only first 25 products, to give the catalog
--    visible variety without making every product accept every token) ──
INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
SELECT
    p.product_id,
    tw.token_id,
    ROUND(p.base_price_usd::numeric, 18),
    FALSE
FROM products p
CROSS JOIN token_whitelist tw
WHERE p.status = 'active'
  AND tw.symbol = 'BUSD'
  AND tw.chain_id = 97
  AND tw.is_active = TRUE
  AND p.product_id IN (SELECT product_id FROM products WHERE status = 'active' ORDER BY product_id LIMIT 25)
ON CONFLICT (product_id, token_id) DO NOTHING;

INSERT INTO schema_migrations (version, name, filename)
VALUES ('029', 'multichain_product_pricing', '029_multichain_product_pricing.sql')
ON CONFLICT (version) DO NOTHING;
