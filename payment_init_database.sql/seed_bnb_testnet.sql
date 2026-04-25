-- =====================================================
-- MIGRATION: Seed BNB token for BSC Testnet (chain 97)
-- Run on payment-service PostgreSQL database (payment_db)
--
-- Usage:
--   psql -U payment_user -d payment_db -f seed_bnb_testnet.sql
-- =====================================================

BEGIN;

-- BNB native token on BSC Testnet (chain_id: 97)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES (
  'BNB',
  '0x0000000000000000000000000000000000000000',
  97, 18, TRUE,
  '{"name": "tBNB (BSC Testnet)", "type": "native", "description": "Native BNB - BSC Testnet"}'
)
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- PancakeSwap testnet tokens (for swap functionality)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
  ('WBNB', '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', 97, 18, TRUE,
   '{"name": "Wrapped BNB", "type": "erc20", "description": "WBNB on BSC Testnet"}'),
  ('BUSD', '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee', 97, 18, TRUE,
   '{"name": "BUSD Testnet", "type": "erc20", "description": "Binance USD on BSC Testnet"}'),
  ('USDT', '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', 97, 18, TRUE,
   '{"name": "USDT Testnet", "type": "erc20", "description": "Tether USD on BSC Testnet"}')
ON CONFLICT (token_address, chain_id) DO UPDATE
  SET is_active = TRUE, metadata = EXCLUDED.metadata;

COMMIT;

-- Verify:
SELECT symbol, token_address, chain_id, decimals, is_active
FROM token_whitelist
WHERE chain_id = 97
ORDER BY symbol;
