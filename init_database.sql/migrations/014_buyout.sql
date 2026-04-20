-- Migration: Buyout tables
-- Applies to: marketplace_db

CREATE TABLE IF NOT EXISTS buyout_proposals (
    id                  SERIAL PRIMARY KEY,
    asset_id            UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    governance_proposal_id INT      REFERENCES governance_proposals(id),
    buyer_address       VARCHAR(42)  NOT NULL,
    price_per_token_wei VARCHAR(78)  NOT NULL,
    price_per_token_usd DECIMAL(20,6),
    total_price_wei     VARCHAR(78),
    total_price_usd     DECIMAL(20,6),
    vault_address       VARCHAR(42),
    merkle_root         VARCHAR(66),
    status              VARCHAR(20)  NOT NULL DEFAULT 'PROPOSED'
                            CHECK (status IN ('PROPOSED','DEPOSITED','FINALIZED','SETTLED','CANCELLED')),
    claim_deadline      TIMESTAMPTZ,
    deposit_tx_hash     VARCHAR(66),
    finalize_tx_hash    VARCHAR(66),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_buyout_asset  ON buyout_proposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_buyout_status ON buyout_proposals(status);

CREATE TABLE IF NOT EXISTS buyout_claims (
    id              SERIAL PRIMARY KEY,
    buyout_id       INT          NOT NULL REFERENCES buyout_proposals(id),
    holder_address  VARCHAR(42)  NOT NULL,
    token_balance   BIGINT       NOT NULL,
    amount_wei      VARCHAR(78)  NOT NULL,
    tx_hash         VARCHAR(66),
    claimed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(buyout_id, holder_address)
);
CREATE INDEX IF NOT EXISTS idx_claims_buyout ON buyout_claims(buyout_id);

SELECT 'Migration 014 applied: buyout tables' AS result;
