-- ============================================================================
-- CREATE PAYMENTS TABLE
-- 
-- The payment-service code references a "payments" table, but the original
-- schema (web3_marketplace_schema.sql) defined it as "order_payments" with
-- a different column set. This script creates the "payments" table to match
-- what the application code actually uses.
--
-- Run this against your payment-service database:
--   psql -U <user> -d <database> -f create-payments-table.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    payment_id    BIGSERIAL PRIMARY KEY,
    order_id      BIGINT       NOT NULL,
    tx_hash       VARCHAR(128),            -- crypto 0x… hash or paypal-… id
    chain_id      INT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirming', 'confirmed', 'failed')),
    from_address  VARCHAR(128),
    to_address    VARCHAR(128),
    block_number  BIGINT,
    block_timestamp TIMESTAMP,
    gas_used      VARCHAR(78),             -- stored as string in code (BigInt)
    gas_price     BIGINT,
    verified_by_rpc     BOOLEAN DEFAULT FALSE,
    verified_by_indexer BOOLEAN DEFAULT FALSE,
    confirmations INT DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes (mirrors the index naming from web3_marketplace_schema.sql)
CREATE INDEX IF NOT EXISTS idx_payments_order    ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash  ON payments(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_chain    ON payments(chain_id);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_payments_updated_at();
