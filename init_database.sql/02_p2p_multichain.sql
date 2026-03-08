-- =====================================================
-- MIGRATION 02 — P2P Trading, Multi-Chain Wallets,
--               Product Multi-Token, Schema Fixes
-- Run after 01_schema.sql
-- =====================================================

-- ──────────────────────────────────────────────────
-- FIX 1: Make seller_profiles.payout_wallet nullable
--         (wallets are optional; escrow handles funds)
-- ──────────────────────────────────────────────────
ALTER TABLE seller_profiles
    ALTER COLUMN payout_wallet DROP NOT NULL;

-- ──────────────────────────────────────────────────
-- FIX 2: Normalise orders.status to UPPER_SNAKE_CASE
--         (was mixed: 'pending', 'UNPAID', 'confirmed', etc.)
-- ──────────────────────────────────────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Migrate existing lowercase statuses → upper snake
UPDATE orders SET status = CASE status
    WHEN 'pending'    THEN 'UNPAID'
    WHEN 'confirmed'  THEN 'ONCHAIN_CONFIRMED'
    WHEN 'processing' THEN 'PROCESSING'
    WHEN 'shipped'    THEN 'SHIPPED'
    WHEN 'delivered'  THEN 'DELIVERED'
    WHEN 'completed'  THEN 'COMPLETED'
    WHEN 'cancelled'  THEN 'CANCELLED'
    WHEN 'refunded'   THEN 'REFUNDED'
    ELSE UPPER(status)
END;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'UNPAID', 'TX_SUBMITTED', 'TX_FAILED',
        'ONCHAIN_CONFIRMED', 'PAID', 'PAID_PAYPAL',
        'PROCESSING', 'SHIPPED', 'DELIVERED',
        'COMPLETED', 'CANCELLED', 'REFUNDED',
        'DELIVERING', 'DISPUTED'
    ));

-- ──────────────────────────────────────────────────
-- FIX 3: Add total_usd column to orders for admin display
-- ──────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_usd DECIMAL(18,2)
    GENERATED ALWAYS AS (total_amount) STORED;

