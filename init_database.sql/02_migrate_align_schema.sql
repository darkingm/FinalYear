-- ============================================================================
-- MIGRATION: Align DB with application code requirements
-- Run against: marketplace_db (port 5433)
-- ============================================================================

BEGIN;

-- ============================================================
-- 1) users: add columns needed by auth.service.ts (OAuth login,
--    password login, PayPal, wallet linking)
-- ============================================================

-- OAuth providers
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id    VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id  VARCHAR(255) UNIQUE;

-- Password-based auth
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Avatar from OAuth / uploaded
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url    VARCHAR(500);

-- PayPal email for paypal payments
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_email  VARCHAR(255);

-- wallet_address should be NULLABLE (OAuth users don't have a wallet yet)
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;

-- ============================================================
-- 2) orders: add columns used by payment-service
--    (crypto-payment.service.ts, tx-monitor.worker.ts)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_id        BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_order_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_id          INT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_token      DECIMAL(36,18);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS chain_id          INT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_contract   VARCHAR(42);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tx_hash           VARCHAR(128);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method    VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_expires_at  TIMESTAMP;

COMMIT;

-- Quick verify
SELECT 'users columns: ' || COUNT(*) FROM information_schema.columns WHERE table_name='users';
SELECT 'orders columns: ' || COUNT(*) FROM information_schema.columns WHERE table_name='orders';
