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
  // ── Migration 027: coupons seller scope (idempotent runtime mirror) ──
  `
  ALTER TABLE coupons
      ADD COLUMN IF NOT EXISTS seller_id        BIGINT REFERENCES seller_profiles(seller_id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS description      TEXT,
      ADD COLUMN IF NOT EXISTS per_user_limit   INT,
      ADD COLUMN IF NOT EXISTS max_discount_usd DECIMAL(18,2);
  `,
  `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'coupons_discount_type_check'
        AND conrelid = 'coupons'::regclass
    ) THEN
      ALTER TABLE coupons DROP CONSTRAINT coupons_discount_type_check;
    END IF;
    ALTER TABLE coupons ADD CONSTRAINT coupons_discount_type_check
      CHECK (discount_type IN ('percentage','fixed','fixed_amount','free_shipping'));
  END $$;
  `,
  `CREATE INDEX IF NOT EXISTS idx_coupons_seller ON coupons(seller_id);`,
  `CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status, valid_until);`,
  `
  CREATE TABLE IF NOT EXISTS coupon_redemptions (
      redemption_id BIGSERIAL PRIMARY KEY,
      coupon_id     BIGINT NOT NULL REFERENCES coupons(coupon_id) ON DELETE CASCADE,
      user_id       BIGINT NOT NULL REFERENCES users(user_id)     ON DELETE CASCADE,
      order_id      BIGINT REFERENCES orders(order_id) ON DELETE SET NULL,
      redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  `,
  `CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_user
      ON coupon_redemptions(coupon_id, user_id);`,
  // ── Migration 028: consolidate platform_config → platform_settings ──
  // Also fixes the buggy schema.sql platform_settings shape (value TEXT, no updated_by).
  `ALTER TABLE platform_settings
      ADD COLUMN IF NOT EXISTS updated_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL;`,
  `
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'platform_settings'
        AND column_name = 'value'
        AND data_type = 'text'
    ) THEN
      BEGIN
        ALTER TABLE platform_settings
          ALTER COLUMN value TYPE JSONB USING
            CASE
              WHEN value IS NULL OR value = '' THEN '{}'::jsonb
              WHEN value ~ '^\\s*[\\[{"\\-]|^\\s*-?\\d|^\\s*(true|false|null)\\b' THEN value::jsonb
              ELSE to_jsonb(value)
            END;
      EXCEPTION WHEN others THEN
        ALTER TABLE platform_settings
          ALTER COLUMN value TYPE JSONB USING to_jsonb(value::text);
      END;
    END IF;
  END $$;
  `,
  `
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config') THEN
      INSERT INTO platform_settings (key, value, description, updated_by, updated_at)
      SELECT key, value, description, updated_by, updated_at
      FROM platform_config
      ON CONFLICT (key) DO NOTHING;

      DROP TABLE platform_config;
    END IF;
  END $$;
  `,
];

export async function ensureMainPaymentProjectionInfrastructure(db: Queryable) {
  for (const sql of MAIN_PAYMENT_PROJECTION_SQL) {
    await db.query(sql);
  }

  logger.info('Main payment projection infrastructure is ready');
}
