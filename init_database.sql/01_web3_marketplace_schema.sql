-- =====================================================
-- WEB3 MARKETPLACE DATABASE SCHEMA
-- Non-Custodial Multi-Chain E-Commerce Platform
-- Version: 2.0
-- Author: Database Design for Final Project
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SECTION 1: CORE USER MANAGEMENT
-- =====================================================

-- Users table - Core authentication and user accounts
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) UNIQUE,            -- nullable: OAuth users may not have a wallet yet
    username VARCHAR(64) UNIQUE,
    password_hash VARCHAR(255),                    -- bcrypt hash for email/password login
    google_id VARCHAR(255) UNIQUE,                 -- Google OAuth provider ID
    facebook_id VARCHAR(255) UNIQUE,               -- Facebook OAuth provider ID
    avatar_url VARCHAR(500),                       -- profile picture from OAuth or upload
    paypal_email VARCHAR(255),                     -- PayPal email for paypal payments
    role VARCHAR(20) NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seller profiles with KYC verification
CREATE TABLE seller_profiles (
    seller_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url VARCHAR(255),
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected', 'expired')),
    kyc_verified_at TIMESTAMP,
    payout_wallet VARCHAR(42) NOT NULL,
    rating_avg DECIMAL(3,2) DEFAULT 0.00 CHECK (rating_avg >= 0 AND rating_avg <= 5),
    total_sales INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Shipping addresses for physical goods delivery
CREATE TABLE addresses (
    address_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    country VARCHAR(2) NOT NULL,
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    address_line TEXT NOT NULL,
    postal_code VARCHAR(20),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 2: PRODUCT CATALOG
-- =====================================================

-- Products master table
CREATE TABLE products (
    product_id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    base_price_usd DECIMAL(18,2) NOT NULL CHECK (base_price_usd >= 0),
    metadata JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'deleted')),
    rating_avg DECIMAL(3,2) DEFAULT 0.00 CHECK (rating_avg >= 0 AND rating_avg <= 5),
    review_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id) ON DELETE CASCADE
);

-- Product image gallery
CREATE TABLE product_images (
    image_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    alt_text VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Product variants (size, color, SKU)
CREATE TABLE product_variants (
    variant_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    attributes JSONB, -- e.g., {"size": "L", "color": "red"}
    price_override DECIMAL(18,2) CHECK (price_override >= 0),
    inventory_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'out_of_stock')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 3: INVENTORY & WAREHOUSE MANAGEMENT
-- =====================================================

-- Warehouse locations
CREATE TABLE warehouses (
    warehouse_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    country VARCHAR(2) NOT NULL,
    province VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Inventory tracking with optimistic locking
CREATE TABLE inventory (
    inventory_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    total_stock INT NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    available INT NOT NULL DEFAULT 0 CHECK (available >= 0),
    reserved INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    version INT NOT NULL DEFAULT 0, -- For optimistic locking
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE RESTRICT,
    CONSTRAINT inventory_consistency CHECK (total_stock = available + reserved),
    UNIQUE(product_id, warehouse_id)
);

-- Add FK from product_variants to inventory
ALTER TABLE product_variants 
ADD CONSTRAINT fk_variant_inventory 
FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id) ON DELETE SET NULL;

-- Inventory locks for order reservations
CREATE TABLE inventory_locks (
    lock_id BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT NOT NULL,
    order_id BIGINT, -- Will be set when order is created
    quantity INT NOT NULL CHECK (quantity > 0),
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'expired', 'committed')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 4: SHOPPING CART
-- =====================================================

-- Shopping carts
CREATE TABLE carts (
    cart_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Cart items with price snapshot
CREATE TABLE cart_items (
    cart_item_id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    variant_id BIGINT,
    quantity INT NOT NULL CHECK (quantity > 0),
    price_snapshot DECIMAL(18,2) NOT NULL CHECK (price_snapshot >= 0),
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 5: ORDERS & PAYMENTS
-- =====================================================

-- Orders table
CREATE TABLE orders (
    order_id BIGSERIAL PRIMARY KEY,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    shipping_address_id BIGINT,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    product_id BIGINT,                              -- main product (for single-product orders)
    internal_order_id VARCHAR(255),                  -- UUID used by escrow contract
    quantity INT NOT NULL CHECK (quantity > 0),
    price_usd DECIMAL(18,2) NOT NULL CHECK (price_usd >= 0),
    subtotal DECIMAL(18,2) NOT NULL CHECK (subtotal >= 0),
    shipping_fee DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    total_amount DECIMAL(18,2) NOT NULL CHECK (total_amount >= 0),
    token_id INT,                                    -- selected crypto token
    amount_token DECIMAL(36,18),                     -- price in token units
    chain_id INT,                                    -- blockchain chain ID
    escrow_contract VARCHAR(42),                     -- escrow contract address
    tx_hash VARCHAR(128),                            -- submitted transaction hash
    payment_method VARCHAR(20),                      -- 'crypto' | 'paypal'
    price_expires_at TIMESTAMP,                      -- quote expiry
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered',
                          'completed', 'cancelled', 'refunded',
                          'UNPAID', 'TX_SUBMITTED', 'TX_FAILED',
                          'ONCHAIN_CONFIRMED', 'PAID', 'DELIVERING',
                          'COMPLETED', 'DISPUTED')),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (seller_id) REFERENCES seller_profiles(seller_id) ON DELETE RESTRICT,
    FOREIGN KEY (shipping_address_id) REFERENCES addresses(address_id) ON DELETE SET NULL
);

-- Add FK from inventory_locks to orders
ALTER TABLE inventory_locks 
ADD CONSTRAINT fk_lock_order 
FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE;

-- Order line items
CREATE TABLE order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    variant_id BIGINT,
    quantity INT NOT NULL CHECK (quantity > 0),
    price_snapshot DECIMAL(18,2) NOT NULL CHECK (price_snapshot >= 0),
    subtotal DECIMAL(18,2) NOT NULL CHECK (subtotal >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT
);

-- Token whitelist for crypto payments
CREATE TABLE token_whitelist (
    token_id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    chain_id INT NOT NULL,
    decimals INT NOT NULL CHECK (decimals >= 0 AND decimals <= 18),
    oracle_price_feed VARCHAR(42),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_address, chain_id)
);

