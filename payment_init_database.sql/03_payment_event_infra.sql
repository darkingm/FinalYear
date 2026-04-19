-- 03_payment_event_infra.sql
-- Adds guarded payment session storage and durable outbox support for payment_db.

CREATE TABLE IF NOT EXISTS payment_sessions (
    session_id      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    nonce           UUID            NOT NULL UNIQUE,
    user_id         BIGINT          NOT NULL,
    order_id        BIGINT          NOT NULL,
    token_symbol    VARCHAR(16)     NOT NULL,
    chain_id        INT             NOT NULL,
    amount_token    DECIMAL(36,18)  NOT NULL CHECK (amount_token > 0),
    quote_snapshot  JSONB           NOT NULL DEFAULT '{}'::jsonb,
    status          VARCHAR(24)     NOT NULL DEFAULT 'session_created'
                       CHECK (status IN ('session_created', 'quoted', 'submitted', 'expired', 'invalidated')),
    tx_hash         VARCHAR(128),
    expires_at      TIMESTAMP       NOT NULL,
    used_at         TIMESTAMP,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_order_user
    ON payment_sessions(order_id, user_id);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires_at
    ON payment_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_payment_sessions_status
    ON payment_sessions(status);

CREATE TABLE IF NOT EXISTS payment_outbox (
    event_id        UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_type  VARCHAR(32)     NOT NULL,
    aggregate_id    VARCHAR(128)    NOT NULL,
    event_type      VARCHAR(64)     NOT NULL,
    payload         JSONB           NOT NULL,
    published_at    TIMESTAMP,
    retry_count     INT             NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_outbox_pending
    ON payment_outbox(created_at)
    WHERE published_at IS NULL;

DROP TRIGGER IF EXISTS trg_payment_sessions_upd ON payment_sessions;
CREATE TRIGGER trg_payment_sessions_upd
BEFORE UPDATE ON payment_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Migration 03 applied: payment event infra ready' AS result;
