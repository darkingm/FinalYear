-- ============================================================================
-- WEB3 MARKETPLACE DATABASE SCHEMA V2
-- Non-Custodial Multi-chain E-commerce Platform
-- ============================================================================

-- Drop existing tables (for clean init)
DROP TABLE IF EXISTS platform_fees CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS dead_letter_events CASCADE;
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory_locks CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS token_whitelist CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(42) UNIQUE,
    password_hash VARCHAR(255), -- For email/password auth
    username VARCHAR(50),
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    nonce VARCHAR(64), -- For wallet signature authentication
    google_id VARCHAR(255) UNIQUE, -- Google OAuth ID
    facebook_id VARCHAR(255) UNIQUE, -- Facebook OAuth ID
    paypal_email VARCHAR(255), -- PayPal account email
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE role IN ('seller', 'admin');

COMMENT ON TABLE users IS 'User accounts with wallet-based authentication';
COMMENT ON COLUMN users.nonce IS 'Random nonce for EIP-4361 (Sign-In with Ethereum)';

-- ============================================================================

-- 2. TOKEN WHITELIST (Multi-token support)
CREATE TABLE token_whitelist (
    token_id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    chain_id INT NOT NULL,
    decimals INT DEFAULT 18,
    oracle_price_feed VARCHAR(42), -- Chainlink oracle address
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB, -- Additional token info (logo, coingecko_id, etc)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(token_address, chain_id)
);

-- Indexes for token_whitelist
CREATE INDEX idx_tokens_active ON token_whitelist(is_active);
CREATE INDEX idx_tokens_chain ON token_whitelist(chain_id) WHERE is_active = true;

COMMENT ON TABLE token_whitelist IS 'Supported payment tokens across multiple chains';
COMMENT ON COLUMN token_whitelist.oracle_price_feed IS 'Chainlink price feed contract address';

-- ============================================================================

-- 3. PRODUCTS TABLE
CREATE TABLE products (
    product_id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price_usd DECIMAL(18,2) NOT NULL CHECK (base_price_usd > 0),
    metadata JSONB, -- Product attributes, images, IPFS links, NFT traits, etc
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_products_seller 
        FOREIGN KEY (seller_id) 
        REFERENCES users(user_id) 
        ON DELETE RESTRICT -- Prevent deletion of users with products
);

-- Indexes for products
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_price ON products(base_price_usd);
CREATE INDEX idx_products_metadata ON products USING GIN(metadata); -- For JSONB queries

COMMENT ON TABLE products IS 'Product catalog with flexible metadata structure';
COMMENT ON COLUMN products.metadata IS 'JSON structure: {images: [], category: "", attributes: {}, ipfs_hash: "", accepted_tokens: {crypto: [], fiat: []}}';

-- ============================================================================

-- 4. INVENTORY TABLE (Stock management)
CREATE TABLE inventory (
    product_id BIGINT PRIMARY KEY,
    total_stock INT NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
    available INT NOT NULL DEFAULT 0 CHECK (available >= 0),
    reserved INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    version INT NOT NULL DEFAULT 0, -- Optimistic locking
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_inventory_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE RESTRICT,
    CONSTRAINT chk_inventory_balance 
        CHECK (available + reserved <= total_stock)
);

-- Indexes for inventory
CREATE INDEX idx_inventory_available ON inventory(available) WHERE available > 0;

COMMENT ON TABLE inventory IS 'Real-time stock tracking with optimistic locking';
COMMENT ON COLUMN inventory.version IS 'Increment on every update to prevent race conditions';

-- ============================================================================

-- 5. INVENTORY LOCKS (Prevent phantom inventory)
CREATE TABLE inventory_locks (
    lock_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    order_id BIGINT, -- NULL until order is created
    quantity INT NOT NULL CHECK (quantity > 0),
    locked_by BIGINT, -- user_id who created the lock
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'consumed')),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_locks_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_locks_user 
        FOREIGN KEY (locked_by) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL
);

-- Indexes for inventory_locks
CREATE INDEX idx_locks_expires ON inventory_locks(expires_at) WHERE status = 'locked';
CREATE INDEX idx_locks_order ON inventory_locks(order_id);
CREATE INDEX idx_locks_product ON inventory_locks(product_id, status);
CREATE INDEX idx_locks_user ON inventory_locks(locked_by) WHERE status = 'locked';

