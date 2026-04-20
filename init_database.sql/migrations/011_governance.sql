-- Migration: Governance tables
-- Applies to: marketplace_db

-- ── Add governance fields to rwa_assets ─────────────────────────────────────
ALTER TABLE rwa_assets
    ADD COLUMN IF NOT EXISTS governance_contract_address VARCHAR(42),
    ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS control_threshold DECIMAL(5,2) DEFAULT 50.00,
    ADD COLUMN IF NOT EXISTS supermajority_threshold DECIMAL(5,2) DEFAULT 67.00;

-- ── Governance Proposals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS governance_proposals (
    id                  SERIAL PRIMARY KEY,
    asset_id            UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    proposer_address    VARCHAR(42)  NOT NULL,
    proposal_type       VARCHAR(30)  NOT NULL CHECK (proposal_type IN (
        'GENERAL','UPDATE_VALUATION','DISTRIBUTE_PROFIT',
        'SELL_ASSET','INITIATE_BUYOUT','REPLACE_OPERATOR'
    )),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    ipfs_doc            VARCHAR(200),
    onchain_id          INT,          -- proposal ID in GovernanceRWA contract
    snapshot_block      BIGINT,
    for_votes           DECIMAL(30,18) NOT NULL DEFAULT 0,
    against_votes       DECIMAL(30,18) NOT NULL DEFAULT 0,
    quorum_required     DECIMAL(5,2)   NOT NULL DEFAULT 50.00,
    voting_deadline     TIMESTAMPTZ  NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE','PASSED','REJECTED','EXECUTED','CANCELLED')),
    tx_hash             VARCHAR(66),
    execute_tx_hash     VARCHAR(66),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_asset  ON governance_proposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_gov_proposals_status ON governance_proposals(status);

-- ── Governance Votes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS governance_votes (
    proposal_id     INT          NOT NULL REFERENCES governance_proposals(id),
    voter_address   VARCHAR(42)  NOT NULL,
    support         BOOLEAN      NOT NULL,
    weight          DECIMAL(30,18) NOT NULL DEFAULT 0,
    tx_hash         VARCHAR(66),
    voted_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (proposal_id, voter_address)
);
CREATE INDEX IF NOT EXISTS idx_gov_votes_voter ON governance_votes(voter_address);

SELECT 'Migration 011 applied: governance' AS result;