-- ──────────────────────────────────────────────────
-- FIX 4: Remove duplicate payments table ambiguity
--        (keep both for now, add discriminator)
-- ──────────────────────────────────────────────────
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) NOT NULL DEFAULT 'crypto'
        CHECK (payment_type IN ('crypto', 'paypal', 'p2p'));

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS amount DECIMAL(36,18),
    ADD COLUMN IF NOT EXISTS token_id INT REFERENCES token_whitelist(token_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────
-- NEW TABLE: product_accepted_tokens
--   Each product can accept payments in multiple tokens.
--   Replaces the single token_id on products.
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_accepted_tokens (
    id              BIGSERIAL      PRIMARY KEY,
    product_id      BIGINT         NOT NULL,
    token_id        INT            NOT NULL,
    price_in_token  DECIMAL(36,18) NOT NULL CHECK (price_in_token > 0),
    is_primary      BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (token_id)   REFERENCES token_whitelist(token_id) ON DELETE CASCADE,
    UNIQUE (product_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_pat_product ON product_accepted_tokens(product_id);
CREATE INDEX IF NOT EXISTS idx_pat_token   ON product_accepted_tokens(token_id);

-- Migrate existing products with token_id → product_accepted_tokens
INSERT INTO product_accepted_tokens (product_id, token_id, price_in_token, is_primary)
SELECT product_id, token_id, COALESCE(price_in_token, 0), TRUE
FROM products
WHERE token_id IS NOT NULL
  AND price_in_token IS NOT NULL
  AND price_in_token > 0
ON CONFLICT (product_id, token_id) DO NOTHING;

-- ──────────────────────────────────────────────────
-- NEW TABLE: user_wallets
--   Users can link multiple wallets across different chains.
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_wallets (
    wallet_db_id    BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    chain_type      VARCHAR(20)  NOT NULL
                        CHECK (chain_type IN (
                            'evm','solana','tron','ton',
                            'aptos','near','cosmos','bitcoin'
                        )),
    chain_id        INT,           -- EVM chain_id (1=ETH, 56=BSC, 137=Polygon, etc.)
    address         VARCHAR(128)   NOT NULL,
    label           VARCHAR(100),  -- user-defined label e.g. "My MetaMask"
    is_primary      BOOLEAN        NOT NULL DEFAULT FALSE,
    is_verified     BOOLEAN        NOT NULL DEFAULT FALSE,  -- verified via sign-message
    verified_at     TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (user_id, chain_type, address)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user    ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_chain   ON user_wallets(chain_type, chain_id);

-- ──────────────────────────────────────────────────
-- NEW TABLE: wallet_deposits
--   Track on-chain deposits (nạp tiền) per user per chain
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_deposits (
    deposit_id      BIGSERIAL      PRIMARY KEY,
    user_id         BIGINT         NOT NULL,
    wallet_db_id    BIGINT,        -- which wallet was used (nullable for unknown)
    token_id        INT            NOT NULL,
    chain_id        INT            NOT NULL,
    amount          DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash         VARCHAR(128)   NOT NULL,
    from_address    VARCHAR(128)   NOT NULL,
    to_address      VARCHAR(128)   NOT NULL,   -- platform deposit address
    block_number    BIGINT,
    confirmations   INT            DEFAULT 0,
    status          VARCHAR(20)    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirming','confirmed','failed')),
    credited_at     TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)      REFERENCES users(user_id)             ON DELETE RESTRICT,
    FOREIGN KEY (wallet_db_id) REFERENCES user_wallets(wallet_db_id) ON DELETE SET NULL,
    FOREIGN KEY (token_id)     REFERENCES token_whitelist(token_id)  ON DELETE RESTRICT,
    UNIQUE (tx_hash, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_deposits_user    ON wallet_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_tx      ON wallet_deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_deposits_status  ON wallet_deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_token   ON wallet_deposits(token_id, chain_id);

-- ──────────────────────────────────────────────────
-- NEW TABLE: p2p_offers
--   Merchants post offers to buy or sell crypto.
--   Mimics Binance P2P offer model.
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_offers (
    offer_id        BIGSERIAL      PRIMARY KEY,
    creator_id      BIGINT         NOT NULL,   -- user who created the offer
    offer_type      VARCHAR(10)    NOT NULL    -- 'BUY'=merchant wants to buy crypto, 'SELL'=merchant sells crypto
                        CHECK (offer_type IN ('BUY','SELL')),
    token_id        INT            NOT NULL,   -- crypto token (USDT, BTC, ETH, etc.)
    fiat_currency   VARCHAR(10)    NOT NULL DEFAULT 'USD',  -- fiat: USD, VND, etc.
    price_per_unit  DECIMAL(18,4)  NOT NULL CHECK (price_per_unit > 0),  -- fiat per 1 token
    min_amount      DECIMAL(18,4)  NOT NULL CHECK (min_amount > 0),      -- min fiat order
    max_amount      DECIMAL(18,4)  NOT NULL CHECK (max_amount > 0),      -- max fiat order
    total_amount    DECIMAL(36,18) NOT NULL CHECK (total_amount > 0),    -- total token available
    filled_amount   DECIMAL(36,18) NOT NULL DEFAULT 0,
    payment_methods JSONB          NOT NULL DEFAULT '[]',  -- ["bank_transfer","paypal","momo"]
    payment_time_limit INT         NOT NULL DEFAULT 15,   -- minutes buyer has to pay
    terms           TEXT,          -- merchant's custom terms
    auto_release    BOOLEAN        NOT NULL DEFAULT FALSE,
    status          VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','CANCELLED')),
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(user_id)             ON DELETE RESTRICT,
    FOREIGN KEY (token_id)   REFERENCES token_whitelist(token_id)  ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_p2p_offers_creator ON p2p_offers(creator_id);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_token   ON p2p_offers(token_id);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_type    ON p2p_offers(offer_type);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_status  ON p2p_offers(status);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_fiat    ON p2p_offers(fiat_currency);

-- ──────────────────────────────────────────────────
-- NEW TABLE: p2p_orders
--   A taker places an order against a merchant's offer.
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_orders (
    p2p_order_id    BIGSERIAL      PRIMARY KEY,
    order_ref       VARCHAR(30)    NOT NULL UNIQUE DEFAULT 'P2P' || LPAD(nextval('p2p_order_seq')::TEXT, 10, '0'),
    offer_id        BIGINT         NOT NULL,
    buyer_id        BIGINT         NOT NULL,   -- taker (wants to buy crypto)
    seller_id       BIGINT         NOT NULL,   -- merchant (offer creator for SELL orders)
    token_id        INT            NOT NULL,
    fiat_currency   VARCHAR(10)    NOT NULL,
    fiat_amount     DECIMAL(18,4)  NOT NULL CHECK (fiat_amount > 0),   -- amount buyer pays in fiat
    token_amount    DECIMAL(36,18) NOT NULL CHECK (token_amount > 0),  -- token amount
    price_per_unit  DECIMAL(18,4)  NOT NULL,
    payment_method  VARCHAR(30)    NOT NULL,
    payment_proof   JSONB          DEFAULT '[]',  -- array of image URLs uploaded by buyer
    payment_paid_at TIMESTAMP,
    confirmed_at    TIMESTAMP,
    released_at     TIMESTAMP,
    expires_at      TIMESTAMP      NOT NULL,       -- buyer must pay before this
    status          VARCHAR(25)    NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                            'PENDING',       -- created, awaiting buyer payment
                            'PAID',          -- buyer marked as paid, awaiting seller confirm
                            'CONFIRMED',     -- seller confirmed receipt → crypto released
                            'RELEASED',      -- crypto transferred to buyer
                            'CANCELLED',     -- cancelled before payment
                            'DISPUTED',      -- dispute opened
                            'RESOLVED_BUYER','RESOLVED_SELLER', -- admin resolved
                            'TIMEOUT'        -- expired without payment
                        )),
    admin_notes     TEXT,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id)   REFERENCES p2p_offers(offer_id)         ON DELETE RESTRICT,
    FOREIGN KEY (buyer_id)   REFERENCES users(user_id)               ON DELETE RESTRICT,
    FOREIGN KEY (seller_id)  REFERENCES users(user_id)               ON DELETE RESTRICT,
    FOREIGN KEY (token_id)   REFERENCES token_whitelist(token_id)    ON DELETE RESTRICT
);

-- Sequence for readable order refs
CREATE SEQUENCE IF NOT EXISTS p2p_order_seq START 1000;

CREATE INDEX IF NOT EXISTS idx_p2p_orders_offer   ON p2p_orders(offer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer   ON p2p_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller  ON p2p_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_status  ON p2p_orders(status);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_expires ON p2p_orders(expires_at) WHERE status = 'PENDING';

-- ──────────────────────────────────────────────────
-- NEW TABLE: p2p_messages
--   In-order chat between buyer and seller
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_messages (
    message_id   BIGSERIAL    PRIMARY KEY,
    p2p_order_id BIGINT       NOT NULL,
    sender_id    BIGINT       NOT NULL,
    message      TEXT,
    attachments  JSONB        DEFAULT '[]',  -- image URLs
    is_system    BOOLEAN      NOT NULL DEFAULT FALSE,  -- system messages
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (p2p_order_id) REFERENCES p2p_orders(p2p_order_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)    REFERENCES users(user_id)           ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_p2p_messages_order  ON p2p_messages(p2p_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_sender ON p2p_messages(sender_id);

-- ──────────────────────────────────────────────────
-- NEW TABLE: p2p_disputes
--   Detailed dispute record for P2P orders
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_disputes (
    dispute_id    BIGSERIAL   PRIMARY KEY,
    p2p_order_id  BIGINT      NOT NULL,
    raised_by     BIGINT      NOT NULL,
    reason        VARCHAR(50) NOT NULL
                      CHECK (reason IN (
                          'PAYMENT_NOT_RECEIVED',
                          'PAYMENT_WRONG_AMOUNT',
                          'SELLER_NOT_RELEASING',
                          'FAKE_PROOF',
                          'OTHER'
                      )),
    description   TEXT        NOT NULL,
    evidence      JSONB       DEFAULT '[]',  -- image/file URLs
    resolver_id   BIGINT,
    resolution    VARCHAR(20) CHECK (resolution IN ('BUYER_WINS','SELLER_WINS','SPLIT','CANCELLED')),
    admin_notes   TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','CLOSED')),
    created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (p2p_order_id) REFERENCES p2p_orders(p2p_order_id) ON DELETE RESTRICT,
    FOREIGN KEY (raised_by)   REFERENCES users(user_id)            ON DELETE RESTRICT,
    FOREIGN KEY (resolver_id) REFERENCES users(user_id)            ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_p2p_disputes_order  ON p2p_disputes(p2p_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status ON p2p_disputes(status);

-- ──────────────────────────────────────────────────
-- NEW TABLE: platform_config
--   Key-value store for runtime config (fee %, deposit addresses, etc.)
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB        NOT NULL,
    description TEXT,
    updated_by  BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default platform settings
INSERT INTO platform_config (key, value, description) VALUES
    ('platform_fee_percent', '2.5', 'Platform fee % charged per order'),
    ('p2p_escrow_hold_hours', '24', 'Hours to hold P2P escrow before auto-release'),
    ('deposit_addresses', '{}', 'JSON map of chain → deposit wallet address'),
    ('chains_enabled', '["evm","solana","tron","ton"]', 'Enabled blockchain networks')
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────
-- TRIGGERS for new tables
-- ──────────────────────────────────────────────────
CREATE TRIGGER trg_user_wallets_upd
    BEFORE UPDATE ON user_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_wallet_deposits_upd
    BEFORE UPDATE ON wallet_deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_p2p_offers_upd
    BEFORE UPDATE ON p2p_offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_p2p_orders_upd
    BEFORE UPDATE ON p2p_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_p2p_disputes_upd
    BEFORE UPDATE ON p2p_disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ──────────────────────────────────────────────────
-- FUNCTION: Auto-expire P2P orders
--   Call via pg_cron or app-level cron job
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_p2p_orders()
RETURNS INT AS $$
DECLARE expired_count INT;
BEGIN
    WITH expired AS (
        UPDATE p2p_orders
        SET status = 'TIMEOUT', updated_at = NOW()
        WHERE status = 'PENDING' AND expires_at < NOW()
        RETURNING p2p_order_id, offer_id, token_amount
    )
    -- Return filled amount back to offer
    UPDATE p2p_offers o
    SET filled_amount = GREATEST(0, filled_amount - e.token_amount),
        status = CASE WHEN o.status = 'COMPLETED' THEN 'ACTIVE' ELSE o.status END
    FROM expired e WHERE o.offer_id = e.offer_id;

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────
-- SAMPLE TOKEN DATA (if not already seeded)
-- ──────────────────────────────────────────────────
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES
    ('USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 1,    6,  TRUE, '{"name":"Tether USD","chain":"Ethereum"}'),
    ('USDT', '0x55d398326f99059fF775485246999027B3197955', 56,   18, TRUE, '{"name":"Tether USD","chain":"BSC"}'),
    ('USDT', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 137,  6,  TRUE, '{"name":"Tether USD","chain":"Polygon"}'),
    ('USDC', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 1,    6,  TRUE, '{"name":"USD Coin","chain":"Ethereum"}'),
    ('USDC', '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 137,  6,  TRUE, '{"name":"USD Coin","chain":"Polygon"}'),
    ('ETH',  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 1,   18, TRUE, '{"name":"Ethereum","chain":"Ethereum","native":true}'),
    ('WETH', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 1,   18, TRUE, '{"name":"Wrapped ETH","chain":"Ethereum"}'),
    ('POL',  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 137, 18, TRUE, '{"name":"POL (MATIC)","chain":"Polygon","native":true}'),
    ('BNB',  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 56,  18, TRUE, '{"name":"BNB","chain":"BSC","native":true}')
ON CONFLICT (token_address, chain_id) DO NOTHING;

-- ──────────────────────────────────────────────────
-- DEFAULT WAREHOUSE (needed for inventory creation)
-- ──────────────────────────────────────────────────
INSERT INTO warehouses (name, code, country, province, address, status)
VALUES ('Main Warehouse', 'WH001', 'VN', 'Ho Chi Minh', '123 Nguyen Hue, Quan 1', 'active')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE product_accepted_tokens IS 'Multi-token pricing: each product can be priced in multiple tokens';
COMMENT ON TABLE user_wallets            IS 'Multi-chain wallet registry per user (EVM, Solana, TON, etc.)';
COMMENT ON TABLE wallet_deposits         IS 'On-chain deposit tracking for user funding';
COMMENT ON TABLE p2p_offers              IS 'P2P merchant listings (buy/sell crypto for fiat)';
COMMENT ON TABLE p2p_orders              IS 'Individual P2P trade orders created by takers';
COMMENT ON TABLE p2p_messages            IS 'In-order chat between P2P buyer and seller';
COMMENT ON TABLE p2p_disputes            IS 'P2P dispute records resolved by admin';
COMMENT ON TABLE platform_config         IS 'Runtime platform configuration key-value store';
