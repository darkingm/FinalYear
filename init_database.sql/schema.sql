-- ======================================================================
-- WEB3 MARKETPLACE — MASTER SCHEMA
-- Non-Custodial Multi-Chain E-Commerce Platform
-- Version: Final (Phase 4)
-- Safe to run on EXISTING DB: uses CREATE TABLE IF NOT EXISTS everywhere
--                              and ALTER TABLE ADD COLUMN IF NOT EXISTS
-- ======================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================================================================
-- SECTION 1: CORE USER MANAGEMENT
-- ======================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id         BIGSERIAL    PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    wallet_address  VARCHAR(42)  UNIQUE,
    username        VARCHAR(64)  UNIQUE,
    password_hash   VARCHAR(255),
    google_id       VARCHAR(255) UNIQUE,
    facebook_id     VARCHAR(255) UNIQUE,
    avatar_url      VARCHAR(500),
    phone           TEXT,
    address_line    TEXT,
    paypal_email    VARCHAR(255),
    role            VARCHAR(20)  NOT NULL DEFAULT 'buyer'
                        CHECK (role IN ('buyer', 'seller', 'admin')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_profiles (
    seller_id       BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT,
    logo_url        VARCHAR(255),
    slug            VARCHAR(120) UNIQUE,
    kyc_status      VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
    kyc_verified_at TIMESTAMP,
    payout_wallet   VARCHAR(42),                             -- nullable (wallet is optional)
    rating_avg      DECIMAL(3,2) DEFAULT 0.00
                        CHECK (rating_avg >= 0 AND rating_avg <= 5),
    total_sales     INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
    address_id   BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    full_name    VARCHAR(100) NOT NULL,
    phone        VARCHAR(20)  NOT NULL,
    country      VARCHAR(2)   NOT NULL,
    province     VARCHAR(100) NOT NULL,
    district     VARCHAR(100),
    address_line TEXT         NOT NULL,
    postal_code  VARCHAR(20),
    is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ======================================================================
-- SECTION 2: TOKEN WHITELIST
-- ======================================================================

CREATE TABLE IF NOT EXISTS token_whitelist (
    token_id          SERIAL       PRIMARY KEY,
    symbol            VARCHAR(10)  NOT NULL,
    token_address     VARCHAR(42)  NOT NULL,
    chain_id          INT          NOT NULL,
    decimals          INT          NOT NULL CHECK (decimals >= 0 AND decimals <= 18),
    oracle_price_feed VARCHAR(42),
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    metadata          JSONB,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_address, chain_id)
);

-- ======================================================================
-- SECTION 3: PRODUCT CATALOG
-- ======================================================================

CREATE TABLE IF NOT EXISTS products (
    product_id          BIGSERIAL     PRIMARY KEY,
    seller_id           BIGINT        NOT NULL,
    name                VARCHAR(255)  NOT NULL,
    description         TEXT,
    category            VARCHAR(50),
    base_price_usd      DECIMAL(18,2) NOT NULL CHECK (base_price_usd >= 0),
    token_id            INT,
    price_in_token      DECIMAL(36,18),
    low_stock_threshold INT           NOT NULL DEFAULT 5,
    metadata            JSONB,
    is_featured         BOOLEAN       NOT NULL DEFAULT FALSE,
    product_type        VARCHAR(20)   NOT NULL DEFAULT 'physical'
                            CHECK (product_type IN ('physical', 'digital', 'nft')),
    status              VARCHAR(20)   NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'active', 'inactive', 'deleted')),
    rating_avg          DECIMAL(3,2)  DEFAULT 0.00
                            CHECK (rating_avg >= 0 AND rating_avg <= 5),
    review_count        INT           NOT NULL DEFAULT 0,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id) ON DELETE CASCADE,
    FOREIGN KEY (token_id)  REFERENCES token_whitelist(token_id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_images (
    image_id    BIGSERIAL    PRIMARY KEY,
    product_id  BIGINT       NOT NULL,
    image_url   VARCHAR(500) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_primary  BOOLEAN      NOT NULL DEFAULT FALSE,
    alt_text    VARCHAR(255),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_variants (
    variant_id      BIGSERIAL     PRIMARY KEY,
    product_id      BIGINT        NOT NULL,
    sku             VARCHAR(100)  NOT NULL UNIQUE,
    attributes      JSONB,
    price_override  DECIMAL(18,2) CHECK (price_override >= 0),
    inventory_id    BIGINT,
    status          VARCHAR(20)   NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'out_of_stock')),
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

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

-- ======================================================================
-- SECTION 4: INVENTORY & WAREHOUSE
-- ======================================================================

CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id BIGSERIAL    PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    code         VARCHAR(20)  UNIQUE,
    country      VARCHAR(2)   NOT NULL,
    province     VARCHAR(100) NOT NULL,
    address      TEXT         NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
    inventory_id BIGSERIAL PRIMARY KEY,
    product_id   BIGINT    NOT NULL,
    warehouse_id BIGINT    NOT NULL,
    total_stock  INT       NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    available    INT       NOT NULL DEFAULT 0 CHECK (available >= 0),
    reserved     INT       NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    version      INT       NOT NULL DEFAULT 0,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)   REFERENCES products(product_id)     ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE RESTRICT,
    CONSTRAINT inventory_consistency CHECK (total_stock = available + reserved),
    UNIQUE(product_id, warehouse_id)
);

