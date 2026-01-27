-- ========================================
-- MIGRATION SCRIPT: Update Existing Databases
-- Adds new tables and columns to existing auth_db
-- Port: 5432 (existing auth service database)
-- ========================================

-- Connect to auth_db
\c auth_db;

-- ========================================
-- PART 1: Update users table
-- ========================================

-- Add new columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='auth_type') THEN
        ALTER TABLE users ADD COLUMN auth_type VARCHAR(20) DEFAULT 'local' 
            CHECK (auth_type IN ('local', 'social', 'hybrid'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='status') THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
            CHECK (status IN ('active', 'inactive', 'banned'));
    END IF;
END $$;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_users_auth_type ON users(auth_type);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- ========================================
-- PART 2: Create social_accounts table
-- ========================================

CREATE TABLE IF NOT EXISTS social_accounts (
    social_account_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('google', 'facebook', 'microsoft')),
    provider_user_id VARCHAR(255) NOT NULL,
    
    -- Email from provider for account merging
    email VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    profile_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_email ON social_accounts(email) WHERE email IS NOT NULL;

-- ========================================
-- PART 3: Create user_addresses table
-- ========================================

CREATE TABLE IF NOT EXISTS user_addresses (
    address_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    address_type VARCHAR(20) CHECK (address_type IN ('shipping', 'billing')),
    recipient_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(500) NOT NULL,
    address_line2 VARCHAR(500),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses(user_id, is_default) WHERE is_default = TRUE;

-- ========================================
-- PART 4: Create wallets table (SYMBOLIC BALANCES)
-- ========================================

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References users(id) but using UUID
    coin_symbol VARCHAR(10) NOT NULL,
    available_balance DECIMAL(20, 8) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    locked_balance DECIMAL(20, 8) NOT NULL DEFAULT 0 CHECK (locked_balance >= 0),
    wallet_address VARCHAR(255),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, coin_symbol)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_coin_symbol ON wallets(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_wallets_user_coin ON wallets(user_id, coin_symbol);

-- ========================================
-- PART 5: Create wallet_transactions table
-- ========================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 
        'ORDER_PURCHASE', 'ORDER_RECEIVED', 'ORDER_REFUND',
        'ADMIN_ADJUSTMENT'
    )),
    coin_symbol VARCHAR(10) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    balance_after DECIMAL(20, 8) NOT NULL,
    related_order_id UUID,
    related_user_id UUID,
    related_transaction_id VARCHAR(255),
    tx_hash VARCHAR(255),
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_coin_symbol ON wallet_transactions(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON wallet_transactions(status);

-- ========================================
-- PART 6: Create admin master wallet
-- ========================================

-- Insert admin master wallet (holds REAL coins)
-- UUID: 00000000-0000-0000-0000-000000000001
INSERT INTO wallets (id, user_id, coin_symbol, available_balance, locked_balance, version)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'BTC', 0, 0, 1),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'ETH', 0, 0, 1),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'USDT', 0, 0, 1),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'USDC', 0, 0, 1),
    ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'BNB', 0, 0, 1),
    ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'BUSD', 0, 0, 1)
ON CONFLICT (user_id, coin_symbol) DO NOTHING;

-- ========================================
-- PART 7: Create trigger for auto-update timestamps
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_accounts_updated_at ON social_accounts;
CREATE TRIGGER update_social_accounts_updated_at 
    BEFORE UPDATE ON social_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_addresses_updated_at ON user_addresses;
CREATE TRIGGER update_user_addresses_updated_at 
    BEFORE UPDATE ON user_addresses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON wallets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\echo '✅ Migration Complete!'
\echo '📊 Changes Applied:'
\echo '  - Updated users table with new columns'
\echo '  - Created social_accounts table'
\echo '  - Created user_addresses table'
\echo '  - Created wallets table (symbolic balances)'
\echo '  - Created wallet_transactions table'
\echo '  - Created admin master wallet'
\echo '  - Added auto-update triggers'
\echo ''
\echo '⚠️  IMPORTANT:'
\echo '  - Admin wallet ID: 00000000-0000-0000-0000-000000000001'
\echo '  - Admin wallet holds REAL coins'
\echo '  - User wallets hold SYMBOLIC balances'
\echo '  - Sync admin wallet balance from blockchain regularly'
