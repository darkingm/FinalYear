-- Migration: Purchase safety — idempotency + failure recovery
-- Applies to: marketplace_db

-- ── Purchase idempotency ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_idempotency (
    idempotency_key  VARCHAR(64) PRIMARY KEY,
    asset_id         UUID        NOT NULL REFERENCES rwa_assets(asset_id),
    user_id          INT         NOT NULL,
    wallet_address   VARCHAR(42) NOT NULL,
    token_amount     BIGINT      NOT NULL,
    mint_tx_hash     VARCHAR(66),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Failed mint recovery ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS failed_mint_recovery (
    id              BIGSERIAL PRIMARY KEY,
    asset_id        UUID        NOT NULL REFERENCES rwa_assets(asset_id),
    user_id         INT         NOT NULL,
    wallet_address  VARCHAR(42) NOT NULL,
    token_amount    BIGINT      NOT NULL,
    mint_tx_hash    VARCHAR(66),
    error_message   TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','RESOLVED','IGNORED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_failed_mint_status ON failed_mint_recovery(status);

SELECT 'Migration 009 applied: purchase safety' AS result;
