-- 04_payment_batch_session_infra.sql
-- Adds guarded batch payment sessions for cart checkout.

CREATE TABLE IF NOT EXISTS payment_batch_sessions (
    session_id           UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    nonce                UUID            NOT NULL UNIQUE,
    user_id              BIGINT          NOT NULL,
    order_ids            JSONB           NOT NULL DEFAULT '[]'::jsonb,
    token_symbol         VARCHAR(16)     NOT NULL,
    chain_id             INT             NOT NULL,
    amount_token_total   DECIMAL(36,18)  NOT NULL CHECK (amount_token_total > 0),
    quote_snapshot       JSONB           NOT NULL DEFAULT '{}'::jsonb,
    status               VARCHAR(24)     NOT NULL DEFAULT 'session_created'
                           CHECK (status IN ('session_created', 'quoted', 'submitted', 'expired', 'invalidated')),
    tx_hash              VARCHAR(128),
    expires_at           TIMESTAMP       NOT NULL,
    used_at              TIMESTAMP,
    created_at           TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_batch_sessions_user
    ON payment_batch_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_batch_sessions_status
    ON payment_batch_sessions(status);

CREATE INDEX IF NOT EXISTS idx_payment_batch_sessions_expires_at
    ON payment_batch_sessions(expires_at);

DROP TRIGGER IF EXISTS trg_payment_batch_sessions_upd ON payment_batch_sessions;
CREATE TRIGGER trg_payment_batch_sessions_upd
BEFORE UPDATE ON payment_batch_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Migration 04 applied: payment batch session infra ready' AS result;
