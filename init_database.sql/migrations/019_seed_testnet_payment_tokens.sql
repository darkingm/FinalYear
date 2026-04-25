-- =====================================================
-- Migration 019: Seed missing testnet tokens in payment_db
-- Ensures BNB Testnet (97), Base Sepolia (84532) work for checkout
-- =====================================================

-- ─── Base Sepolia (chain_id: 84532) ──────────────────────────────────────
-- Primary public testnet — was missing from seed_testnet_tokens.sql
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('ETH', '0x0000000000000000000000000000000000000000', 84532, 18, TRUE,
   '{"name": "Ether (Base Sepolia)", "type": "native", "chain": "Base Sepolia"}')
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- ─── BNB Testnet (chain_id: 97) — re-assert in case seed wasn't run ──────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('BNB', '0x0000000000000000000000000000000000000000', 97, 18, TRUE,
   '{"name": "BNB (Testnet)", "type": "native", "chain": "BSC Testnet"}')
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- ─── Hardhat (chain_id: 31337) — ensure ETH native exists ────────────────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('ETH', '0x0000000000000000000000000000000000000000', 31337, 18, TRUE,
   '{"name": "Ether (Hardhat VPS)", "type": "native", "chain": "Hardhat"}')
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- ─── Polygon Amoy (chain_id: 80002) — ensure MATIC exists ───────────────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('MATIC', '0x0000000000000000000000000000000000001010', 80002, 18, TRUE,
   '{"name": "MATIC (Amoy)", "type": "native", "chain": "Polygon Amoy"}')
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- ─── Arbitrum Sepolia (chain_id: 421614) — ensure ETH exists ─────────────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('ETH', '0x0000000000000000000000000000000000000000', 421614, 18, TRUE,
   '{"name": "Ether (Arbitrum Sepolia)", "type": "native", "chain": "Arbitrum Sepolia"}')
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- Verification
SELECT symbol, chain_id, is_active, metadata->>'chain' AS chain_name
FROM token_whitelist
WHERE chain_id IN (31337, 84532, 80002, 97, 421614)
ORDER BY chain_id, symbol;
