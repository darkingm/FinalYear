-- =====================================================
-- SECTION 11: ADMIN EXTENSIONS
-- =====================================================

-- 1. Platform Settings (Fees, Banners, Announcements, etc.)
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL
);

-- 2. Categories Management
CREATE TABLE IF NOT EXISTS categories (
    category_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Seller Payouts
CREATE TABLE IF NOT EXISTS seller_payouts (
    payout_id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT NOT NULL REFERENCES seller_profiles(seller_id) ON DELETE CASCADE,
    amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(20) NOT NULL DEFAULT 'USD',
    payout_wallet VARCHAR(100), -- Address or paypal
    tx_hash VARCHAR(128),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    notes TEXT,
    processed_by BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_seller_payouts_updated_at BEFORE UPDATE ON seller_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Dispute Messages (Evidence / Chat)
CREATE TABLE IF NOT EXISTS dispute_messages (
    message_id BIGSERIAL PRIMARY KEY,
    dispute_id BIGINT NOT NULL REFERENCES disputes(dispute_id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    attachments JSONB, -- Array of URLs for evidence
    is_admin_note BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Platform Settings
INSERT INTO platform_settings (key, value, description) VALUES
('platform_fee', '{"crypto_percentage": 2.5, "paypal_percentage": 3.0, "fixed_fee_usd": 0.5}', 'Platform commission fees applied to orders'),
('banners', '[]', 'List of promotional banners displayed on the homepage'),
('announcements', '[]', 'System-wide announcements (e.g., maintenance)');
