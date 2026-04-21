-- Migration 015: Holdings wallet-first PK + purchase idempotency status
-- Applies to: marketplace_db
--
-- Context: investor_holdings used PK (user_id, asset_id) which caused the
-- transfer indexer to merge all unknown wallets into user_id=0 per asset.
-- Switching to PK (asset_id, wallet_address) — user_id becomes nullable lookup.
-- Also adds status column to purchase_idempotency for mint-before-write safety.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Holdings: wallet-first PK
-- ═══════════════════════════════════════════════════════════════════════════

-- 1a. Normalize wallet_address to lowercase
UPDATE investor_holdings
SET wallet_address = LOWER(wallet_address)
WHERE wallet_address IS NOT NULL AND wallet_address <> LOWER(wallet_address);

-- 1b. Merge duplicate (asset_id, wallet_address) rows — keep max tokens, latest update
-- This resolves the user_id=0 merging problem by consolidating before PK change.
WITH dupes AS (
    SELECT asset_id, LOWER(wallet_address) AS wallet,
           MAX(tokens_held) AS max_tokens,
           MAX(last_updated) AS latest_update,
           MIN(user_id) FILTER (WHERE user_id <> 0) AS real_user_id,
           COUNT(*) AS cnt
    FROM investor_holdings
    WHERE wallet_address IS NOT NULL
    GROUP BY asset_id, LOWER(wallet_address)
    HAVING COUNT(*) > 1
)
-- Delete all but one row per (asset_id, wallet), then update the survivor
DELETE FROM investor_holdings h
USING dupes d
WHERE h.asset_id = d.asset_id
  AND LOWER(h.wallet_address) = d.wallet
  AND h.ctid NOT IN (
      SELECT MIN(h2.ctid)
      FROM investor_holdings h2
      WHERE h2.asset_id = d.asset_id AND LOWER(h2.wallet_address) = d.wallet
  );

-- Update survivors with merged data
UPDATE investor_holdings h
SET tokens_held = d.max_tokens,
    user_id = COALESCE(d.real_user_id, h.user_id),
    last_updated = d.latest_update
FROM (
    SELECT asset_id, LOWER(wallet_address) AS wallet,
           MAX(tokens_held) AS max_tokens,
           MAX(last_updated) AS latest_update,
           MIN(user_id) FILTER (WHERE user_id <> 0) AS real_user_id
    FROM investor_holdings
    WHERE wallet_address IS NOT NULL
    GROUP BY asset_id, LOWER(wallet_address)
) d
WHERE h.asset_id = d.asset_id AND LOWER(h.wallet_address) = d.wallet;

-- 1c. Convert user_id = 0 to NULL (these are unlinked wallets)
UPDATE investor_holdings SET user_id = NULL WHERE user_id = 0;

-- 1d. Drop old PK and indexes
ALTER TABLE investor_holdings DROP CONSTRAINT IF EXISTS investor_holdings_pkey;
DROP INDEX IF EXISTS idx_holdings_user;
DROP INDEX IF EXISTS idx_holdings_asset;
DROP INDEX IF EXISTS idx_holdings_wallet;

-- 1e. Make wallet_address NOT NULL (required for new PK)
-- Any rows with NULL wallet_address are orphans from the old system — remove them.
DELETE FROM investor_holdings WHERE wallet_address IS NULL;
ALTER TABLE investor_holdings ALTER COLUMN wallet_address SET NOT NULL;

-- 1f. Make user_id nullable
ALTER TABLE investor_holdings ALTER COLUMN user_id DROP NOT NULL;

-- 1g. Set new PK and indexes
ALTER TABLE investor_holdings ADD PRIMARY KEY (asset_id, wallet_address);
CREATE INDEX IF NOT EXISTS idx_holdings_user   ON investor_holdings(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_holdings_asset  ON investor_holdings(asset_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset_user ON investor_holdings(asset_id, user_id) WHERE user_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Purchase idempotency: add status column for mint-before-write safety
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE purchase_idempotency
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('PENDING', 'COMPLETED'));

COMMIT;

SELECT 'Migration 015 applied: holdings wallet-first PK + idempotency status' AS result;
