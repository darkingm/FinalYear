-- File: fix-seller-wallets.sql
-- Update seller payout_wallet sang Hardhat Account #1 (known test address with 10,000 ETH)
-- Hardhat Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

UPDATE seller_profiles
SET payout_wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
WHERE payout_wallet IS NULL
   OR payout_wallet = ''
   OR LENGTH(payout_wallet) != 42
   OR payout_wallet NOT LIKE '0x%';

SELECT
  u.username,
  u.email,
  u.role,
  sp.payout_wallet
FROM seller_profiles sp
JOIN users u ON u.user_id = sp.seller_id
ORDER BY sp.seller_id;
