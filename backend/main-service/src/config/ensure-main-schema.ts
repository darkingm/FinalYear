import type { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const MAIN_PAYMENT_PROJECTION_SQL = [
  `
  ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS release_tx_hash VARCHAR(128);
  `,
  `
  ALTER TABLE disputes
      ADD COLUMN IF NOT EXISTS evidence_urls JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS buyer_wallet VARCHAR(42),
      ADD COLUMN IF NOT EXISTS seller_wallet VARCHAR(42),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `,
  `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'disputes_order_id_unique'
        AND conrelid = 'disputes'::regclass
    ) THEN
      ALTER TABLE disputes ADD CONSTRAINT disputes_order_id_unique UNIQUE (order_id);
    END IF;
  END $$;
  `,
  `
  CREATE TABLE IF NOT EXISTS processed_events (
      event_id       UUID         PRIMARY KEY,
      event_type     VARCHAR(64)  NOT NULL,
      aggregate_id   VARCHAR(128) NOT NULL,
      processed_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
      metadata       JSONB        NOT NULL DEFAULT '{}'::jsonb
  );
  `,
  `
  ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payment_projection_updated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS payment_projection_version INT NOT NULL DEFAULT 0;
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_orders_tracking
      ON orders(tracking_number)
      WHERE tracking_number IS NOT NULL;
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_orders_release_tx
      ON orders(release_tx_hash)
      WHERE release_tx_hash IS NOT NULL;
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_processed_events_type_aggregate
      ON processed_events(event_type, aggregate_id);
  `,
  `CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);`,
  `CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON disputes(raised_by);`,
  `CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);`,
];

export async function ensureMainPaymentProjectionInfrastructure(db: Queryable) {
  for (const sql of MAIN_PAYMENT_PROJECTION_SQL) {
    await db.query(sql);
  }

  logger.info('Main payment projection infrastructure is ready');
}
