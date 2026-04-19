-- 008_payment_event_projection.sql
-- Adds idempotent payment event tracking and order projection metadata to marketplace_db.

CREATE TABLE IF NOT EXISTS processed_events (
    event_id       UUID         PRIMARY KEY,
    event_type     VARCHAR(64)  NOT NULL,
    aggregate_id   VARCHAR(128) NOT NULL,
    processed_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    metadata       JSONB        NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_projection_updated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS payment_projection_version INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_processed_events_type_aggregate
    ON processed_events(event_type, aggregate_id);

SELECT 'Migration 008 applied: payment projection infrastructure ready' AS result;
