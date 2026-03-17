-- Migration: add UNIQUE constraint on payments.tx_hash
-- This allows ON CONFLICT(tx_hash) to work correctly.
-- Run ONCE on the payment_db:
--   psql -U payment_user -d payment_db -f 02_add_tx_hash_unique.sql

-- Remove any duplicate tx_hash rows first (keep the earliest one per tx_hash)
DELETE FROM payments p1
WHERE p1.payment_id NOT IN (
  SELECT MIN(p2.payment_id)
  FROM payments p2
  WHERE p2.tx_hash IS NOT NULL
  GROUP BY p2.tx_hash
);

-- Now add unique constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_tx_hash_unique'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_tx_hash_unique UNIQUE (tx_hash);
  END IF;
END $$;
