-- ================================================================
-- MIGRATION 001: Payment System Fixes
-- Run this on existing DB to add missing columns and constraints
-- Safe to re-run: uses IF NOT EXISTS / DO blocks
-- ================================================================

-- 1. Add tracking_number column to orders (for seller to input)
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 2. Add release_tx_hash column (blockchain tx when escrow releases to seller)
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN release_tx_hash VARCHAR(128);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3. Add evidence_urls to disputes (buyer uploads proof images)
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN evidence_urls JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 4. Add UNIQUE constraint on disputes(order_id) so we can upsert
-- Only one active dispute per order
DO $$ BEGIN
  ALTER TABLE disputes ADD CONSTRAINT disputes_order_id_unique UNIQUE (order_id);
EXCEPTION WHEN duplicate_table THEN NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Add buyer_wallet column to disputes for admin reference
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN buyer_wallet VARCHAR(42);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 6. Add seller_wallet column to disputes for admin reference
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN seller_wallet VARCHAR(42);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 7. Extend orders status constraint to include all possible statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'UNPAID', 'TX_SUBMITTED', 'TX_FAILED',
        'ONCHAIN_CONFIRMED', 'PAID', 'PAID_PAYPAL',
        'PROCESSING', 'SHIPPED', 'DELIVERED',
        'COMPLETED', 'CANCELLED', 'REFUNDED',
        'DELIVERING', 'DISPUTED'
    ));

-- 8. Index on orders.tracking_number for logistics queries
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- 9. Index on disputes.status for admin panel queries  
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes(raised_by);

-- 10. Add order_number to disputes view for admin (via JOIN, no column needed)
-- But ensure disputes has updated_at column
DO $$ BEGIN
  ALTER TABLE disputes ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Verify
SELECT 'Migration 001 applied successfully' AS result;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name IN ('tracking_number', 'release_tx_hash')
ORDER BY column_name;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'disputes' AND column_name IN ('evidence_urls', 'buyer_wallet', 'seller_wallet')
ORDER BY column_name;
