-- ============================================================================
-- Migration 024: Seller payout_wallet integrity
-- ============================================================================
-- Background: admin.service.ts used to insert the zero address
-- (0x0000000000000000000000000000000000000000) as payout_wallet whenever an
-- admin promoted a user with no linked wallet to "seller". Combined with a
-- regex-only validator, this address would be passed to EscrowCore.deposit()
-- as the seller arg and the contract would revert with "Invalid seller",
-- aborting the buyer's payment.
--
-- This migration:
--   1) Replaces any zero-address payout_wallet with NULL.
--   2) Lower-cases existing payout_wallet values for consistent matching.
--   3) Adds a CHECK constraint preventing the zero address from ever being
--      stored again. NULL is still allowed (seller has not chosen a wallet).
-- ============================================================================

-- 1) Null out any zero-address rows
UPDATE seller_profiles
   SET payout_wallet = NULL
 WHERE payout_wallet IS NOT NULL
   AND lower(payout_wallet) = '0x0000000000000000000000000000000000000000';

-- 2) Lower-case existing values (idempotent — only updates rows that differ)
UPDATE seller_profiles
   SET payout_wallet = lower(payout_wallet)
 WHERE payout_wallet IS NOT NULL
   AND payout_wallet <> lower(payout_wallet);

-- 3) Add CHECK constraint (drop first if a previous version exists)
ALTER TABLE seller_profiles
    DROP CONSTRAINT IF EXISTS seller_profiles_payout_wallet_check;

ALTER TABLE seller_profiles
    ADD CONSTRAINT seller_profiles_payout_wallet_check
    CHECK (
        payout_wallet IS NULL
        OR (
            payout_wallet ~ '^0x[0-9a-f]{40}$'
            AND payout_wallet <> '0x0000000000000000000000000000000000000000'
        )
    );

SELECT 'Migration 024 applied: seller payout_wallet integrity enforced' AS result;