DO $$ BEGIN
  ALTER TABLE product_variants
      ADD CONSTRAINT fk_variant_inventory
      FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS inventory_locks (
    lock_id      BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT    NOT NULL,
    order_id     BIGINT,
    quantity     INT       NOT NULL CHECK (quantity > 0),
    expires_at   TIMESTAMP NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'released', 'expired', 'committed')),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id) ON DELETE CASCADE
);

-- ======================================================================
-- SECTION 5: SHOPPING CART
-- ======================================================================

CREATE TABLE IF NOT EXISTS carts (
    cart_id    BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
    cart_item_id   BIGSERIAL     PRIMARY KEY,
    cart_id        BIGINT        NOT NULL,
    product_id     BIGINT        NOT NULL,
    variant_id     BIGINT,
    quantity       INT           NOT NULL CHECK (quantity > 0),
    price_snapshot DECIMAL(18,2) NOT NULL CHECK (price_snapshot >= 0),
    added_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id)    REFERENCES carts(cart_id)               ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)         ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

-- ======================================================================
-- SECTION 6: ORDERS & PAYMENTS
-- ======================================================================

CREATE TABLE IF NOT EXISTS orders (
    order_id              BIGSERIAL     PRIMARY KEY,
    buyer_id              BIGINT        NOT NULL,
    seller_id             BIGINT        NOT NULL,
    shipping_address_id   BIGINT,
    order_number          VARCHAR(50)   NOT NULL UNIQUE,
    internal_order_id     VARCHAR(255),
    product_id            BIGINT,
    quantity              INT           NOT NULL CHECK (quantity > 0),
    price_usd             DECIMAL(18,2) NOT NULL CHECK (price_usd >= 0),
    subtotal              DECIMAL(18,2) NOT NULL CHECK (subtotal >= 0),
    shipping_fee          DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    discount_amount       DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount          DECIMAL(18,2) NOT NULL CHECK (total_amount >= 0),
    token_id              INT,
    amount_token          DECIMAL(36,18),
    chain_id              INT,
    escrow_contract       VARCHAR(42),
    tx_hash               VARCHAR(128),
    price_expires_at      TIMESTAMP,
    payment_method        VARCHAR(20),
    paypal_order_id       VARCHAR(100),
    paypal_capture_id     VARCHAR(100),
    coupon_code           VARCHAR(50),
    notes                 TEXT,
    nft_pending_delivery  BOOLEAN       DEFAULT FALSE,
    nft_delivered         BOOLEAN       DEFAULT FALSE,
    credit_updated        BOOLEAN       DEFAULT FALSE,
    status                VARCHAR(30)   NOT NULL DEFAULT 'UNPAID',
    metadata              JSONB,
    created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id)            REFERENCES users(user_id)             ON DELETE RESTRICT,
    FOREIGN KEY (seller_id)           REFERENCES seller_profiles(seller_id) ON DELETE RESTRICT,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses(address_id)      ON DELETE SET NULL
);

