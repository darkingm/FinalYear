-- =====================================================
-- SEED: Testnet tokens for payment-service token_whitelist
-- Run this on payment-service PostgreSQL database
-- 
-- Usage (trên VPS):
--   psql -U payment_user -d payment_db -f seed_testnet_tokens.sql
--
-- Hoặc copy paste vào psql shell
-- =====================================================

BEGIN;

-- ─── Hardhat Localhost (chain_id: 31337) ─────────────────────────────────
-- Chain ảo trên VPS: http://103.20.96.79:8545
-- ETH có sẵn: 10,000 ETH/account, không cần faucet!
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  (
    'ETH',
    '0x0000000000000000000000000000000000000000',
    31337, 18, TRUE,
    '{"name": "Ether (Hardhat VPS)", "type": "native", "description": "Native ETH - instant, free, for testing"}'
  )
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- Deactivate token không hợp lệ cho chain 31337 (USDT/MATIC fake)
UPDATE token_whitelist SET is_active = FALSE
WHERE chain_id = 31337 AND symbol != 'ETH';

-- ─── Polygon Amoy Testnet (chain_id: 80002) ──────────────────────────────
-- Faucet: https://faucet.polygon.technology/ (0.5 MATIC/ngày)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  -- Native MATIC (theo chuẩn ERC-20/native của Polygon)
  ('MATIC', '0x0000000000000000000000000000000000001010', 80002, 18, TRUE),
  -- Native ETH (bridge từ Ethereum — dùng address(0) cho native)
  ('ETH',   '0x0000000000000000000000000000000000000000', 80002, 18, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

-- ─── BNB Testnet (chain_id: 97) ────────────────────────────────────────────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  ('BNB', '0x0000000000000000000000000000000000000000', 97, 18, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

-- ─── Arbitrum Sepolia (chain_id: 421614) ───────────────────────────────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  ('ETH', '0x0000000000000000000000000000000000000000', 421614, 18, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

COMMIT;

-- Kiểm tra lại:
SELECT symbol, token_address, chain_id, decimals, is_active
FROM token_whitelist
ORDER BY chain_id, symbol;
