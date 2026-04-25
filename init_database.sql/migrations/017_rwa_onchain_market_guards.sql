-- Migration: RWA secondary market on-chain proof fields
-- Applies to: marketplace_db

ALTER TABLE rwa_listings
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS cancel_tx_hash VARCHAR(66);

CREATE INDEX IF NOT EXISTS idx_listings_onchain_id ON rwa_listings(onchain_listing_id);

SELECT 'Migration 017 applied: RWA on-chain market guards' AS result;
