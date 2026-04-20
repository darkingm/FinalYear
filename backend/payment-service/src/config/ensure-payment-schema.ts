import type { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const PAYMENT_EVENT_INFRA_SQL = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
  `
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  `,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(128);`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS chain_id INT;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'crypto';`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount DECIMAL(36,18);`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS token_id INT;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id BIGINT;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS from_address VARCHAR(128);`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS to_address VARCHAR(128);`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS block_number BIGINT;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS block_timestamp TIMESTAMP;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gas_used VARCHAR(78);`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS gas_price BIGINT;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by_rpc BOOLEAN DEFAULT FALSE;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by_indexer BOOLEAN DEFAULT FALSE;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmations INT DEFAULT 0;`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();`,
  `
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
  `,
  'CREATE INDEX IF NOT EXISTS idx_payment_sessions_order_user ON payment_sessions(order_id, user_id);',
  'CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires_at ON payment_sessions(expires_at);',
  'CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);',
  `
  CREATE TABLE IF NOT EXISTS payment_outbox (
      event_id        UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
      aggregate_type  VARCHAR(32)     NOT NULL,
      aggregate_id    VARCHAR(128)    NOT NULL,
      event_type      VARCHAR(64)     NOT NULL,
      payload         JSONB           NOT NULL,
      published_at    TIMESTAMP,
      locked_at       TIMESTAMP,
      locked_by       VARCHAR(128),
      retry_count     INT             NOT NULL DEFAULT 0,
      last_error      TEXT,
      created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
  );
  `,
  `ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;`,
  `ALTER TABLE payment_outbox ADD COLUMN IF NOT EXISTS locked_by VARCHAR(128);`,
  'CREATE INDEX IF NOT EXISTS idx_payment_outbox_pending ON payment_outbox(created_at) WHERE published_at IS NULL;',
  'CREATE INDEX IF NOT EXISTS idx_payment_outbox_locked ON payment_outbox(locked_at) WHERE published_at IS NULL;',
  `
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
  `,
  'CREATE INDEX IF NOT EXISTS idx_payment_batch_sessions_user ON payment_batch_sessions(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_payment_batch_sessions_status ON payment_batch_sessions(status);',
  'CREATE INDEX IF NOT EXISTS idx_payment_batch_sessions_expires_at ON payment_batch_sessions(expires_at);',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tx_hash_unique ON payments(tx_hash) WHERE tx_hash IS NOT NULL;',
  'DROP TRIGGER IF EXISTS trg_payment_sessions_upd ON payment_sessions;',
  'CREATE TRIGGER trg_payment_sessions_upd BEFORE UPDATE ON payment_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
  'DROP TRIGGER IF EXISTS trg_payment_batch_sessions_upd ON payment_batch_sessions;',
  'CREATE TRIGGER trg_payment_batch_sessions_upd BEFORE UPDATE ON payment_batch_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
];

export async function ensurePaymentEventInfrastructure(db: Queryable) {
  for (const sql of PAYMENT_EVENT_INFRA_SQL) {
    await db.query(sql);
  }

  logger.info('Payment event infrastructure is ready');
}
