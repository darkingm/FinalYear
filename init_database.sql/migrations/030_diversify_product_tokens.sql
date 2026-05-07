-- Migration 030: diversify which tokens each product accepts.
--
-- After migration 029, every active product accepted ETH (31337) +
-- BNB+USDT (97) + BUSD (subset). The catalog looked monotonous — every
-- card showed the same 4 chips.
--
-- For demo realism we want a 3-way split:
--   product_id % 3 == 0 → ETH only (Hardhat exclusive)
--   product_id % 3 == 1 → BNB only (BNB Testnet exclusive)
--   product_id % 3 == 2 → ETH + BNB (multi-chain)
-- USDT/BUSD pricing rows are removed entirely so the card chip doesn't
-- get cluttered. They can be added back from the seller dashboard if a
-- specific seller wants stablecoin pricing.
--
-- We keep a fresh `is_primary = TRUE` invariant: exactly one token per
-- product is marked primary. The rule is "ETH if it remains, otherwise
-- BNB". Anything else is set to is_primary=FALSE.

-- 1) Drop USDT + BUSD on chain 97 across all products (visual cleanup)
DELETE FROM product_accepted_tokens pat
USING token_whitelist tw
WHERE pat.token_id = tw.token_id
  AND tw.chain_id = 97
  AND tw.symbol IN ('USDT', 'BUSD');

-- 2) For products where (product_id % 3 == 0): remove BNB → ETH only
DELETE FROM product_accepted_tokens pat
USING token_whitelist tw, products p
WHERE pat.token_id = tw.token_id
  AND tw.chain_id = 97
  AND tw.symbol = 'BNB'
  AND pat.product_id = p.product_id
  AND p.product_id % 3 = 0;

-- 3) For products where (product_id % 3 == 1): remove ETH → BNB only
DELETE FROM product_accepted_tokens pat
USING token_whitelist tw, products p
WHERE pat.token_id = tw.token_id
  AND tw.chain_id = 31337
  AND tw.symbol = 'ETH'
  AND pat.product_id = p.product_id
  AND p.product_id % 3 = 1;

-- 4) Re-establish is_primary flag
--    Step 4a: clear all is_primary first
UPDATE product_accepted_tokens SET is_primary = FALSE;

--    Step 4b: mark ETH primary where it exists
UPDATE product_accepted_tokens pat
SET is_primary = TRUE
FROM token_whitelist tw
WHERE pat.token_id = tw.token_id
  AND tw.chain_id = 31337
  AND tw.symbol = 'ETH';

--    Step 4c: for products with no ETH row, mark BNB as primary
UPDATE product_accepted_tokens pat
SET is_primary = TRUE
FROM token_whitelist tw
WHERE pat.token_id = tw.token_id
  AND tw.chain_id = 97
  AND tw.symbol = 'BNB'
  AND NOT EXISTS (
    SELECT 1 FROM product_accepted_tokens pat2
    JOIN token_whitelist tw2 ON pat2.token_id = tw2.token_id
    WHERE pat2.product_id = pat.product_id
      AND tw2.chain_id = 31337 AND tw2.symbol = 'ETH'
  );

INSERT INTO schema_migrations (version, name, filename)
VALUES ('030', 'diversify_product_tokens', '030_diversify_product_tokens.sql')
ON CONFLICT (version) DO NOTHING;
