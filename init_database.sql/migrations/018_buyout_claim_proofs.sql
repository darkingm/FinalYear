-- Migration: Buyout Merkle claim proofs
-- Applies to: marketplace_db

BEGIN;

ALTER TABLE buyout_claims
    ADD COLUMN IF NOT EXISTS token_balance_wei VARCHAR(78);

CREATE TABLE IF NOT EXISTS buyout_claim_proofs (
    buyout_id          INT         NOT NULL REFERENCES buyout_proposals(id) ON DELETE CASCADE,
    holder_address     VARCHAR(42) NOT NULL,
    token_balance      BIGINT      NOT NULL,
    token_balance_wei  VARCHAR(78) NOT NULL,
    amount_wei         VARCHAR(78) NOT NULL,
    leaf_hash          VARCHAR(66) NOT NULL,
    proof              JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (buyout_id, holder_address)
);

CREATE INDEX IF NOT EXISTS idx_buyout_claim_proofs_holder
    ON buyout_claim_proofs(holder_address);

COMMIT;

SELECT 'Migration 018 applied: buyout claim proofs' AS result;