COMMENT ON TABLE inventory_locks IS 'Temporary inventory reservations with TTL';
COMMENT ON COLUMN inventory_locks.expires_at IS 'Lock expires after 10 minutes if unpaid';

-- ============================================================================

-- 6. ORDERS TABLE (Main transaction record)
CREATE TABLE orders (
    order_id BIGSERIAL PRIMARY KEY,
    internal_order_id VARCHAR(64) UNIQUE NOT NULL, -- UUID for external reference
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    
    -- Pricing
    price_usd DECIMAL(18,2) NOT NULL CHECK (price_usd > 0),
    token_id INT,
    amount_token DECIMAL(36,18), -- Actual token amount to pay
    max_slippage DECIMAL(5,2) DEFAULT 2.00, -- Max price deviation % (2% default)
    price_expires_at TIMESTAMP,
    
    -- Blockchain
    chain_id INT,
    escrow_contract VARCHAR(42),
    tx_hash VARCHAR(66), -- Format: 0x + 64 hex chars
    block_number BIGINT,
    
    -- Payment method
    payment_method VARCHAR(20) CHECK (payment_method IN ('crypto', 'paypal', 'hybrid')),
    paypal_order_id VARCHAR(100), -- PayPal order ID
    paypal_capture_id VARCHAR(100), -- PayPal capture ID
    
    -- Saga state machine
    status VARCHAR(30) DEFAULT 'UNPAID' CHECK (status IN (
        'UNPAID', 'TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED',
        'PAYMENT_VALIDATED', 'PAID', 'DELIVERING', 'COMPLETED', 
        'CANCELLED', 'REFUNDED', 'DISPUTED'
    )),
    
    -- Metadata
    metadata JSONB, -- Shipping info, notes, etc
    
    -- Optimistic locking
    version INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign keys
    CONSTRAINT fk_orders_buyer 
        FOREIGN KEY (buyer_id) 
        REFERENCES users(user_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_seller 
        FOREIGN KEY (seller_id) 
        REFERENCES users(user_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_product 
        FOREIGN KEY (product_id) 
        REFERENCES products(product_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_orders_token 
        FOREIGN KEY (token_id) 
        REFERENCES token_whitelist(token_id) 
        ON DELETE RESTRICT
);

-- Indexes for orders
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_product ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_tx_hash ON orders(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_internal ON orders(internal_order_id);

COMMENT ON TABLE orders IS 'Core order records with saga state tracking';
COMMENT ON COLUMN orders.max_slippage IS 'Maximum acceptable price deviation percentage';
COMMENT ON COLUMN orders.tx_hash IS 'Blockchain transaction hash (0x + 64 hex)';

-- ============================================================================

-- 7. PAYMENTS TABLE (Blockchain transaction tracking)
CREATE TABLE payments (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT UNIQUE NOT NULL,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    chain_id INT NOT NULL,
    
    -- Blockchain data
    from_address VARCHAR(42) NOT NULL, -- Buyer's wallet
    to_address VARCHAR(42) NOT NULL, -- Escrow contract
    block_number BIGINT,
    block_timestamp TIMESTAMP,
    gas_used BIGINT,
    gas_price DECIMAL(36,18), -- In wei
    
    -- Verification status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
    verified_by_rpc BOOLEAN DEFAULT false,
    verified_by_indexer BOOLEAN DEFAULT false,
    confirmations INT DEFAULT 0,
    
    -- Indexer metadata
    indexer_name VARCHAR(50), -- 'thegraph', 'moralis', 'alchemy'
    last_checked_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_payments_order 
        FOREIGN KEY (order_id) 
        REFERENCES orders(order_id) 
        ON DELETE RESTRICT
);

-- Indexes for payments
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_block ON payments(chain_id, block_number);
CREATE INDEX idx_payments_verification ON payments(verified_by_rpc, verified_by_indexer);

COMMENT ON TABLE payments IS 'Blockchain transaction verification records';
COMMENT ON COLUMN payments.verified_by_rpc IS 'Confirmed by direct RPC polling';
COMMENT ON COLUMN payments.verified_by_indexer IS 'Confirmed by indexer (The Graph/Moralis)';

-- ============================================================================

-- 8. DISPUTES TABLE
CREATE TABLE disputes (
    dispute_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    raised_by BIGINT NOT NULL, -- user_id
    reason TEXT NOT NULL,
    evidence_urls TEXT[], -- Array of evidence links
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
    resolver_id BIGINT, -- admin user_id
    resolution TEXT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_disputes_order 
        FOREIGN KEY (order_id) 
        REFERENCES orders(order_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_disputes_raiser 
        FOREIGN KEY (raised_by) 
        REFERENCES users(user_id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_disputes_resolver 
        FOREIGN KEY (resolver_id) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL
);

-- Indexes for disputes
CREATE INDEX idx_disputes_order ON disputes(order_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_raiser ON disputes(raised_by);
CREATE INDEX idx_disputes_created ON disputes(created_at DESC);

COMMENT ON TABLE disputes IS 'Order dispute management and resolution';

-- ============================================================================

-- 9. PLATFORM FEES TABLE
CREATE TABLE platform_fees (
    fee_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    fee_amount_usd DECIMAL(18,2) NOT NULL,
    fee_amount_token DECIMAL(36,18),
    fee_percentage DECIMAL(5,2) NOT NULL, -- e.g., 2.50 for 2.5%
    collector_wallet VARCHAR(42) NOT NULL, -- Platform's fee wallet
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'failed')),
    collected_tx_hash VARCHAR(66),
    collected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_fees_order 
        FOREIGN KEY (order_id) 
        REFERENCES orders(order_id) 
        ON DELETE RESTRICT
);

-- Indexes for platform_fees
CREATE INDEX idx_fees_order ON platform_fees(order_id);
CREATE INDEX idx_fees_status ON platform_fees(status);
CREATE INDEX idx_fees_collected ON platform_fees(collected_at) WHERE collected_at IS NOT NULL;

COMMENT ON TABLE platform_fees IS 'Platform revenue tracking from transactions';

-- ============================================================================
-- OPERATIONAL TABLES
-- ============================================================================

-- 10. DEAD LETTER EVENTS (Failed RabbitMQ messages)
CREATE TABLE dead_letter_events (
    event_id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'order.created', 'tx.confirmed', etc
    payload JSONB NOT NULL,
    error_log TEXT,
    stack_trace TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    status VARCHAR(20) DEFAULT 'failed' CHECK (status IN ('failed', 'retrying', 'resolved', 'abandoned')),
    created_at TIMESTAMP DEFAULT NOW(),
    retry_at TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Indexes for dead_letter_events
CREATE INDEX idx_dle_status ON dead_letter_events(status);
CREATE INDEX idx_dle_retry ON dead_letter_events(retry_at) WHERE status = 'retrying';
CREATE INDEX idx_dle_type ON dead_letter_events(event_type);
CREATE INDEX idx_dle_created ON dead_letter_events(created_at DESC);

COMMENT ON TABLE dead_letter_events IS 'Failed event queue for manual retry and debugging';

-- ============================================================================

-- 11. AUDIT LOGS (Compliance and debugging)
CREATE TABLE audit_logs (
    log_id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'order', 'payment', 'inventory', 'user'
    entity_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'updated', 'cancelled'
    old_value JSONB,
    new_value JSONB,
    changed_by BIGINT, -- user_id or NULL for system actions
    ip_address INET,
    user_agent TEXT,
    metadata JSONB, -- Additional context: tx_hash, reason, etc
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT fk_audit_user 
        FOREIGN KEY (changed_by) 
        REFERENCES users(user_id) 
        ON DELETE SET NULL
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX idx_audit_action ON audit_logs(action);

COMMENT ON TABLE audit_logs IS 'Immutable log of all state changes for compliance';

-- Partition audit_logs by month for performance
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_disputes_updated_at
    BEFORE UPDATE ON disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_token_whitelist_updated_at
    BEFORE UPDATE ON token_whitelist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================

-- Function: Create audit log on order status change
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO audit_logs (
            entity_type, 
            entity_id, 
            action, 
            old_value, 
            new_value,
            metadata
        ) VALUES (
            'order',
            NEW.order_id,
            'status_changed',
            jsonb_build_object('status', OLD.status, 'version', OLD.version),
            jsonb_build_object('status', NEW.status, 'version', NEW.version),
            jsonb_build_object('tx_hash', NEW.tx_hash)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_order_status
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION log_order_status_change();

-- ============================================================================

-- Function: Prevent negative inventory
CREATE OR REPLACE FUNCTION check_inventory_before_lock()
RETURNS TRIGGER AS $$
DECLARE
    current_available INT;
BEGIN
    SELECT available INTO current_available
    FROM inventory
    WHERE product_id = NEW.product_id
    FOR UPDATE; -- Lock the row
    
    IF current_available < NEW.quantity THEN
        RAISE EXCEPTION 'Insufficient inventory for product_id %', NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_inventory_lock
    BEFORE INSERT ON inventory_locks
    FOR EACH ROW
    EXECUTE FUNCTION check_inventory_before_lock();

-- ============================================================================
-- INITIAL DATA (Sample data for testing)
-- ============================================================================

-- Insert sample payment tokens
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, oracle_price_feed, is_active) VALUES
('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 1, 6, '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', true),
('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1, 6, '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', true),
('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f', 1, 18, '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', true),
('USDT', '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 137, 6, '0x0A6513e40db6EB1b165753AD52E80663aeA50545', true), -- Polygon
('USDC', '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 137, 6, '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7', true); -- Polygon

-- Set lock timeout (global setting)
ALTER DATABASE postgres SET lock_timeout = '5s';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite index for common order queries
CREATE INDEX idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX idx_orders_seller_status ON orders(seller_id, status);

-- Index for inventory cleanup worker
CREATE INDEX idx_locks_cleanup ON inventory_locks(expires_at, status, product_id) 
    WHERE status = 'locked';

-- ============================================================================
-- VIEWS (Optional - for reporting)
-- ============================================================================

-- View: Active orders with payment status
CREATE VIEW v_active_orders AS
SELECT 
    o.order_id,
    o.internal_order_id,
    o.status as order_status,
    o.price_usd,
    o.amount_token,
    o.created_at,
    p.tx_hash,
    p.status as payment_status,
    p.verified_by_rpc,
    p.verified_by_indexer,
    u_buyer.email as buyer_email,
    u_buyer.wallet_address as buyer_wallet,
    u_seller.email as seller_email,
    prod.name as product_name
FROM orders o
LEFT JOIN payments p ON o.order_id = p.order_id
JOIN users u_buyer ON o.buyer_id = u_buyer.user_id
JOIN users u_seller ON o.seller_id = u_seller.user_id
JOIN products prod ON o.product_id = prod.product_id
WHERE o.status NOT IN ('COMPLETED', 'CANCELLED', 'REFUNDED');

-- View: Inventory status
CREATE VIEW v_inventory_status AS
SELECT 
    p.product_id,
    p.name as product_name,
    p.base_price_usd,
    i.total_stock,
    i.available,
    i.reserved,
    COUNT(il.lock_id) as active_locks
FROM products p
JOIN inventory i ON p.product_id = i.product_id
LEFT JOIN inventory_locks il ON p.product_id = il.product_id 
    AND il.status = 'locked'
GROUP BY p.product_id, p.name, p.base_price_usd, i.total_stock, i.available, i.reserved;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Release expired inventory locks (called by worker)
CREATE OR REPLACE FUNCTION release_expired_locks()
RETURNS TABLE(released_count INT) AS $$
DECLARE
    expired_count INT;
BEGIN
    -- Update locks to released status
    UPDATE inventory_locks
    SET status = 'released'
    WHERE expires_at < NOW() 
      AND status = 'locked'
    RETURNING COUNT(*) INTO expired_count;
    
    -- Update inventory availability
    UPDATE inventory i
    SET reserved = i.reserved - sub.total_qty,
        available = i.available + sub.total_qty,
        version = i.version + 1
    FROM (
        SELECT product_id, SUM(quantity) as total_qty
        FROM inventory_locks
        WHERE status = 'released' 
          AND expires_at < NOW()
        GROUP BY product_id
    ) sub
    WHERE i.product_id = sub.product_id;
    
    RETURN QUERY SELECT expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON DATABASE postgres IS 'Web3 Multi-chain Non-Custodial Marketplace';

-- Grant permissions (adjust based on your setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check all indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check all foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
