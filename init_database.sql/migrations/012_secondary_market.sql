-- Migration: Secondary market tables
-- Applies to: marketplace_db

CREATE TABLE IF NOT EXISTS rwa_listings (
    id                  SERIAL PRIMARY KEY,
    asset_id            UUID         NOT NULL REFERENCES rwa_assets(asset_id),
    seller_address      VARCHAR(42)  NOT NULL,
    seller_user_id      INT,
    token_amount        BIGINT       NOT NULL,
    price_per_token_wei VARCHAR(78)  NOT NULL,
    price_per_token_usd DECIMAL(20,6),
    onchain_listing_id  INT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE','FILLED','CANCELLED')),
    listing_tx_hash     VARCHAR(66),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_asset  ON rwa_listings(asset_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON rwa_listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_listings_status ON rwa_listings(status);

CREATE TABLE IF NOT EXISTS rwa_trades (
    id              SERIAL PRIMARY KEY,
    listing_id      INT          NOT NULL REFERENCES rwa_listings(id),
    buyer_address   VARCHAR(42)  NOT NULL,
    buyer_user_id   INT,
    token_amount    BIGINT       NOT NULL,
    total_price_wei VARCHAR(78)  NOT NULL,
    total_price_usd DECIMAL(20,6),
    trade_tx_hash   VARCHAR(66),
    traded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_listing ON rwa_trades(listing_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer   ON rwa_trades(buyer_address);

SELECT 'Migration 012 applied: secondary market' AS result;
