-- Migration 021: Deposit invoice (intents) + on-chain deposit indexer state
-- Applies to: marketplace_db
-- Mục tiêu:
--   1. Bảng `wallet_deposit_intents` cho phép user tạo "phiếu nạp" với amount + token + from_wallet
--      để indexer khớp giao dịch on-chain → biết chính xác user nào.
--   2. Bảng `deposit_indexer_state` để indexer biết block đã quét đến đâu cho mỗi chain.
--   3. Thêm cột `intent_id` vào `wallet_deposits` để liên kết với phiếu nạp đã khớp.

-- 1) wallet_deposit_intents
CREATE TABLE IF NOT EXISTS wallet_deposit_intents (
    intent_id        BIGSERIAL      PRIMARY KEY,
    user_id          BIGINT         NOT NULL,
    chain_id         INT            NOT NULL,
    token_id         INT            NOT NULL,
    -- expected_amount tính theo đơn vị token (decimal user-facing, không phải wei)
    expected_amount  DECIMAL(36,18) NOT NULL CHECK (expected_amount > 0),
    -- ví user dự kiến gửi từ. Indexer khớp on-chain `from_address` theo cột này.
    from_address     VARCHAR(128)   NOT NULL,
    -- địa chỉ đích trên platform tại thời điểm tạo phiếu (snapshot, phòng khi config thay đổi)
    to_address       VARCHAR(128)   NOT NULL,
    reference_code   VARCHAR(20)    NOT NULL UNIQUE,
    status           VARCHAR(20)    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','matched','expired','cancelled')),
    matched_deposit_id BIGINT,
    expires_at       TIMESTAMP      NOT NULL,
    created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES users(user_id)            ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_deposit_intents_user
    ON wallet_deposit_intents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_intents_active
    ON wallet_deposit_intents (chain_id, token_id, status, expires_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deposit_intents_from
    ON wallet_deposit_intents (chain_id, LOWER(from_address))
    WHERE status = 'pending';

-- 2) Liên kết deposit ↔ intent
ALTER TABLE wallet_deposits
    ADD COLUMN IF NOT EXISTS intent_id BIGINT;

DO $$ BEGIN
    ALTER TABLE wallet_deposits
        ADD CONSTRAINT fk_wallet_deposits_intent
        FOREIGN KEY (intent_id)
        REFERENCES wallet_deposit_intents(intent_id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_deposits_intent
    ON wallet_deposits (intent_id) WHERE intent_id IS NOT NULL;

-- Cho phép user_id NULL trên wallet_deposits — khi indexer phát hiện 1 giao dịch
-- nhưng không khớp intent và from_address không thuộc bất kỳ user nào.
DO $$ BEGIN
    ALTER TABLE wallet_deposits ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 3) Deposit indexer state per-chain
CREATE TABLE IF NOT EXISTS deposit_indexer_state (
    chain_id            INT          PRIMARY KEY,
    last_indexed_block  BIGINT       NOT NULL DEFAULT 0,
    last_indexed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4) Seed Hardhat deposit address vào platform_config nếu chưa có
DO $$
DECLARE
    cfg JSONB;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config') THEN
        SELECT value INTO cfg FROM platform_config WHERE key = 'deposit_addresses';
        IF cfg IS NULL THEN
            INSERT INTO platform_config (key, value, description)
            VALUES (
                'deposit_addresses',
                '{"31337": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}'::jsonb,
                'Per-chain platform deposit addresses (chain_id -> address)'
            )
            ON CONFLICT (key) DO NOTHING;
        ELSIF NOT (cfg ? '31337') THEN
            -- Row exists but Hardhat key missing -> merge default Hardhat address.
            UPDATE platform_config
               SET value = value || '{"31337": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"}'::jsonb,
                   updated_at = NOW()
             WHERE key = 'deposit_addresses';
        END IF;
    END IF;
END $$;

SELECT 'Migration 021 applied: wallet_deposit_intents + deposit_indexer_state' AS result;