-- Normalize status to UPPER_SNAKE then add clean constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE orders SET status = CASE status
    WHEN 'pending'    THEN 'UNPAID'
    WHEN 'confirmed'  THEN 'ONCHAIN_CONFIRMED'
    WHEN 'processing' THEN 'PROCESSING'
    WHEN 'shipped'    THEN 'SHIPPED'
    WHEN 'delivered'  THEN 'DELIVERED'
    WHEN 'completed'  THEN 'COMPLETED'
    WHEN 'cancelled'  THEN 'CANCELLED'
    WHEN 'refunded'   THEN 'REFUNDED'
    ELSE status
END WHERE status IN ('pending','confirmed','processing','shipped','delivered','completed','cancelled','refunded');

ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'UNPAID','TX_SUBMITTED','TX_FAILED',
        'ONCHAIN_CONFIRMED','PAID','PAID_PAYPAL',
        'PROCESSING','SHIPPED','DELIVERED',
        'COMPLETED','CANCELLED','REFUNDED',
        'DELIVERING','DISPUTED'
    ));

-- total_usd generated column (idempotent via DO block)
DO $$ BEGIN
    ALTER TABLE orders ADD COLUMN total_usd DECIMAL(18,2) GENERATED ALWAYS AS (total_amount) STORED;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE inventory_locks
      ADD CONSTRAINT fk_lock_order
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id  BIGSERIAL     PRIMARY KEY,
    order_id       BIGINT        NOT NULL,
    product_id     BIGINT        NOT NULL,
    variant_id     BIGINT,
    quantity       INT           NOT NULL CHECK (quantity > 0),
    price_snapshot DECIMAL(18,2) NOT NULL CHECK (price_snapshot >= 0),
    subtotal       DECIMAL(18,2) NOT NULL CHECK (subtotal >= 0),
    FOREIGN KEY (order_id)   REFERENCES orders(order_id)             ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)         ON DELETE RESTRICT,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS order_payments (
    payment_id          BIGSERIAL      PRIMARY KEY,
    order_id            BIGINT         NOT NULL,
    token_id            INT            NOT NULL,
    amount              DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash             VARCHAR(66),
    chain_id            INT,
    block_number        BIGINT,
    status              VARCHAR(20)    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirming','confirmed','failed')),
    verified_by_rpc     BOOLEAN        DEFAULT FALSE,
    verified_by_indexer BOOLEAN        DEFAULT FALSE,
    confirmations       INT            DEFAULT 0,
    created_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id)          ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id          BIGSERIAL    PRIMARY KEY,
    order_id            BIGINT       NOT NULL,
    tx_hash             VARCHAR(128),
    chain_id            INT,
    payment_type        VARCHAR(20)  NOT NULL DEFAULT 'crypto'
                            CHECK (payment_type IN ('crypto', 'paypal', 'p2p')),
    amount              DECIMAL(36,18),
    token_id            INT REFERENCES token_whitelist(token_id) ON DELETE SET NULL,
    user_id             BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirming','confirmed','failed')),
    from_address        VARCHAR(128),
    to_address          VARCHAR(128),
    block_number        BIGINT,
    block_timestamp     TIMESTAMP,
    gas_used            VARCHAR(78),
    gas_price           BIGINT,
    verified_by_rpc     BOOLEAN      DEFAULT FALSE,
    verified_by_indexer BOOLEAN      DEFAULT FALSE,
    confirmations       INT          DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
    history_id BIGSERIAL   PRIMARY KEY,
    order_id   BIGINT      NOT NULL,
    old_status VARCHAR(30) NOT NULL,
    new_status VARCHAR(30) NOT NULL,
    notes      TEXT,
    changed_by BIGINT,
    changed_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id)   ON DELETE SET NULL
);

-- ======================================================================
-- SECTION 7: SHIPPING & LOGISTICS
-- ======================================================================

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id     BIGSERIAL     PRIMARY KEY,
    order_id        BIGINT        NOT NULL,
    carrier         VARCHAR(50)   NOT NULL,
    tracking_code   VARCHAR(100),
    shipping_fee    DECIMAL(18,2) NOT NULL CHECK (shipping_fee >= 0),
    status          VARCHAR(25)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending','picked_up','in_transit',
                            'out_for_delivery','delivered','failed','returned'
                        )),
    shipped_at      TIMESTAMP,
    delivered_at    TIMESTAMP,
    tracking_events JSONB,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- ======================================================================
-- SECTION 8: REFUNDS & DISPUTES
-- ======================================================================

