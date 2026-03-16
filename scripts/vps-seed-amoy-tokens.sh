#!/bin/bash
# Seed Amoy testnet tokens into payment_db
echo "=== Seeding Amoy (chain_id=80002) tokens into payment_db ==="

docker exec marketplace-payment-postgres psql -U postgres -d payment_db << 'SQLEOF'
-- Insert Polygon Amoy testnet tokens (chain_id = 80002)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('POL',  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 80002, 18, true, '{"name":"POL (native)","chain":"Polygon Amoy","native":true}'),
  ('USDT', '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9', 80002,  6, true, '{"name":"Tether USD","chain":"Polygon Amoy"}'),
  ('USDC', '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', 80002,  6, true, '{"name":"USD Coin","chain":"Polygon Amoy"}')
ON CONFLICT (token_address, chain_id) DO UPDATE SET
  is_active = true,
  metadata  = EXCLUDED.metadata;

-- Verify
SELECT token_id, symbol, chain_id, token_address, is_active
FROM token_whitelist
WHERE chain_id = 80002;
SQLEOF

echo ""
echo "=== Current token_whitelist by chain ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c \
  "SELECT chain_id, COUNT(*) as token_count FROM token_whitelist GROUP BY chain_id ORDER BY chain_id"

echo "=== Done ==="
