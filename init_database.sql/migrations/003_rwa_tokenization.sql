-- Migration: RWA Tokenization tables
-- Applies to: marketplace_db (main database)

-- ── RWA Assets ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rwa_assets (
    asset_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(255)     NOT NULL,
    symbol                      VARCHAR(20)      NOT NULL,
    asset_type                  VARCHAR(50)      NOT NULL CHECK (asset_type IN ('REAL_ESTATE','BOND','EQUITY','COMMODITY')),
    description                 TEXT,
    location                    VARCHAR(500),
    total_valuation_usd         DECIMAL(20,2)    NOT NULL,
    price_per_token_usd         DECIMAL(20,2)    NOT NULL,
    total_tokens                BIGINT           NOT NULL,
    tokens_sold                 BIGINT           NOT NULL DEFAULT 0,
    token_contract_address      VARCHAR(42),
    distributor_contract_address VARCHAR(42),
    legal_doc_ipfs              VARCHAR(200),
    expected_apy                DECIMAL(5,2),     -- e.g. 8.50 for 8.5%
    status                      VARCHAR(30)      NOT NULL DEFAULT 'PENDING'
                                    CHECK (status IN ('PENDING','ACTIVE','CLOSED','EXITED','FAILED')),
    chain_id                    INT              NOT NULL DEFAULT 31337,
    created_at                  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ── Profit Distributions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profit_distributions (
    id                  BIGSERIAL PRIMARY KEY,
    asset_id            UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    amount_eth          DECIMAL(30,18) NOT NULL,
    amount_usd          DECIMAL(20,6)  DEFAULT 0,
    tx_hash             VARCHAR(66),
    period_description  TEXT,
    distributed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profit_dist_asset ON profit_distributions(asset_id);

-- ── Investor Holdings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_holdings (
    user_id               INT          NOT NULL,
    asset_id              UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    tokens_held           BIGINT       NOT NULL DEFAULT 0,
    avg_cost_usd          DECIMAL(20,6) DEFAULT 0,
    total_claimed_profit  DECIMAL(20,6) DEFAULT 0,
    wallet_address        VARCHAR(42),
    last_updated          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, asset_id)
);
CREATE INDEX IF NOT EXISTS idx_holdings_user   ON investor_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset  ON investor_holdings(asset_id);
CREATE INDEX IF NOT EXISTS idx_holdings_wallet ON investor_holdings(wallet_address);

-- ── KYC Records ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rwa_kyc (
    wallet_address  VARCHAR(42)  PRIMARY KEY,
    user_id         INT,
    verified        BOOLEAN      NOT NULL DEFAULT false,
    jurisdiction    VARCHAR(10)  DEFAULT 'VN',
    granted_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    granted_by      INT          -- admin user_id
);
CREATE INDEX IF NOT EXISTS idx_kyc_user ON rwa_kyc(user_id);