CREATE TABLE IF NOT EXISTS refunds (
    refund_id         BIGSERIAL      PRIMARY KEY,
    order_id          BIGINT         NOT NULL,
    payment_id        BIGINT         NOT NULL,
    amount            DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash           VARCHAR(66),
    escrow_release_tx VARCHAR(66),
    reason            TEXT           NOT NULL,
    status            VARCHAR(20)    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','processing','completed','rejected')),
    approved_by       BIGINT,
    processed_at      TIMESTAMP,
    created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)    REFERENCES orders(order_id)           ON DELETE CASCADE,
    FOREIGN KEY (payment_id)  REFERENCES order_payments(payment_id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(user_id)             ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS disputes (
    dispute_id  BIGSERIAL  PRIMARY KEY,
    order_id    BIGINT     NOT NULL,
    raised_by   BIGINT     NOT NULL,
    resolver_id BIGINT,
    reason      TEXT       NOT NULL,
    evidence    JSONB,
    status      VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved','closed')),
    resolution  TEXT,
    resolved_at TIMESTAMP,
    created_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)    REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by)   REFERENCES users(user_id)   ON DELETE RESTRICT,
    FOREIGN KEY (resolver_id) REFERENCES users(user_id)   ON DELETE SET NULL
);

-- ======================================================================
-- SECTION 9: REVIEWS (Phase 3)
-- ======================================================================

