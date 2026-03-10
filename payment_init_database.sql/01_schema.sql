-- =====================================================
-- PAYMENT SERVICE SCHEMA
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tokens support
CREATE TABLE token_whitelist (
    token_id          SERIAL       PRIMARY KEY,
    symbol            VARCHAR(10)  NOT NULL,
    token_address     VARCHAR(42)  NOT NULL,
    chain_id          INT          NOT NULL,
    decimals          INT          NOT NULL CHECK (decimals >= 0 AND decimals <= 18),
    oracle_price_feed VARCHAR(42),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    metadata          JSONB,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_address, chain_id)
);

-- 2. Exchange Rates
CREATE TABLE exchange_rates (
    rate_id   BIGSERIAL     PRIMARY KEY,
    token_id  INT           NOT NULL,
    usd_rate  DECIMAL(18,8) NOT NULL CHECK (usd_rate > 0),
    source    VARCHAR(50),
    timestamp TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE CASCADE
);

-- 3. Payments
CREATE TABLE payments (
    payment_id          BIGSERIAL    PRIMARY KEY,
    order_id            BIGINT       NOT NULL,     -- references orders.order_id in main_db
    tx_hash             VARCHAR(128),
    chain_id            INT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirming','confirmed','failed')),
    payment_type        VARCHAR(20)  NOT NULL DEFAULT 'crypto'
                            CHECK (payment_type IN ('crypto', 'paypal', 'p2p')),
    amount              DECIMAL(36,18),
    token_id            INT REFERENCES token_whitelist(token_id) ON DELETE SET NULL,
    user_id             BIGINT,                    -- references users.user_id in main_db
    from_address        VARCHAR(128),
    to_address          VARCHAR(128),
    block_number        BIGINT,
    block_timestamp     TIMESTAMP,
    gas_used            VARCHAR(78),
    gas_price           BIGINT,
    verified_by_rpc     BOOLEAN      DEFAULT FALSE,
    verified_by_indexer BOOLEAN      DEFAULT FALSE,
    confirmations       INT          DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 4. Order Payments (Archived detailed tracking)
CREATE TABLE order_payments (
    payment_id          BIGSERIAL      PRIMARY KEY,
    order_id            BIGINT         NOT NULL,
    token_id            INT            NOT NULL,
    amount              DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash             VARCHAR(66),
    chain_id            INT,
    block_number        BIGINT,
    status              VARCHAR(20)    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirming','confirmed','failed')),
    verified_by_rpc     BOOLEAN        DEFAULT FALSE,
    verified_by_indexer BOOLEAN        DEFAULT FALSE,
    confirmations       INT            DEFAULT 0,
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE RESTRICT
);

-- 5. Platform Fees
CREATE TABLE platform_fees (
    fee_id           BIGSERIAL     PRIMARY KEY,
    order_id         BIGINT        NOT NULL,
    fee_amount_usd   DECIMAL(18,2) NOT NULL CHECK (fee_amount_usd >= 0),
    fee_percentage   DECIMAL(5,2)  NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    collector_wallet VARCHAR(42)   NOT NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','collected','failed')),
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Refunds
CREATE TABLE refunds (
    refund_id         BIGSERIAL      PRIMARY KEY,
    order_id          BIGINT         NOT NULL,
    payment_id        BIGINT         NOT NULL,
    amount            DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash           VARCHAR(66),
    escrow_release_tx VARCHAR(66),
    reason            TEXT           NOT NULL,
    status            VARCHAR(20)    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','processing','completed','rejected')),
    approved_by       BIGINT,
    processed_at      TIMESTAMP,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id)  REFERENCES order_payments(payment_id) ON DELETE RESTRICT
);

-- Indexes
CREATE INDEX idx_payments_order   ON payments(order_id);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_status  ON payments(status);

CREATE INDEX idx_tokens_symbol  ON token_whitelist(symbol);
CREATE INDEX idx_tokens_chain   ON token_whitelist(chain_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payments_upd BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_order_payments_upd BEFORE UPDATE ON order_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Seed Data (Default Supported Tokens)
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals) VALUES
    ('USDT', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 137, 6),     -- Polygon mainnet
    ('USDT', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 80001, 6),   -- Mumbai
    ('USDC', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 137, 6)
ON CONFLICT DO NOTHING;
