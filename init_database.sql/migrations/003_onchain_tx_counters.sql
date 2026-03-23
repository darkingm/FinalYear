-- ============================================================
-- Migration 003 — On-Chain TX counters + log table
-- Safe to re-run (idempotent)
-- ============================================================

-- Ensure migrations table exists (safety net)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(10) PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  -- ── 1. Wallet stats (persistent BUY/SELL counters) ─────────
  CREATE TABLE IF NOT EXISTS onchain_wallet_stats (
    id              SERIAL PRIMARY KEY,
    wallet_address  VARCHAR(42)  NOT NULL,
    chain           VARCHAR(20)  NOT NULL,
    token_address   VARCHAR(42)  NOT NULL DEFAULT 'native',
    token_symbol    VARCHAR(30),
    buy_count       INTEGER      NOT NULL DEFAULT 0,
    sell_count      INTEGER      NOT NULL DEFAULT 0,
    transfer_count  INTEGER      NOT NULL DEFAULT 0,
    buy_volume_usd  DECIMAL(22,4) NOT NULL DEFAULT 0,
    sell_volume_usd DECIMAL(22,4) NOT NULL DEFAULT 0,
    last_tx_hash    VARCHAR(66),
    last_activity   TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallet_chain_token UNIQUE (wallet_address, chain, token_address)
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_onchain_stats_wallet
    ON onchain_wallet_stats (wallet_address, chain);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 2. TX event log (deduped by hash+token) ─────────────────
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS onchain_tx_log (
    id             SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42)   NOT NULL,
    tx_hash        VARCHAR(66)   NOT NULL,
    chain          VARCHAR(20)   NOT NULL,
    token_address  VARCHAR(42)   NOT NULL DEFAULT 'native',
    token_symbol   VARCHAR(30),
    tx_type        VARCHAR(12)   NOT NULL,  -- BUY / SELL / TRANSFER
    amount_token   DECIMAL(36,8),
    amount_usd     DECIMAL(22,4),
    price_usd      DECIMAL(22,8),
    pair_symbol    VARCHAR(20),
    dex_name       VARCHAR(60),
    block_number   BIGINT,
    tx_timestamp   TIMESTAMPTZ,
    recorded_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_onchain_tx UNIQUE (tx_hash, wallet_address, token_address)
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_onchain_log_wallet_token
    ON onchain_tx_log (wallet_address, chain, token_address, tx_timestamp DESC);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 3. Record this migration ─────────────────────────────────
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'onchain_tx_counters')
ON CONFLICT (version) DO NOTHING;
