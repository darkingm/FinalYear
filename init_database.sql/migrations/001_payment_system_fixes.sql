-- ================================================================
-- Migration 001: Payment System Fixes
-- Version: 001
-- Name: payment_system_fixes
-- Created: 2026-03-20
-- Safe to re-run: YES (uses IF NOT EXISTS / DO blocks)
-- ================================================================

-- 1. Add tracking_number column to orders (seller fills when shipping)
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. Add release_tx_hash column (blockchain tx hash when escrow releases to seller)
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN release_tx_hash VARCHAR(128);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. Add evidence_urls to disputes (buyer uploads proof images)
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN evidence_urls JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 4. Add UNIQUE constraint on disputes(order_id) — one dispute per order
-- Needed for ON CONFLICT (order_id) DO UPDATE upserts
DO $$ BEGIN
  ALTER TABLE disputes ADD CONSTRAINT disputes_order_id_unique UNIQUE (order_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. Add buyer_wallet to disputes for admin reference panel
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN buyer_wallet VARCHAR(42);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 6. Add seller_wallet to disputes for admin reference panel
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN seller_wallet VARCHAR(42);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 7. Ensure updated_at exists on disputes
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 8. Extend orders status CHECK constraint to include ONCHAIN_CONFIRMED, DISPUTED
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'UNPAID', 'TX_SUBMITTED', 'TX_FAILED',
        'ONCHAIN_CONFIRMED', 'PAID', 'PAID_PAYPAL',
        'PROCESSING', 'SHIPPED', 'DELIVERED',
        'COMPLETED', 'CANCELLED', 'REFUNDED',
        'DELIVERING', 'DISPUTED'
    ));

-- 9. Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_tracking     ON orders(tracking_number)   WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_release_tx   ON orders(release_tx_hash)   WHERE release_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_status     ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by  ON disputes(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id   ON disputes(order_id);

-- Verify
SELECT 'Migration 001 applied: payment_system_fixes' AS result;
