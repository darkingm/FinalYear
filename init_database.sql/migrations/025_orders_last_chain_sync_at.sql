-- ============================================================================
-- Migration 025: orders.last_chain_sync_at
-- ============================================================================
-- Adds a timestamp tracking the last time the auto-sync worker reconciled an
-- order's DB status against the on-chain Escrow contract. The worker uses
-- this column to throttle RPC calls — orders synced within the last
-- ESCROW_SYNC_INTERVAL are skipped on subsequent ticks.
--
-- The partial index speeds up the worker's primary query, which only ever
-- targets crypto orders in "in-flight" statuses with a known chain/escrow.
-- ============================================================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS last_chain_sync_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN orders.last_chain_sync_at IS
    'Timestamp of the last auto-sync reconcile against EscrowCore. Used by '
    'cron job to skip recently-synced rows.';

-- Partial index — only "in-flight" crypto orders are scanned by the worker.
CREATE INDEX IF NOT EXISTS idx_orders_chain_sync_pending
    ON orders (last_chain_sync_at NULLS FIRST)
    WHERE payment_method = 'crypto'
      AND chain_id IS NOT NULL
      AND escrow_contract IS NOT NULL
      AND status IN (
          'PAID', 'ONCHAIN_CONFIRMED', 'TX_SUBMITTED',
          'PROCESSING', 'SHIPPED', 'DELIVERED'
      );

SELECT 'Migration 025 applied: orders.last_chain_sync_at + sync index' AS result;