-- Multi-token payment tracking
CREATE TABLE order_payments (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    token_id INT NOT NULL,
    amount DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash VARCHAR(66),
    chain_id INT,
    block_number BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirming', 'confirmed', 'failed')),
    verified_by_rpc BOOLEAN DEFAULT FALSE,
    verified_by_indexer BOOLEAN DEFAULT FALSE,
    confirmations INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE RESTRICT
);

-- Order status audit trail
CREATE TABLE order_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    old_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    notes TEXT,
    changed_by BIGINT,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Payment records used by payment-service (crypto & PayPal)
CREATE TABLE payments (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    tx_hash VARCHAR(128),                            -- crypto 0x… hash or paypal-… id
    chain_id INT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirming', 'confirmed', 'failed')),
    from_address VARCHAR(128),
    to_address VARCHAR(128),
    block_number BIGINT,
    block_timestamp TIMESTAMP,
    gas_used VARCHAR(78),
    gas_price BIGINT,
    verified_by_rpc BOOLEAN DEFAULT FALSE,
    verified_by_indexer BOOLEAN DEFAULT FALSE,
    confirmations INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SECTION 6: SHIPPING & LOGISTICS
-- =====================================================

-- Shipment tracking
CREATE TABLE shipments (
    shipment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    carrier VARCHAR(50) NOT NULL, -- e.g., DHL, FedEx, UPS, GHN, NinjaVan
    tracking_code VARCHAR(100),
    shipping_fee DECIMAL(18,2) NOT NULL CHECK (shipping_fee >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')),
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    tracking_events JSONB, -- Array of tracking updates
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- =====================================================
-- SECTION 7: REFUNDS & DISPUTES
-- =====================================================

-- Refund transactions
CREATE TABLE refunds (
    refund_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    payment_id BIGINT NOT NULL,
    amount DECIMAL(36,18) NOT NULL CHECK (amount > 0),
    tx_hash VARCHAR(66),
    escrow_release_tx VARCHAR(66),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
    approved_by BIGINT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES order_payments(payment_id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Dispute resolution
CREATE TABLE disputes (
    dispute_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    raised_by BIGINT NOT NULL,
    resolver_id BIGINT,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' 
        CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolution TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (raised_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (resolver_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- =====================================================
-- SECTION 8: REVIEWS & RATINGS
-- =====================================================

-- Product and seller reviews
CREATE TABLE reviews (
    review_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    buyer_id BIGINT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images JSONB, -- Array of image URLs
    status VARCHAR(20) NOT NULL DEFAULT 'published' 
        CHECK (status IN ('draft', 'published', 'flagged', 'removed')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE(order_id, product_id, buyer_id) -- One review per product per order
);

-- =====================================================
-- SECTION 9: BLOCKCHAIN & CRYPTO
-- =====================================================

-- Exchange rate cache
CREATE TABLE exchange_rates (
    rate_id BIGSERIAL PRIMARY KEY,
    token_id INT NOT NULL,
    usd_rate DECIMAL(18,8) NOT NULL CHECK (usd_rate > 0),
    source VARCHAR(50), -- e.g., 'Chainlink', 'Uniswap', 'CoinGecko'
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES token_whitelist(token_id) ON DELETE CASCADE
);

-- Audit logs for blockchain events
CREATE TABLE audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- e.g., 'order', 'payment', 'refund'
    entity_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL, -- e.g., 'created', 'updated', 'deleted'
    old_value JSONB,
    new_value JSONB,
    changed_by BIGINT,
    metadata JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Platform fee tracking
CREATE TABLE platform_fees (
    fee_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    fee_amount_usd DECIMAL(18,2) NOT NULL CHECK (fee_amount_usd >= 0),
    fee_percentage DECIMAL(5,2) NOT NULL CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
    collector_wallet VARCHAR(42) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'collected', 'failed')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

-- Dead letter queue for failed events
CREATE TABLE dead_letter_events (
    event_id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    error_log TEXT NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'retrying', 'failed', 'resolved')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SECTION 10: ENGAGEMENT & MARKETING
-- =====================================================

-- User notifications
CREATE TABLE notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'order', 'shipment', 'dispute', 'payment'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Discount coupons
CREATE TABLE coupons (
    coupon_id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(18,2) NOT NULL CHECK (discount_value > 0),
    min_purchase DECIMAL(18,2) CHECK (min_purchase >= 0),
    max_uses INT,
    used_count INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'expired')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

-- Seller Profiles
CREATE INDEX idx_seller_user_id ON seller_profiles(user_id);
CREATE INDEX idx_seller_kyc_status ON seller_profiles(kyc_status);
CREATE INDEX idx_seller_rating ON seller_profiles(rating_avg DESC);

-- Addresses
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_default ON addresses(user_id, is_default) WHERE is_default = TRUE;

-- Products
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_rating ON products(rating_avg DESC);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_products_price ON products(base_price_usd);

-- Product Images
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_primary ON product_images(product_id, is_primary) WHERE is_primary = TRUE;

-- Product Variants
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_inventory ON product_variants(inventory_id);

-- Warehouses
CREATE INDEX idx_warehouses_status ON warehouses(status);
CREATE INDEX idx_warehouses_country ON warehouses(country);

-- Inventory
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_available ON inventory(product_id) WHERE available > 0;
CREATE UNIQUE INDEX idx_inventory_unique ON inventory(product_id, warehouse_id);

-- Inventory Locks
CREATE INDEX idx_locks_inventory ON inventory_locks(inventory_id);
CREATE INDEX idx_locks_order ON inventory_locks(order_id);
CREATE INDEX idx_locks_status ON inventory_locks(status);
CREATE INDEX idx_locks_expires ON inventory_locks(expires_at) WHERE status = 'active';

-- Carts
CREATE INDEX idx_carts_user ON carts(user_id);
CREATE INDEX idx_carts_status ON carts(status);

-- Cart Items
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

-- Orders
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_address ON orders(shipping_address_id);

-- Order Items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Order Payments
CREATE INDEX idx_payments_order ON order_payments(order_id);
CREATE INDEX idx_payments_token ON order_payments(token_id);
CREATE INDEX idx_payments_tx_hash ON order_payments(tx_hash);
CREATE INDEX idx_payments_status ON order_payments(status);
CREATE INDEX idx_payments_chain ON order_payments(chain_id);

-- Order Status History
CREATE INDEX idx_order_history_order ON order_status_history(order_id);
CREATE INDEX idx_order_history_changed ON order_status_history(changed_at DESC);

-- Shipments
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_code);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_carrier ON shipments(carrier);

-- Refunds
CREATE INDEX idx_refunds_order ON refunds(order_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_tx_hash ON refunds(tx_hash);

-- Disputes
CREATE INDEX idx_disputes_order ON disputes(order_id);
CREATE INDEX idx_disputes_raised_by ON disputes(raised_by);
CREATE INDEX idx_disputes_status ON disputes(status);

-- Reviews
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_buyer ON reviews(buyer_id);
CREATE INDEX idx_reviews_order ON reviews(order_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- Token Whitelist
CREATE INDEX idx_tokens_symbol ON token_whitelist(symbol);
CREATE INDEX idx_tokens_chain ON token_whitelist(chain_id);
CREATE INDEX idx_tokens_active ON token_whitelist(is_active) WHERE is_active = TRUE;

-- Exchange Rates
CREATE INDEX idx_exchange_rates_token ON exchange_rates(token_id);
CREATE INDEX idx_exchange_rates_timestamp ON exchange_rates(timestamp DESC);

-- Audit Logs
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_changed_by ON audit_logs(changed_by);

-- Platform Fees
CREATE INDEX idx_platform_fees_order ON platform_fees(order_id);
CREATE INDEX idx_platform_fees_status ON platform_fees(status);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Coupons
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_valid ON coupons(valid_from, valid_until) WHERE status = 'active';

-- Dead Letter Events
CREATE INDEX idx_dlq_status ON dead_letter_events(status);
CREATE INDEX idx_dlq_event_type ON dead_letter_events(event_type);

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- =====================================================

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seller_profiles_updated_at BEFORE UPDATE ON seller_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_payments_updated_at BEFORE UPDATE ON order_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dlq_updated_at BEFORE UPDATE ON dead_letter_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER FOR RATING AGGREGATION
-- =====================================================

-- Update product rating average when review is created/updated
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products SET
        rating_avg = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM reviews
            WHERE product_id = NEW.product_id AND status = 'published'
        ),
        review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE product_id = NEW.product_id AND status = 'published'
        )
    WHERE product_id = NEW.product_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_product_rating_trigger
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- Update seller rating average
CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE seller_profiles SET
        rating_avg = (
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM reviews r
            JOIN products p ON r.product_id = p.product_id
            WHERE p.seller_id = (
                SELECT seller_id FROM products WHERE product_id = NEW.product_id
            ) AND r.status = 'published'
        )
    WHERE seller_id = (
        SELECT seller_id FROM products WHERE product_id = NEW.product_id
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_seller_rating_trigger
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

-- =====================================================
-- TRIGGER FOR ORDER STATUS HISTORY
-- =====================================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, old_status, new_status)
        VALUES (NEW.order_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_order_status_trigger
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- =====================================================
-- TRIGGER FOR INVENTORY RESERVATION
-- =====================================================

CREATE OR REPLACE FUNCTION reserve_inventory()
RETURNS TRIGGER AS $$
BEGIN
    -- Update inventory when lock is created
    IF NEW.status = 'active' THEN
        UPDATE inventory SET
            available = available - NEW.quantity,
            reserved = reserved + NEW.quantity
        WHERE inventory_id = NEW.inventory_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER reserve_inventory_trigger
AFTER INSERT ON inventory_locks
FOR EACH ROW EXECUTE FUNCTION reserve_inventory();

-- Release inventory when lock expires or is released
CREATE OR REPLACE FUNCTION release_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('released', 'expired') AND OLD.status = 'active' THEN
        UPDATE inventory SET
            available = available + OLD.quantity,
            reserved = reserved - OLD.quantity
        WHERE inventory_id = OLD.inventory_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER release_inventory_trigger
AFTER UPDATE ON inventory_locks
FOR EACH ROW EXECUTE FUNCTION release_inventory();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Active products with seller info
CREATE VIEW v_active_products AS
SELECT 
    p.*,
    sp.display_name as seller_name,
    sp.rating_avg as seller_rating,
    (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = TRUE LIMIT 1) as primary_image
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.seller_id
WHERE p.status = 'active';

-- Order summary with payment info
CREATE VIEW v_order_summary AS
SELECT 
    o.*,
    u.email as buyer_email,
    sp.display_name as seller_name,
    COUNT(DISTINCT op.payment_id) as payment_count,
    SUM(op.amount) as total_paid,
    STRING_AGG(DISTINCT tw.symbol, ', ') as payment_tokens
FROM orders o
JOIN users u ON o.buyer_id = u.user_id
JOIN seller_profiles sp ON o.seller_id = sp.seller_id
LEFT JOIN order_payments op ON o.order_id = op.order_id
LEFT JOIN token_whitelist tw ON op.token_id = tw.token_id
GROUP BY o.order_id, u.email, sp.display_name;

-- Inventory availability
CREATE VIEW v_inventory_available AS
SELECT 
    p.product_id,
    p.name as product_name,
    w.warehouse_id,
    w.name as warehouse_name,
    i.total_stock,
    i.available,
    i.reserved
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN warehouses w ON i.warehouse_id = w.warehouse_id
WHERE i.available > 0;

-- =====================================================
-- SAMPLE DATA INSERTION (OPTIONAL - FOR TESTING)
-- =====================================================

-- Insert admin user (wallet_address is now optional)
INSERT INTO users (email, username, role, status) VALUES
('admin@marketplace.com', 'admin', 'admin', 'active');

-- Insert sample tokens
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active) VALUES
('ETH', '0x0000000000000000000000000000000000000000', 1, 18, TRUE),
('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 1, 6, TRUE),
('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1, 6, TRUE),
('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f', 1, 18, TRUE);

-- Insert sample warehouse
INSERT INTO warehouses (name, code, country, province, address, status) VALUES
('Main Warehouse', 'WH001', 'US', 'California', '123 Warehouse St, San Francisco, CA', 'active');

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE users IS 'Core user accounts – email/password, OAuth (Google/Facebook), and wallet-based auth';
COMMENT ON TABLE seller_profiles IS 'Enhanced seller information with KYC verification status';
COMMENT ON TABLE addresses IS 'Shipping addresses for physical goods delivery';
COMMENT ON TABLE products IS 'Product catalog with pricing and metadata';
COMMENT ON TABLE product_images IS 'Product image gallery with sort ordering';
COMMENT ON TABLE product_variants IS 'SKU-based product variations (size, color, etc.)';
COMMENT ON TABLE warehouses IS 'Physical storage locations for inventory';
COMMENT ON TABLE inventory IS 'Stock tracking with optimistic locking for concurrency';
COMMENT ON TABLE inventory_locks IS 'Temporary inventory reservations during checkout';
COMMENT ON TABLE carts IS 'Shopping carts for users';
COMMENT ON TABLE cart_items IS 'Items in shopping cart with price snapshots';
COMMENT ON TABLE orders IS 'Customer orders with crypto/paypal payment support and status tracking';
COMMENT ON TABLE order_items IS 'Line items within orders';
COMMENT ON TABLE order_payments IS 'Multi-token payment tracking with blockchain verification';
COMMENT ON TABLE payments IS 'Simplified payment records used by payment-service workers';
COMMENT ON TABLE order_status_history IS 'Audit trail for order status changes';
COMMENT ON TABLE shipments IS 'Shipping and delivery tracking';
COMMENT ON TABLE refunds IS 'Refund transactions with escrow releases';
COMMENT ON TABLE disputes IS 'Order dispute resolution';
COMMENT ON TABLE reviews IS 'Product and seller reviews with ratings';
COMMENT ON TABLE token_whitelist IS 'Accepted cryptocurrency payment tokens';
COMMENT ON TABLE exchange_rates IS 'Cached exchange rates for price conversions';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail for all changes';
COMMENT ON TABLE platform_fees IS 'Platform fee tracking per order';
COMMENT ON TABLE notifications IS 'User notification system';
COMMENT ON TABLE coupons IS 'Discount codes and promotions';
COMMENT ON TABLE dead_letter_events IS 'Failed event processing queue with retry mechanism';

-- =====================================================
-- END OF SCHEMA
-- =====================================================