-- ================================================================
-- Migration 006: Admin Missing Tables
-- Version: 006
-- Name: admin_missing_tables
-- Created: 2026-04-07
-- Safe to re-run: YES (IF NOT EXISTS / DO blocks)
-- Purpose: Create tables that admin.service.ts references but were
--          never created via migration (dispute_messages, seller_payouts,
--          categories). Also create platform_settings as alias/replacement
--          for platform_config to match admin.service.ts expectations.
-- ================================================================

-- ─── 1. dispute_messages — chat between buyer/seller/admin on disputes ───
CREATE TABLE IF NOT EXISTS dispute_messages (
    message_id   BIGSERIAL    PRIMARY KEY,
    dispute_id   BIGINT       NOT NULL,
    sender_id    BIGINT       NOT NULL,
    message      TEXT         NOT NULL,
    attachments  JSONB        DEFAULT '[]',
    is_admin_note BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    FOREIGN KEY (dispute_id) REFERENCES disputes(dispute_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)  REFERENCES users(user_id)       ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender  ON dispute_messages(sender_id);

-- ─── 2. seller_payouts — track seller withdrawal requests ───────────────
CREATE TABLE IF NOT EXISTS seller_payouts (
    payout_id    BIGSERIAL      PRIMARY KEY,
    seller_id    BIGINT         NOT NULL,
    amount       DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    token_id     INT,
    chain_id     INT,
    tx_hash      VARCHAR(128),
    payout_wallet VARCHAR(128),
    status       VARCHAR(20)    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','rejected','failed')),
    notes        TEXT,
    processed_by BIGINT,
    processed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    FOREIGN KEY (seller_id)    REFERENCES seller_profiles(seller_id) ON DELETE RESTRICT,
    FOREIGN KEY (token_id)     REFERENCES token_whitelist(token_id)  ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(user_id)             ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller ON seller_payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_status ON seller_payouts(status);

-- ─── 3. categories — product categories management ──────────────────────
CREATE TABLE IF NOT EXISTS categories (
    category_id   BIGSERIAL    PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(120) NOT NULL UNIQUE,
    description   TEXT,
    image_url     VARCHAR(500),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    display_order INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_slug   ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active) WHERE is_active = TRUE;

-- ─── 4. platform_settings — admin.service uses this name ────────────────
-- schema.sql created `platform_config` but admin.service.ts queries `platform_settings`
-- Create platform_settings if it doesn't exist, with same schema
CREATE TABLE IF NOT EXISTS platform_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB        NOT NULL,
    description TEXT,
    updated_by  BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Migrate any existing data from platform_config → platform_settings
-- (only if platform_config exists and platform_settings is empty)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config') THEN
    INSERT INTO platform_settings (key, value, description, updated_by, updated_at)
    SELECT key, value, description, updated_by, updated_at
    FROM platform_config
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

SELECT 'Migration 006 applied: admin_missing_tables' AS result;
