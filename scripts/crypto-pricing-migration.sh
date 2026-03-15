#!/bin/bash
# ============================================================
# Migration: Add crypto pricing to products
# Run on VPS: bash /tmp/crypto-pricing-migration.sh
# ============================================================

echo "=== Step 1: Add price_token columns to products ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_token       DECIMAL(20,8) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_token_symbol VARCHAR(20)  DEFAULT NULL;
"

echo "=== Step 2: Set small MATIC prices for test products ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "
UPDATE products SET
  price_token        = CASE
    WHEN price <= 20  THEN 0.005   -- e.g. small item: 0.005 MATIC
    WHEN price <= 100 THEN 0.01    -- medium: 0.01 MATIC
    WHEN price <= 500 THEN 0.05    -- large: 0.05 MATIC
    ELSE                   0.1     -- premium: 0.1 MATIC
  END,
  price_token_symbol = 'MATIC'
WHERE price_token IS NULL;
"

echo "=== Step 3: Verify ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "
SELECT product_id, name, price AS price_usd, price_token, price_token_symbol
FROM products
ORDER BY price_token
LIMIT 10;
"

echo "=== Done! Products now have MATIC pricing. ==="
echo "Example: 0.01 MATIC ≈ 0.006 USD on testnet - easy to faucet and test!"
