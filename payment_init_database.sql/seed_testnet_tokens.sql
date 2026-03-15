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

-- ─── Polygon Amoy Testnet (chain_id: 80002) ───────────────────
-- Faucet: https://faucet.polygon.technology/
-- Bridge: https://faucet.quicknode.com/polygon/amoy
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  -- Native MATIC (địa chỉ 0x000...1010 theo chuẩn Polygon)
  ('MATIC', '0x0000000000000000000000000000000000001010', 80002, 18, TRUE),
  -- USDT trên Amoy (mock/test token - có thể là zero nếu chưa deploy)
  ('USDT',  '0x0000000000000000000000000000000000000000', 80002,  6, TRUE),
  -- USDC trên Amoy  
  ('USDC',  '0x0000000000000000000000000000000000000000', 80002,  6, TRUE),
  -- ETH bridged (thường là WETH trên Amoy)
  ('ETH',   '0x0000000000000000000000000000000000000000', 80002, 18, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

-- ─── Hardhat Localhost (chain_id: 31337) ──────────────────────
-- Dùng khi chạy: npx hardhat node
-- ETH có sẵn trong ví hardhat, không cần faucet
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  -- Native ETH trên localhost
  ('ETH',   '0x0000000000000000000000000000000000000000', 31337, 18, TRUE),
  -- USDT mock (địa chỉ sẽ thay sau khi deploy MockERC20 contract)
  ('USDT',  '0x0000000000000000000000000000000000000000', 31337,  6, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

-- ─── BNB Testnet (chain_id: 97) ───────────────────────────────
-- Faucet: https://www.bnbchain.org/en/testnet-faucet
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  ('BNB',   '0x0000000000000000000000000000000000000000', 97, 18, TRUE),
  ('USDT',  '0x0000000000000000000000000000000000000000', 97,  6, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

-- ─── Arbitrum Sepolia (chain_id: 421614) ──────────────────────
-- Faucet: https://faucets.chain.link/arbitrum-sepolia
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  ('ETH',   '0x0000000000000000000000000000000000000000', 421614, 18, TRUE),
  ('USDC',  '0x0000000000000000000000000000000000000000', 421614,  6, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE;

COMMIT;

-- Kiểm tra lại:
SELECT symbol, token_address, chain_id, decimals, is_active
FROM token_whitelist
ORDER BY chain_id, symbol;
