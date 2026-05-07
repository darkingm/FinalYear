-- ============================================================
-- Migration 005 — On-Chain Pair TX tracking
-- Stores decoded swap events per trading pair for:
--   - Persistent TX history (survives page refresh)
--   - Top Traders leaderboard (aggregate per maker)
-- ============================================================

-- ── 1. Pair swap log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onchain_pair_txs (
    id             BIGSERIAL    PRIMARY KEY,
    chain          VARCHAR(10)  NOT NULL,           -- BSC, ETH, POLYGON
    pair_address   VARCHAR(42)  NOT NULL,
    tx_hash        VARCHAR(66)  NOT NULL,
    block_number   BIGINT       NOT NULL,
    tx_type        VARCHAR(4)   NOT NULL,           -- BUY, SELL
    maker_address  VARCHAR(42)  NOT NULL,
    token_amount   NUMERIC(38,18) NOT NULL DEFAULT 0,
    quote_amount   NUMERIC(38,18) DEFAULT 0,
    amount_usd     NUMERIC(20,4)  DEFAULT 0,
    price_usd      NUMERIC(20,10) DEFAULT 0,
    token_symbol   VARCHAR(30),
    quote_symbol   VARCHAR(30),
    dex_id         VARCHAR(30),
    tx_timestamp   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pair_tx UNIQUE (tx_hash, pair_address, maker_address)
);

CREATE INDEX IF NOT EXISTS idx_pair_txs_pair
    ON onchain_pair_txs (pair_address, tx_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pair_txs_maker
    ON onchain_pair_txs (pair_address, maker_address);
