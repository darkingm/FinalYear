-- =====================================================
-- WEB3 MARKETPLACE — FINAL SCHEMA  (01_schema.sql)
-- Non-Custodial Multi-Chain E-Commerce Platform
-- Merged final: all migrations consolidated
-- Used by: docker-compose postgres init
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SECTION 1: CORE USER MANAGEMENT
-- =====================================================

CREATE TABLE users (
    user_id         BIGSERIAL    PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    wallet_address  VARCHAR(42)  UNIQUE,                    -- nullable: OAuth users may register without wallet
    username        VARCHAR(64)  UNIQUE,
    password_hash   VARCHAR(255),                           -- bcrypt hash (email/password login)
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

CREATE TABLE seller_profiles (
    seller_id       BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT,
    logo_url        VARCHAR(255),
    slug            VARCHAR(120) UNIQUE,
    kyc_status      VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
    kyc_verified_at TIMESTAMP,
    payout_wallet   VARCHAR(42)  NOT NULL,
    rating_avg      DECIMAL(3,2) DEFAULT 0.00
                        CHECK (rating_avg >= 0 AND rating_avg <= 5),
    total_sales     INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE addresses (
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

-- =====================================================
-- SECTION 2: PRODUCT CATALOG
-- =====================================================

CREATE TABLE token_whitelist (
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

CREATE TABLE products (
    product_id      BIGSERIAL     PRIMARY KEY,
    seller_id       BIGINT        NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    description     TEXT,
    category        VARCHAR(50),
    base_price_usd  DECIMAL(18,2) NOT NULL CHECK (base_price_usd >= 0),
    token_id        INT,                                    -- ID from token_whitelist
    price_in_token  DECIMAL(36,18),                         -- Price in the specific token
    metadata        JSONB,
    is_featured     BOOLEAN       NOT NULL DEFAULT FALSE,
    product_type    VARCHAR(20)   NOT NULL DEFAULT 'physical'
                        CHECK (product_type IN ('physical', 'digital', 'nft')),
    status          VARCHAR(20)   NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'inactive', 'deleted')),
    rating_avg      DECIMAL(3,2)  DEFAULT 0.00
                        CHECK (rating_avg >= 0 AND rating_avg <= 5),
    review_count    INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id) ON DELETE CASCADE,
    FOREIGN KEY (token_id)  REFERENCES token_whitelist(token_id) ON DELETE SET NULL
);

CREATE TABLE product_images (
    image_id    BIGSERIAL    PRIMARY KEY,
    product_id  BIGINT       NOT NULL,
    image_url   VARCHAR(500) NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_primary  BOOLEAN      NOT NULL DEFAULT FALSE,
    alt_text    VARCHAR(255),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

CREATE TABLE product_variants (
    variant_id      BIGSERIAL     PRIMARY KEY,
    product_id      BIGINT        NOT NULL,
    sku             VARCHAR(100)  NOT NULL UNIQUE,
    attributes      JSONB,
    price_override  DECIMAL(18,2) CHECK (price_override >= 0),
    inventory_id    BIGINT,                            -- FK added after inventory table
    status          VARCHAR(20)   NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'out_of_stock')),
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 3: INVENTORY & WAREHOUSE
-- =====================================================

CREATE TABLE warehouses (
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

CREATE TABLE inventory (
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

ALTER TABLE product_variants
    ADD CONSTRAINT fk_variant_inventory
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id) ON DELETE SET NULL;

CREATE TABLE inventory_locks (
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

-- =====================================================
-- SECTION 4: SHOPPING CART
-- =====================================================

CREATE TABLE carts (
    cart_id    BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
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

-- =====================================================
-- SECTION 5: ORDERS & PAYMENTS
-- =====================================================

CREATE TABLE orders (
    order_id            BIGSERIAL     PRIMARY KEY,
    buyer_id            BIGINT        NOT NULL,
    seller_id           BIGINT        NOT NULL,
    shipping_address_id BIGINT,
    order_number        VARCHAR(50)   NOT NULL UNIQUE,
    internal_order_id   VARCHAR(255),
    product_id          BIGINT,
    quantity            INT           NOT NULL CHECK (quantity > 0),
    price_usd           DECIMAL(18,2) NOT NULL CHECK (price_usd >= 0),
    subtotal            DECIMAL(18,2) NOT NULL CHECK (subtotal >= 0),
    shipping_fee        DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    discount_amount     DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount        DECIMAL(18,2) NOT NULL CHECK (total_amount >= 0),
    token_id            INT,
    amount_token        DECIMAL(36,18),
    chain_id            INT,
    escrow_contract     VARCHAR(42),
    tx_hash             VARCHAR(128),
    price_expires_at    TIMESTAMP,
    payment_method      VARCHAR(20),
    paypal_order_id     VARCHAR(100),
    paypal_capture_id   VARCHAR(100),
    coupon_code         VARCHAR(50),
    notes               TEXT,
    status              VARCHAR(30)   NOT NULL DEFAULT 'UNPAID'
                            CHECK (status IN (
                                'UNPAID','TX_SUBMITTED','TX_FAILED',
                                'ONCHAIN_CONFIRMED','PAID','PAID_PAYPAL',
                                'pending','confirmed','processing',
                                'shipped','delivered','completed',
                                'cancelled','refunded',
                                'DELIVERING','COMPLETED','DISPUTED'
                            )),
    metadata            JSONB,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id)            REFERENCES users(user_id)             ON DELETE RESTRICT,
    FOREIGN KEY (seller_id)           REFERENCES seller_profiles(seller_id) ON DELETE RESTRICT,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses(address_id)      ON DELETE SET NULL
);

ALTER TABLE inventory_locks
    ADD CONSTRAINT fk_lock_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE;

CREATE TABLE order_items (
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


CREATE TABLE order_payments (
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

-- Used by payment-service tx-monitor worker (crypto + PayPal)
CREATE TABLE payments (
    payment_id          BIGSERIAL    PRIMARY KEY,
    order_id            BIGINT       NOT NULL,
    tx_hash             VARCHAR(128),
    chain_id            INT,
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

CREATE TABLE order_status_history (
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

-- =====================================================
-- SECTION 6: SHIPPING & LOGISTICS
-- =====================================================

CREATE TABLE shipments (
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

-- =====================================================
-- SECTION 7: REFUNDS & DISPUTES
-- =====================================================

CREATE TABLE refunds (
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

CREATE TABLE disputes (
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

-- =====================================================
-- SECTION 8: REVIEWS
-- =====================================================

CREATE TABLE reviews (
    review_id  BIGSERIAL  PRIMARY KEY,
    order_id   BIGINT     NOT NULL,
    product_id BIGINT     NOT NULL,
    buyer_id   BIGINT     NOT NULL,
    rating     INT        NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    reply      TEXT,
    images     JSONB,
    status     VARCHAR(20) NOT NULL DEFAULT 'published'
                   CHECK (status IN ('draft','published','flagged','removed')),
    created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id)   ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id)   REFERENCES users(user_id)     ON DELETE CASCADE,
    UNIQUE(order_id, product_id, buyer_id)
);

-- =====================================================
-- SECTION 9: BLOCKCHAIN & CRYPTO
-- =====================================================

CREATE TABLE exchange_rates (
    rate_id   BIGSERIAL     PRIMARY KEY,
    token_id  INT           NOT NULL,
    usd_rate  DECIMAL(18,8) NOT NULL CHECK (usd_rate > 0),
    source    VARCHAR(50),
    timestamp TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
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

CREATE TABLE platform_fees (
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

CREATE TABLE dead_letter_events (
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

-- =====================================================
-- SECTION 10: ENGAGEMENT & MARKETING
-- =====================================================

CREATE TABLE notifications (
    notification_id BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    type            VARCHAR(50)  NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT         NOT NULL,
    payload         JSONB,
    is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE coupons (
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

CREATE TABLE wishlist_items (
    wishlist_id BIGSERIAL PRIMARY KEY,
    user_id     BIGINT    NOT NULL,
    product_id  BIGINT    NOT NULL,
    added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    UNIQUE(user_id, product_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_wallet     ON users(wallet_address);
CREATE INDEX idx_users_status     ON users(status);
CREATE INDEX idx_users_role       ON users(role);
CREATE INDEX idx_users_google     ON users(google_id);
CREATE INDEX idx_users_facebook   ON users(facebook_id);

CREATE INDEX idx_seller_user_id   ON seller_profiles(user_id);
CREATE INDEX idx_seller_kyc       ON seller_profiles(kyc_status);
CREATE INDEX idx_seller_rating    ON seller_profiles(rating_avg DESC);
CREATE INDEX idx_seller_slug      ON seller_profiles(slug);

CREATE INDEX idx_addresses_user    ON addresses(user_id);
CREATE INDEX idx_addresses_default ON addresses(user_id, is_default) WHERE is_default = TRUE;

CREATE INDEX idx_products_seller   ON products(seller_id);
CREATE INDEX idx_products_status   ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_rating   ON products(rating_avg DESC);
CREATE INDEX idx_products_created  ON products(created_at DESC);
CREATE INDEX idx_products_price    ON products(base_price_usd);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_type     ON products(product_type);

CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_primary ON product_images(product_id, is_primary) WHERE is_primary = TRUE;

CREATE INDEX idx_variants_product   ON product_variants(product_id);
CREATE INDEX idx_variants_sku       ON product_variants(sku);
CREATE INDEX idx_variants_inventory ON product_variants(inventory_id);

CREATE INDEX idx_warehouses_status  ON warehouses(status);
CREATE INDEX idx_warehouses_country ON warehouses(country);

CREATE INDEX idx_inventory_product   ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_available ON inventory(product_id) WHERE available > 0;
CREATE UNIQUE INDEX idx_inventory_unique ON inventory(product_id, warehouse_id);

CREATE INDEX idx_locks_inventory ON inventory_locks(inventory_id);
CREATE INDEX idx_locks_order     ON inventory_locks(order_id);
CREATE INDEX idx_locks_status    ON inventory_locks(status);
CREATE INDEX idx_locks_expires   ON inventory_locks(expires_at) WHERE status = 'active';

CREATE INDEX idx_carts_user   ON carts(user_id);
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_cart_items_cart    ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

CREATE INDEX idx_orders_buyer    ON orders(buyer_id);
CREATE INDEX idx_orders_seller   ON orders(seller_id);
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_orders_number   ON orders(order_number);
CREATE INDEX idx_orders_created  ON orders(created_at DESC);
CREATE INDEX idx_orders_address  ON orders(shipping_address_id);
CREATE INDEX idx_orders_internal ON orders(internal_order_id);
CREATE INDEX idx_orders_tx_hash  ON orders(tx_hash);
CREATE INDEX idx_orders_paypal   ON orders(paypal_order_id);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

CREATE INDEX idx_op_order   ON order_payments(order_id);
CREATE INDEX idx_op_token   ON order_payments(token_id);
CREATE INDEX idx_op_tx_hash ON order_payments(tx_hash);
CREATE INDEX idx_op_status  ON order_payments(status);
CREATE INDEX idx_op_chain   ON order_payments(chain_id);

CREATE INDEX idx_payments_order   ON payments(order_id);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_status  ON payments(status);

CREATE INDEX idx_order_history_order   ON order_status_history(order_id);
CREATE INDEX idx_order_history_changed ON order_status_history(changed_at DESC);

CREATE INDEX idx_shipments_order    ON shipments(order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_code);
CREATE INDEX idx_shipments_status   ON shipments(status);

CREATE INDEX idx_refunds_order   ON refunds(order_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_status  ON refunds(status);

CREATE INDEX idx_disputes_order     ON disputes(order_id);
CREATE INDEX idx_disputes_raised_by ON disputes(raised_by);
CREATE INDEX idx_disputes_status    ON disputes(status);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_buyer   ON reviews(buyer_id);
CREATE INDEX idx_reviews_order   ON reviews(order_id);
CREATE INDEX idx_reviews_rating  ON reviews(rating);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

CREATE INDEX idx_tokens_symbol  ON token_whitelist(symbol);
CREATE INDEX idx_tokens_chain   ON token_whitelist(chain_id);
CREATE INDEX idx_tokens_active  ON token_whitelist(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_exchange_rates_token     ON exchange_rates(token_id);
CREATE INDEX idx_exchange_rates_timestamp ON exchange_rates(timestamp DESC);

CREATE INDEX idx_audit_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp  ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_changed_by ON audit_logs(changed_by);

CREATE INDEX idx_platform_fees_order  ON platform_fees(order_id);
CREATE INDEX idx_platform_fees_status ON platform_fees(status);

CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_read    ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX idx_coupons_code   ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_valid  ON coupons(valid_from, valid_until) WHERE status = 'active';

CREATE INDEX idx_wishlist_user    ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_product ON wishlist_items(product_id);

CREATE INDEX idx_dlq_status     ON dead_letter_events(status);
CREATE INDEX idx_dlq_event_type ON dead_letter_events(event_type);

-- =====================================================
-- TRIGGERS — updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd            BEFORE UPDATE ON users             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_seller_upd           BEFORE UPDATE ON seller_profiles   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_addresses_upd        BEFORE UPDATE ON addresses         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_upd         BEFORE UPDATE ON products          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_variants_upd         BEFORE UPDATE ON product_variants  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_warehouses_upd       BEFORE UPDATE ON warehouses        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_upd        BEFORE UPDATE ON inventory         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_carts_upd            BEFORE UPDATE ON carts             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_orders_upd           BEFORE UPDATE ON orders            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_order_payments_upd   BEFORE UPDATE ON order_payments    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_shipments_upd        BEFORE UPDATE ON shipments         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_disputes_upd         BEFORE UPDATE ON disputes          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_reviews_upd          BEFORE UPDATE ON reviews           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coupons_upd          BEFORE UPDATE ON coupons           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_dlq_upd              BEFORE UPDATE ON dead_letter_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGERS — rating aggregation
-- =====================================================

CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products SET
        rating_avg   = COALESCE((SELECT ROUND(AVG(rating)::numeric,2) FROM reviews WHERE product_id = NEW.product_id AND status='published'), 0.00),
        review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status='published')
    WHERE product_id = NEW.product_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

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

CREATE TRIGGER trg_seller_rating
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

-- =====================================================
-- TRIGGERS — order status history
-- =====================================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, old_status, new_status)
        VALUES (NEW.order_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_status_history
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- =====================================================
-- TRIGGERS — inventory reservation
-- =====================================================

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

CREATE TRIGGER trg_release_inventory
AFTER UPDATE ON inventory_locks
FOR EACH ROW EXECUTE FUNCTION release_inventory();

-- =====================================================
-- VIEWS
-- =====================================================

CREATE VIEW v_active_products AS
SELECT p.*, sp.display_name AS seller_name, sp.rating_avg AS seller_rating, sp.slug AS seller_slug,
    (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) AS primary_image
FROM products p JOIN seller_profiles sp ON p.seller_id = sp.seller_id WHERE p.status = 'active';

CREATE VIEW v_order_summary AS
SELECT o.*, u.email AS buyer_email, sp.display_name AS seller_name,
    COUNT(DISTINCT op.payment_id) AS payment_count,
    SUM(op.amount)                AS total_paid,
    STRING_AGG(DISTINCT tw.symbol, ', ') AS payment_tokens
FROM orders o
JOIN users u            ON o.buyer_id  = u.user_id
JOIN seller_profiles sp ON o.seller_id = sp.seller_id
LEFT JOIN order_payments op ON o.order_id  = op.order_id
LEFT JOIN token_whitelist tw ON op.token_id = tw.token_id
GROUP BY o.order_id, u.email, sp.display_name;

CREATE VIEW v_inventory_available AS
SELECT p.product_id, p.name AS product_name, w.warehouse_id, w.name AS warehouse_name,
       i.total_stock, i.available, i.reserved
FROM inventory i
JOIN products   p ON i.product_id   = p.product_id
JOIN warehouses w ON i.warehouse_id = w.warehouse_id
WHERE i.available > 0;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE users                IS 'Core accounts – email/password, OAuth, wallet auth';
COMMENT ON TABLE seller_profiles      IS 'Seller info + KYC + rating';
COMMENT ON TABLE addresses            IS 'Shipping / billing addresses';
COMMENT ON TABLE products             IS 'Product catalog';
COMMENT ON TABLE product_images       IS 'Image gallery per product';
COMMENT ON TABLE product_variants     IS 'SKU variants (size, color …)';
COMMENT ON TABLE warehouses           IS 'Warehouse / storage locations';
COMMENT ON TABLE inventory            IS 'Stock levels with optimistic locking';
COMMENT ON TABLE inventory_locks      IS 'Checkout reservations (TTL via expires_at)';
COMMENT ON TABLE carts                IS 'Shopping carts';
COMMENT ON TABLE cart_items           IS 'Cart line items with price snapshot';
COMMENT ON TABLE orders               IS 'Customer orders – crypto & PayPal';
COMMENT ON TABLE order_items          IS 'Order line items';
COMMENT ON TABLE token_whitelist      IS 'Accepted ERC-20 tokens';
COMMENT ON TABLE order_payments       IS 'On-chain payment confirmations';
COMMENT ON TABLE payments             IS 'Simplified payment rows for tx-monitor';
COMMENT ON TABLE order_status_history IS 'Immutable order status audit trail';
COMMENT ON TABLE shipments            IS 'Carrier + tracking info';
COMMENT ON TABLE refunds              IS 'Refund records + escrow release tx';
COMMENT ON TABLE disputes             IS 'Dispute workflow';
COMMENT ON TABLE reviews              IS 'Buyer reviews 1–5 ★';
COMMENT ON TABLE exchange_rates       IS 'Token ↔ USD rate cache';
COMMENT ON TABLE audit_logs           IS 'System-wide change audit';
COMMENT ON TABLE platform_fees        IS '2.5 % fee per order';
COMMENT ON TABLE notifications        IS 'In-app notification feed';
COMMENT ON TABLE coupons              IS 'Discount codes with limits';
COMMENT ON TABLE wishlist_items       IS 'User product wish-list';
COMMENT ON TABLE dead_letter_events   IS 'Failed async events queue';


/* --- Added from 02_p2p_multichain.sql --- */
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


/* --- Added from 03_fix_disputes.sql --- */
-- Fix script: create p2p_disputes table if it failed in the main migration
-- Safe to run: uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS p2p_disputes (
  dispute_id     SERIAL PRIMARY KEY,
  p2p_order_id   INT NOT NULL REFERENCES p2p_orders(p2p_order_id),
  raised_by      INT NOT NULL REFERENCES users(user_id),
  reason         VARCHAR(100) NOT NULL,
  description    TEXT,
  evidence       JSONB DEFAULT '[]',
  status         VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  resolution     VARCHAR(50),
  admin_notes    TEXT,
  resolver_id    INT REFERENCES users(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_disputes_order ON p2p_disputes(p2p_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status ON p2p_disputes(status) WHERE status != 'CLOSED';
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_raised_by ON p2p_disputes(raised_by);

SELECT 'p2p_disputes table OK' AS result;

-- Final verification count
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'p2p_offers','p2p_orders','p2p_messages','p2p_disputes',
    'user_wallets','wallet_deposits','product_accepted_tokens','platform_config'
  )
ORDER BY table_name;


/* --- Added from 05_fix_p2p_orders_v2.sql --- */
-- Fix: Create p2p_orders (and related tables) in proper order
-- SEQUENCE must be created BEFORE it is referenced in DEFAULT expression

-- Step 1: Create sequence first
CREATE SEQUENCE IF NOT EXISTS p2p_order_ref_seq START 1000;

-- Step 2: Create p2p_orders WITHOUT inline DEFAULT (add it after)
CREATE TABLE IF NOT EXISTS p2p_orders (
  p2p_order_id    SERIAL PRIMARY KEY,
  order_ref       VARCHAR(30) NOT NULL UNIQUE,
  offer_id        INT NOT NULL REFERENCES p2p_offers(offer_id),
  buyer_id        INT NOT NULL REFERENCES users(user_id),
  seller_id       INT NOT NULL REFERENCES users(user_id),
  token_id        INT NOT NULL REFERENCES token_whitelist(token_id),
  fiat_currency   VARCHAR(10) NOT NULL DEFAULT 'USD',
  fiat_amount     NUMERIC(20,2) NOT NULL,
  token_amount    NUMERIC(30,10) NOT NULL,
  price_per_unit  NUMERIC(20,6) NOT NULL,
  payment_method  VARCHAR(50) NOT NULL,
  status          VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PAID','CONFIRMED','RELEASED','CANCELLED','DISPUTED','RESOLVED_BUYER','RESOLVED_SELLER','TIMEOUT')),
  payment_proof   JSONB DEFAULT '[]',
  expires_at      TIMESTAMPTZ,
  payment_paid_at TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Add the DEFAULT expression for order_ref (sequence already exists now)
ALTER TABLE p2p_orders
  ALTER COLUMN order_ref
  SET DEFAULT ('P2P-' || LPAD(nextval('p2p_order_ref_seq')::text, 8, '0'));

-- Step 4: Indexes for p2p_orders
CREATE INDEX IF NOT EXISTS idx_p2p_orders_offer   ON p2p_orders(offer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer   ON p2p_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller  ON p2p_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_status  ON p2p_orders(status);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_expires ON p2p_orders(expires_at) WHERE status = 'PENDING';

-- Step 5: p2p_messages (depends on p2p_orders)
CREATE TABLE IF NOT EXISTS p2p_messages (
  message_id      SERIAL PRIMARY KEY,
  p2p_order_id    INT NOT NULL REFERENCES p2p_orders(p2p_order_id) ON DELETE CASCADE,
  sender_id       INT NOT NULL REFERENCES users(user_id),
  message         TEXT NOT NULL,
  attachments     JSONB DEFAULT '[]',
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_order ON p2p_messages(p2p_order_id);

-- Step 6: p2p_disputes (depends on p2p_orders)
CREATE TABLE IF NOT EXISTS p2p_disputes (
  dispute_id      SERIAL PRIMARY KEY,
  p2p_order_id    INT NOT NULL REFERENCES p2p_orders(p2p_order_id),
  raised_by       INT NOT NULL REFERENCES users(user_id),
  reason          VARCHAR(100) NOT NULL,
  description     TEXT,
  evidence        JSONB DEFAULT '[]',
  status          VARCHAR(30) NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','CLOSED')),
  resolution      VARCHAR(50),
  admin_notes     TEXT,
  resolver_id     INT REFERENCES users(user_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_order  ON p2p_disputes(p2p_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status ON p2p_disputes(status) WHERE status != 'CLOSED';
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_raiser ON p2p_disputes(raised_by);

-- Final check — should return 8 rows
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'p2p_offers','p2p_orders','p2p_messages','p2p_disputes',
    'user_wallets','wallet_deposits','product_accepted_tokens','platform_config'
  )
ORDER BY table_name;


-- ========================================
-- NFT & Credit Score Extension
-- ========================================
-- ========================================================
-- NFT & Credit Score Schema Migration
-- Web3Market RWA (Real World Asset) Extension
-- ========================================================

-- Table to track minted NFTs for products
CREATE TABLE IF NOT EXISTS product_nfts (
    nft_id          SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL UNIQUE REFERENCES products(product_id) ON DELETE CASCADE,
    token_uri       TEXT NOT NULL,             -- ipfs://Qm... metadata URI
    physical_hash   VARCHAR(66),               -- keccak256 of NFC tag UID / QR serial
    tx_hash         VARCHAR(66),               -- minting transaction hash
    token_id        BIGINT,                    -- on-chain token ID (filled after mint)
    contract_addr   VARCHAR(42),               -- ProductNFT contract address
    has_nfc         BOOLEAN DEFAULT FALSE,     -- whether product has NFC tag
    nfc_verified    BOOLEAN DEFAULT FALSE,     -- buyer scanned NFC
    delivered_at    TIMESTAMPTZ,               -- when NFT was transferred to buyer
    minted_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_nfts_product ON product_nfts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_nfts_tx ON product_nfts(tx_hash);

-- Table to cache credit score data (synced from chain)
CREATE TABLE IF NOT EXISTS user_credit_scores (
    credit_id       SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    score           INTEGER DEFAULT 0,
    tier            VARCHAR(10) DEFAULT 'BRONZE',  -- BRONZE | SILVER | GOLD | DIAMOND
    sbt_token_id    BIGINT,
    completed_orders INTEGER DEFAULT 0,
    dispute_count   INTEGER DEFAULT 0,
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_scores_user ON user_credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_wallet ON user_credit_scores(wallet_address);

-- Add NFT-related columns to orders for tracking NFT delivery state
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nft_pending_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nft_delivered         BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_updated        BOOLEAN DEFAULT FALSE;

-- View: enriched product list with NFT info
CREATE OR REPLACE VIEW products_with_nft AS
SELECT
    p.*,
    n.token_uri,
    n.physical_hash,
    n.tx_hash         AS nft_tx_hash,
    n.token_id        AS nft_token_id,
    n.contract_addr   AS nft_contract,
    n.has_nfc,
    n.nfc_verified,
    n.minted_at       AS nft_minted_at,
    CASE WHEN n.nft_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_nft
FROM products p
LEFT JOIN product_nfts n ON n.product_id = p.product_id;

-- View: user credit summary
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT
    u.user_id,
    u.username,
    u.email,
    u.wallet_address,
    COALESCE(cs.score, 0)             AS credit_score,
    COALESCE(cs.tier, 'BRONZE')       AS credit_tier,
    COALESCE(cs.completed_orders, 0)  AS completed_orders,
    COALESCE(cs.dispute_count, 0)     AS dispute_count,
    cs.sbt_token_id,
    cs.last_updated                   AS credit_last_updated
FROM users u
LEFT JOIN user_credit_scores cs ON cs.user_id = u.user_id;


-- ========================================
-- Idempotent column additions
-- ========================================
-- ============================================================
-- 04_missing_columns_hotfix.sql
-- Adds columns that were missing from the initial VPS deployment
-- because docker-compose.prod.yml only mounts 01_schema.sql
-- and 02_seed_data.sql, not 03_nft_credit_migration.sql.
--
-- SAFE TO RUN MULTIPLE TIMES — uses IF NOT EXISTS everywhere.
-- ============================================================

-- 1. products table — add token/NFT/stock columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS token_id            INT REFERENCES token_whitelist(token_id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_in_token      DECIMAL(36,18);
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5;

-- 2. NFT tracking table
CREATE TABLE IF NOT EXISTS product_nfts (
    nft_id          SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL UNIQUE REFERENCES products(product_id) ON DELETE CASCADE,
    token_uri       TEXT NOT NULL,
    physical_hash   VARCHAR(66),
    tx_hash         VARCHAR(66),
    token_id        BIGINT,
    contract_addr   VARCHAR(42),
    has_nfc         BOOLEAN DEFAULT FALSE,
    nfc_verified    BOOLEAN DEFAULT FALSE,
    delivered_at    TIMESTAMPTZ,
    minted_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_nfts_product ON product_nfts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_nfts_tx      ON product_nfts(tx_hash);

-- 3. Credit score table
CREATE TABLE IF NOT EXISTS user_credit_scores (
    credit_id        SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    wallet_address   VARCHAR(42) NOT NULL,
    score            INTEGER DEFAULT 0,
    tier             VARCHAR(10) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE','SILVER','GOLD','DIAMOND')),
    sbt_token_id     BIGINT,
    completed_orders INTEGER DEFAULT 0,
    dispute_count    INTEGER DEFAULT 0,
    last_updated     TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_scores_user   ON user_credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_wallet ON user_credit_scores(wallet_address);

-- 4. orders — NFT delivery tracking columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nft_pending_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS nft_delivered        BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_updated       BOOLEAN DEFAULT FALSE;

-- 5. Refresh views (safe to re-run)
CREATE OR REPLACE VIEW products_with_nft AS
SELECT
    p.*,
    n.token_uri,
    n.physical_hash,
    n.tx_hash        AS nft_tx_hash,
    n.token_id       AS nft_token_id,
    n.contract_addr  AS nft_contract,
    n.has_nfc,
    n.nfc_verified,
    n.minted_at      AS nft_minted_at,
    CASE WHEN n.nft_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_nft
FROM products p
LEFT JOIN product_nfts n ON n.product_id = p.product_id;

CREATE OR REPLACE VIEW user_credit_summary AS
SELECT
    u.user_id,
    u.username,
    u.email,
    u.wallet_address,
    COALESCE(cs.score, 0)             AS credit_score,
    COALESCE(cs.tier, 'BRONZE')       AS credit_tier,
    COALESCE(cs.completed_orders, 0)  AS completed_orders,
    COALESCE(cs.dispute_count, 0)     AS dispute_count,
    cs.sbt_token_id,
    cs.last_updated                   AS credit_last_updated
FROM users u
LEFT JOIN user_credit_scores cs ON cs.user_id = u.user_id;

-- Confirmation
SELECT 'Hotfix migration 04 applied successfully' AS status;

