-- Migration: Legal entity metadata
-- Applies to: marketplace_db

CREATE TABLE IF NOT EXISTS legal_entities (
    id                  SERIAL PRIMARY KEY,
    asset_id            UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    entity_name         VARCHAR(255) NOT NULL,
    entity_type         VARCHAR(20)  NOT NULL CHECK (entity_type IN ('SPV','LLC','TRUST','CORP')),
    jurisdiction        VARCHAR(10)  NOT NULL DEFAULT 'VN',
    registration_number VARCHAR(100),
    incorporation_date  DATE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_legal_entity_asset ON legal_entities(asset_id);

CREATE TABLE IF NOT EXISTS shareholder_agreements (
    id              SERIAL PRIMARY KEY,
    asset_id        UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    legal_entity_id INT          REFERENCES legal_entities(id),
    ipfs_hash       VARCHAR(200) NOT NULL,
    description     TEXT,
    effective_date  DATE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shareholder_asset ON shareholder_agreements(asset_id);

SELECT 'Migration 013 applied: legal metadata' AS result;
