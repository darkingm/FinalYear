-- Migration: Indexer state tracking
-- Applies to: marketplace_db

CREATE TABLE IF NOT EXISTS indexer_state (
    asset_id            UUID PRIMARY KEY REFERENCES rwa_assets(asset_id),
    last_indexed_block  BIGINT NOT NULL DEFAULT 0,
    last_indexed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT 'Migration 010 applied: indexer state' AS result;