CREATE TABLE IF NOT EXISTS reviews (
    review_id     BIGSERIAL  PRIMARY KEY,
    order_id      BIGINT     NOT NULL UNIQUE,          -- one review per order
    product_id    BIGINT     NOT NULL,
    buyer_id      BIGINT     NOT NULL,
    seller_id     BIGINT     NOT NULL,
    rating        SMALLINT   NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title         VARCHAR(100),
    content       TEXT,
    images        JSONB      DEFAULT '[]',
    helpful_count INTEGER    NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'published'
                      CHECK (status IN ('published','hidden','deleted')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (order_id)   REFERENCES orders(order_id)             ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)         ON DELETE CASCADE,
    FOREIGN KEY (buyer_id)   REFERENCES users(user_id)               ON DELETE CASCADE,
    FOREIGN KEY (seller_id)  REFERENCES seller_profiles(seller_id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_votes (
    review_id  BIGINT  NOT NULL,
    user_id    BIGINT  NOT NULL,
    is_helpful BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id),
    FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(user_id)     ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_score_events (
    event_id       BIGSERIAL   PRIMARY KEY,
    user_id        BIGINT      NOT NULL,
    event_type     VARCHAR(50) NOT NULL,
    score_delta    INTEGER     NOT NULL,
    reference_id   BIGINT,
    reference_type VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_type, reference_id, reference_type),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ======================================================================
-- SECTION 10: BLOCKCHAIN & CRYPTO INFRASTRUCTURE
-- ======================================================================

CREATE TABLE IF NOT EXISTS exchange_rates (
    rate_id   BIGSERIAL     PRIMARY KEY,
    token_id  INT           NOT NULL,
    usd_rate  DECIMAL(18,8) NOT NULL CHECK (usd_rate > 0),
    source    VARCHAR(50),
    timestamp TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id      BIGSERIAL   PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   BIGINT      NOT NULL,
    action      VARCHAR(50) NOT NULL,
    old_value   JSONB,
    new_value   JSONB,
    changed_by  BIGINT,
    metadata    JSONB,
    timestamp   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS platform_fees (
    fee_id           BIGSERIAL     PRIMARY KEY,
    order_id         BIGINT        NOT NULL,
    fee_amount_usd   DECIMAL(18,2) NOT NULL CHECK (fee_amount_usd >= 0),
    fee_percentage   DECIMAL(5,2)  NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    collector_wallet VARCHAR(42)   NOT NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','collected','failed')),
    created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dead_letter_events (
    event_id    BIGSERIAL   PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    payload     JSONB       NOT NULL,
    error_log   TEXT        NOT NULL,
    retry_count INT         NOT NULL DEFAULT 0,
    max_retries INT         DEFAULT 3,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','retrying','failed','resolved')),
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================
-- SECTION 11: NFT & CREDIT SCORE (Web3 RWA)
-- ======================================================================

CREATE TABLE IF NOT EXISTS product_nfts (
    nft_id        SERIAL      PRIMARY KEY,
    product_id    INTEGER     NOT NULL UNIQUE,
    token_uri     TEXT,
    physical_hash VARCHAR(66),
    tx_hash       VARCHAR(66),
    token_id      BIGINT,
    contract_addr VARCHAR(42),
    has_nfc       BOOLEAN     DEFAULT FALSE,
    nfc_verified  BOOLEAN     DEFAULT FALSE,
    delivered_at  TIMESTAMPTZ,
    minted_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_credit_scores (
    credit_id        SERIAL      PRIMARY KEY,
    user_id          INTEGER     NOT NULL UNIQUE,
    wallet_address   VARCHAR(42) NOT NULL,
    score            INTEGER     DEFAULT 0,
    tier             VARCHAR(10) DEFAULT 'BRONZE'
                         CHECK (tier IN ('BRONZE','SILVER','GOLD','DIAMOND')),
    sbt_token_id     BIGINT,
    completed_orders INTEGER     DEFAULT 0,
    dispute_count    INTEGER     DEFAULT 0,
    last_updated     TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ======================================================================
-- SECTION 12: MULTI-CHAIN WALLETS
-- ======================================================================

CREATE TABLE IF NOT EXISTS user_wallets (
    wallet_db_id BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    chain_type   VARCHAR(20)  NOT NULL
                     CHECK (chain_type IN (
                         'evm','solana','tron','ton',
                         'aptos','near','cosmos','bitcoin'
                     )),
    chain_id     INT,
    address      VARCHAR(128) NOT NULL,
    label        VARCHAR(100),
    is_primary   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    verified_at  TIMESTAMP,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE (user_id, chain_type, address)
);

CREATE TABLE IF NOT EXISTS wallet_deposits (
    deposit_id   BIGSERIAL      PRIMARY KEY,
    user_id      BIGINT         NOT NULL,
    wallet_db_id BIGINT,
    token_id     INT            NOT NULL,
    chain_id     INT            NOT NULL,
    amount       DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash      VARCHAR(128)   NOT NULL,
    from_address VARCHAR(128)   NOT NULL,
    to_address   VARCHAR(128)   NOT NULL,
    block_number BIGINT,
    confirmations INT           DEFAULT 0,
    status       VARCHAR(20)    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirming','confirmed','failed')),
    credited_at  TIMESTAMP,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)      REFERENCES users(user_id)             ON DELETE RESTRICT,
    FOREIGN KEY (wallet_db_id) REFERENCES user_wallets(wallet_db_id) ON DELETE SET NULL,
    FOREIGN KEY (token_id)     REFERENCES token_whitelist(token_id)  ON DELETE RESTRICT,
    UNIQUE (tx_hash, chain_id)
);

-- ======================================================================
-- SECTION 13: P2P TRADING
-- ======================================================================

CREATE SEQUENCE IF NOT EXISTS p2p_order_ref_seq START 1000;

CREATE TABLE IF NOT EXISTS p2p_offers (
    offer_id         BIGSERIAL      PRIMARY KEY,
    creator_id       BIGINT         NOT NULL,
    offer_type       VARCHAR(10)    NOT NULL CHECK (offer_type IN ('BUY','SELL')),
    token_id         INT            NOT NULL,
    fiat_currency    VARCHAR(10)    NOT NULL DEFAULT 'USD',
    price_per_unit   DECIMAL(18,4)  NOT NULL CHECK (price_per_unit > 0),
    min_amount       DECIMAL(18,4)  NOT NULL CHECK (min_amount > 0),
    max_amount       DECIMAL(18,4)  NOT NULL CHECK (max_amount > 0),
    total_amount     DECIMAL(36,18) NOT NULL CHECK (total_amount > 0),
    filled_amount    DECIMAL(36,18) NOT NULL DEFAULT 0,
    payment_methods  JSONB          NOT NULL DEFAULT '[]',
    payment_time_limit INT          NOT NULL DEFAULT 15,
    terms            TEXT,
    auto_release     BOOLEAN        NOT NULL DEFAULT FALSE,
    status           VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','PAUSED','COMPLETED','CANCELLED')),
    created_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(user_id)            ON DELETE RESTRICT,
    FOREIGN KEY (token_id)   REFERENCES token_whitelist(token_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS p2p_orders (
    p2p_order_id    BIGSERIAL      PRIMARY KEY,
    order_ref       VARCHAR(30)    NOT NULL UNIQUE DEFAULT ('P2P-' || LPAD(nextval('p2p_order_ref_seq')::text, 8, '0')),
    offer_id        BIGINT         NOT NULL,
    buyer_id        BIGINT         NOT NULL,
    seller_id       BIGINT         NOT NULL,
    token_id        INT            NOT NULL,
    fiat_currency   VARCHAR(10)    NOT NULL DEFAULT 'USD',
    fiat_amount     DECIMAL(18,4)  NOT NULL CHECK (fiat_amount > 0),
    token_amount    DECIMAL(36,18) NOT NULL CHECK (token_amount > 0),
    price_per_unit  DECIMAL(18,4)  NOT NULL,
    payment_method  VARCHAR(50)    NOT NULL,
    payment_proof   JSONB          DEFAULT '[]',
    expires_at      TIMESTAMPTZ,
    payment_paid_at TIMESTAMPTZ,
    confirmed_at    TIMESTAMPTZ,
    released_at     TIMESTAMPTZ,
    status          VARCHAR(30)    NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN (
                            'PENDING','PAID','CONFIRMED','RELEASED',
                            'CANCELLED','DISPUTED',
                            'RESOLVED_BUYER','RESOLVED_SELLER','TIMEOUT'
                        )),
    admin_notes     TEXT,
    created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (offer_id)  REFERENCES p2p_offers(offer_id)        ON DELETE RESTRICT,
    FOREIGN KEY (buyer_id)  REFERENCES users(user_id)              ON DELETE RESTRICT,
    FOREIGN KEY (seller_id) REFERENCES users(user_id)              ON DELETE RESTRICT,
    FOREIGN KEY (token_id)  REFERENCES token_whitelist(token_id)   ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS p2p_messages (
    message_id   BIGSERIAL    PRIMARY KEY,
    p2p_order_id BIGINT       NOT NULL,
    sender_id    BIGINT       NOT NULL,
    message      TEXT,
    attachments  JSONB        DEFAULT '[]',
    is_system    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (p2p_order_id) REFERENCES p2p_orders(p2p_order_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)    REFERENCES users(user_id)           ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS p2p_disputes (
    dispute_id   BIGSERIAL   PRIMARY KEY,
    p2p_order_id BIGINT      NOT NULL,
    raised_by    BIGINT      NOT NULL,
    reason       VARCHAR(100) NOT NULL,
    description  TEXT,
    evidence     JSONB        DEFAULT '[]',
    status       VARCHAR(30)  NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','CLOSED')),
    resolution   VARCHAR(50),
    admin_notes  TEXT,
    resolver_id  BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (p2p_order_id) REFERENCES p2p_orders(p2p_order_id) ON DELETE RESTRICT,
    FOREIGN KEY (raised_by)    REFERENCES users(user_id)           ON DELETE RESTRICT,
    FOREIGN KEY (resolver_id)  REFERENCES users(user_id)           ON DELETE SET NULL
);

-- ======================================================================
-- SECTION 14: ENGAGEMENT & MARKETING
-- ======================================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    type            VARCHAR(50)  NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT         NOT NULL,
    payload         JSONB,
    is_read         BOOLEAN       NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupons (
    coupon_id      BIGSERIAL     PRIMARY KEY,
    code           VARCHAR(50)   NOT NULL UNIQUE,
    discount_type  VARCHAR(20)   NOT NULL CHECK (discount_type IN ('percentage','fixed')),
    discount_value DECIMAL(18,2) NOT NULL CHECK (discount_value > 0),
    min_purchase   DECIMAL(18,2) CHECK (min_purchase >= 0),
    max_uses       INT,
    used_count     INT           NOT NULL DEFAULT 0,
    valid_from     TIMESTAMP     NOT NULL,
    valid_until    TIMESTAMP     NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','inactive','expired')),
    created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlist_items (
    wishlist_id BIGSERIAL PRIMARY KEY,
    user_id     BIGINT    NOT NULL,
    product_id  BIGINT    NOT NULL,
    added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS platform_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB        NOT NULL,
    description TEXT,
    updated_by  BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ======================================================================
-- INDEXES (all idempotent)
-- ======================================================================

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet     ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_status     ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_google     ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_facebook   ON users(facebook_id);

CREATE INDEX IF NOT EXISTS idx_seller_user_id   ON seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_kyc       ON seller_profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_seller_rating    ON seller_profiles(rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_seller_slug      ON seller_profiles(slug);

CREATE INDEX IF NOT EXISTS idx_addresses_user    ON addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_products_seller   ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_rating   ON products(rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_products_created  ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(base_price_usd);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id, is_primary) WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_variants_product   ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku       ON product_variants(sku);

CREATE INDEX IF NOT EXISTS idx_pat_product ON product_accepted_tokens(product_id);
CREATE INDEX IF NOT EXISTS idx_pat_token   ON product_accepted_tokens(token_id);

CREATE INDEX IF NOT EXISTS idx_inventory_product   ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_orders_buyer    ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller   ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number   ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tx_hash  ON orders(tx_hash);

CREATE INDEX IF NOT EXISTS idx_op_order   ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_op_status  ON order_payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_order   ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON payments(status);

CREATE INDEX IF NOT EXISTS idx_shipments_order    ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status   ON shipments(status);

CREATE INDEX IF NOT EXISTS idx_reviews_product  ON reviews(product_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_reviews_seller   ON reviews(seller_id)  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_reviews_buyer    ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_credit_events_user ON credit_score_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tokens_symbol  ON token_whitelist(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_chain   ON token_whitelist(chain_id);
CREATE INDEX IF NOT EXISTS idx_tokens_active  ON token_whitelist(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_nfts_product ON product_nfts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_nfts_tx      ON product_nfts(tx_hash);
CREATE INDEX IF NOT EXISTS idx_credit_scores_user   ON user_credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_wallet ON user_credit_scores(wallet_address);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user    ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_address ON user_wallets(address);

CREATE INDEX IF NOT EXISTS idx_deposits_user    ON wallet_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_tx      ON wallet_deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_deposits_status  ON wallet_deposits(status);

CREATE INDEX IF NOT EXISTS idx_p2p_offers_creator ON p2p_offers(creator_id);
CREATE INDEX IF NOT EXISTS idx_p2p_offers_status  ON p2p_offers(status);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer   ON p2p_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller  ON p2p_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_status  ON p2p_orders(status);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_order  ON p2p_disputes(p2p_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status ON p2p_disputes(status) WHERE status != 'CLOSED';

-- ======================================================================
-- TRIGGERS — updated_at (helper function)
-- ======================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','seller_profiles','addresses','products','product_variants',
    'warehouses','inventory','carts','orders','order_payments','payments',
    'shipments','disputes','reviews','coupons','dead_letter_events',
    'user_wallets','wallet_deposits','p2p_offers','p2p_orders','p2p_disputes'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_upd ON %I;
       CREATE TRIGGER trg_%s_upd BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ======================================================================
-- TRIGGERS — Rating aggregation
-- ======================================================================

CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products SET
        rating_avg   = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM reviews WHERE product_id = NEW.product_id AND status='published'), 0.00),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status='published')
    WHERE product_id = NEW.product_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_rating ON reviews;
CREATE TRIGGER trg_product_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE seller_profiles SET
        rating_avg = COALESCE((
            SELECT ROUND(AVG(r.rating)::numeric,2)
            FROM reviews r JOIN products p ON r.product_id = p.product_id
            WHERE p.seller_id = (SELECT seller_id FROM products WHERE product_id = NEW.product_id)
              AND r.status = 'published'
        ), 0.00)
    WHERE seller_id = (SELECT seller_id FROM products WHERE product_id = NEW.product_id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seller_rating ON reviews;
CREATE TRIGGER trg_seller_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

-- ======================================================================
-- TRIGGERS — Order status history + inventory reservation
-- ======================================================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, old_status, new_status)
        VALUES (NEW.order_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_status_history ON orders;
CREATE TRIGGER trg_order_status_history
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

CREATE OR REPLACE FUNCTION reserve_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' THEN
        UPDATE inventory SET
            available = available - NEW.quantity,
            reserved  = reserved  + NEW.quantity
        WHERE inventory_id = NEW.inventory_id;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reserve_inventory ON inventory_locks;
CREATE TRIGGER trg_reserve_inventory
AFTER INSERT ON inventory_locks
FOR EACH ROW EXECUTE FUNCTION reserve_inventory();

CREATE OR REPLACE FUNCTION release_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('released','expired') AND OLD.status = 'active' THEN
        UPDATE inventory SET
            available = available + OLD.quantity,
            reserved  = reserved  - OLD.quantity
        WHERE inventory_id = OLD.inventory_id;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_release_inventory ON inventory_locks;
CREATE TRIGGER trg_release_inventory
AFTER UPDATE ON inventory_locks
FOR EACH ROW EXECUTE FUNCTION release_inventory();

-- ======================================================================
-- VIEWS
-- ======================================================================

CREATE OR REPLACE VIEW v_active_products AS
SELECT p.*, sp.display_name AS seller_name, sp.rating_avg AS seller_rating, sp.slug AS seller_slug,
    (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image
FROM products p JOIN seller_profiles sp ON p.seller_id = sp.seller_id WHERE p.status = 'active';

CREATE OR REPLACE VIEW products_with_nft AS
SELECT p.*,
    n.token_uri, n.physical_hash,
    n.tx_hash       AS nft_tx_hash,
    n.token_id      AS nft_token_id,
    n.contract_addr AS nft_contract,
    n.has_nfc, n.nfc_verified,
    n.minted_at     AS nft_minted_at,
    CASE WHEN n.nft_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_nft
FROM products p LEFT JOIN product_nfts n ON n.product_id = p.product_id;

CREATE OR REPLACE VIEW user_credit_summary AS
SELECT u.user_id, u.username, u.email, u.wallet_address,
    COALESCE(cs.score, 0)             AS credit_score,
    COALESCE(cs.tier, 'BRONZE')       AS credit_tier,
    COALESCE(cs.completed_orders, 0)  AS completed_orders,
    COALESCE(cs.dispute_count, 0)     AS dispute_count,
    cs.sbt_token_id,
    cs.last_updated AS credit_last_updated
FROM users u LEFT JOIN user_credit_scores cs ON cs.user_id = u.user_id;

-- ======================================================================
-- DEFAULT SEED DATA (idempotent)
-- ======================================================================

INSERT INTO warehouses (name, code, country, province, address, status)
VALUES ('Main Warehouse', 'WH001', 'VN', 'Ho Chi Minh', '123 Nguyen Hue, Quan 1', 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata) VALUES
    ('USDT','0xdAC17F958D2ee523a2206206994597C13D831ec7',1,  6, TRUE,'{"name":"Tether USD","chain":"Ethereum"}'),
    ('USDT','0x55d398326f99059fF775485246999027B3197955',56, 18,TRUE,'{"name":"Tether USD","chain":"BSC"}'),
    ('USDT','0xc2132D05D31c914a87C6611C10748AEb04B58e8F',137,6, TRUE,'{"name":"Tether USD","chain":"Polygon"}'),
    ('USDC','0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',1,  6, TRUE,'{"name":"USD Coin","chain":"Ethereum"}'),
    ('USDC','0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',137,6, TRUE,'{"name":"USD Coin","chain":"Polygon"}'),
    ('ETH', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',1,  18,TRUE,'{"name":"Ethereum","chain":"Ethereum","native":true}'),
    ('WETH','0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',1,  18,TRUE,'{"name":"Wrapped ETH","chain":"Ethereum"}'),
    ('POL', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',137,18,TRUE,'{"name":"POL (MATIC)","chain":"Polygon","native":true}'),
    ('BNB', '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',56, 18,TRUE,'{"name":"BNB","chain":"BSC","native":true}')
ON CONFLICT (token_address, chain_id) DO NOTHING;

INSERT INTO platform_config (key, value, description) VALUES
    ('platform_fee_percent',   '2.5',                          'Platform fee % per order'),
    ('p2p_escrow_hold_hours',  '24',                           'P2P escrow hold hours'),
    ('deposit_addresses',      '{}',                           'chain → deposit wallet map'),
    ('chains_enabled',         '["evm","solana","tron","ton"]','Enabled blockchains')
ON CONFLICT (key) DO NOTHING;

-- ======================================================================
-- FINAL VERIFICATION
-- ======================================================================
SELECT
    COUNT(*) AS total_tables,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') AS total_views,
    NOW() AS migrated_at
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
