-- ============================================
-- DATABASE UPDATE SCRIPT
-- ============================================
-- This script updates the database schema to match the backend models
-- Run this script on the user_db, order_db, and payment_db databases

-- ============================================
-- 1. USER_DB - Update UserProfiles table
-- ============================================
\c user_db;

-- Create ENUM types if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('USER', 'SELLER', 'SUPPORT', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop old table if exists (backup data first!)
-- ALTER TABLE "UserProfiles" RENAME TO "user_profiles_old";

-- Create new user_profiles table with all required columns
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    bio TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    country VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    role user_role NOT NULL DEFAULT 'USER',
    
    -- Seller specific fields
    is_seller BOOLEAN NOT NULL DEFAULT false,
    seller_verified BOOLEAN NOT NULL DEFAULT false,
    seller_verification_date TIMESTAMP WITH TIME ZONE,
    shop_name VARCHAR(255),
    shop_description TEXT,
    tax_id VARCHAR(100),
    
    -- Bank account verification
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(100),
    bank_verified BOOLEAN NOT NULL DEFAULT false,
    bank_verification_status verification_status NOT NULL DEFAULT 'PENDING',
    
    -- Privacy settings
    show_coin_balance BOOLEAN NOT NULL DEFAULT true,
    show_join_date BOOLEAN NOT NULL DEFAULT true,
    show_email BOOLEAN NOT NULL DEFAULT false,
    show_phone BOOLEAN NOT NULL DEFAULT false,
    
    -- Statistics
    total_sales INTEGER NOT NULL DEFAULT 0,
    total_purchases INTEGER NOT NULL DEFAULT 0,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    suspension_reason TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data from old table if exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'UserProfiles') THEN
        INSERT INTO user_profiles (
            id, user_id, email, username, full_name, avatar, bio, phone,
            date_of_birth, country, city, address, role,
            is_seller, seller_verified, shop_name, shop_description,
            bank_name, bank_account_number, bank_account_name,
            show_coin_balance, show_join_date, show_email, show_phone,
            is_active, created_at, updated_at
        )
        SELECT 
            id,
            "userId",
            email,
            username,
            "fullName",
            "avatarUrl",
            bio,
            "phoneNumber",
            "dateOfBirth",
            country,
            city,
            address,
            'USER'::user_role,
            false,
            false,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            COALESCE("showCoinBalance", true),
            COALESCE("showJoinDate", true),
            COALESCE("showEmail", false),
            COALESCE("showPhone", false),
            true,
            "createdAt",
            "updatedAt"
        FROM "UserProfiles"
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END $$;

-- Create indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_seller ON user_profiles(is_seller);
CREATE INDEX IF NOT EXISTS idx_user_profiles_seller_verified ON user_profiles(seller_verified);
CREATE INDEX IF NOT EXISTS idx_user_profiles_bank_verified ON user_profiles(bank_verified);

-- Update SellerApplications table
ALTER TABLE "SellerApplications" RENAME TO seller_applications;

-- Add missing columns to seller_applications
ALTER TABLE seller_applications 
    ADD COLUMN IF NOT EXISTS tax_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS business_license VARCHAR(255),
    ADD COLUMN IF NOT EXISTS tax_certificate VARCHAR(255),
    ADD COLUMN IF NOT EXISTS identity_document VARCHAR(255);

-- Rename columns to snake_case
DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "userId" TO user_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "shopName" TO shop_name;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "shopDescription" TO shop_description;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "businessType" TO business_type;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "businessAddress" TO business_address;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "phoneNumber" TO phone_number;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "bankName" TO bank_name;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "bankAccountNumber" TO bank_account_number;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "bankAccountName" TO bank_account_name;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "reviewedBy" TO reviewed_by;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "reviewedAt" TO reviewed_at;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "rejectionReason" TO rejection_reason;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "createdAt" TO created_at;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE seller_applications RENAME COLUMN "updatedAt" TO updated_at;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seller_applications_updated_at ON seller_applications;
CREATE TRIGGER update_seller_applications_updated_at
    BEFORE UPDATE ON seller_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. ORDER_DB - Create Orders and OrderItems tables
-- ============================================
\c order_db;

-- Create ENUM types
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    
    -- Delivery info
    shipping_name VARCHAR(255) NOT NULL,
    shipping_email VARCHAR(255) NOT NULL,
    shipping_phone VARCHAR(20) NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    shipping_country VARCHAR(100) NOT NULL,
    shipping_postal_code VARCHAR(20) NOT NULL,
    
    -- Order summary
    total_items INTEGER NOT NULL,
    subtotal_in_coins DECIMAL(18, 8) NOT NULL,
    subtotal_in_usd DECIMAL(18, 2) NOT NULL,
    shipping_fee_in_coins DECIMAL(18, 8) NOT NULL DEFAULT 0,
    shipping_fee_in_usd DECIMAL(18, 2) NOT NULL DEFAULT 0,
    total_in_coins DECIMAL(18, 8) NOT NULL,
    total_in_usd DECIMAL(18, 2) NOT NULL,
    
    -- Payment
    payment_method VARCHAR(50) NOT NULL, -- 'COIN', 'CREDIT_CARD', 'P2P'
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    payment_transaction_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Coin payment info
    coin_id VARCHAR(50),
    coin_symbol VARCHAR(10),
    
    -- Status
    order_status order_status NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    
    -- Tracking
    tracking_number VARCHAR(255),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create OrderItems table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    product_title VARCHAR(255) NOT NULL,
    product_image VARCHAR(255) NOT NULL,
    seller_id VARCHAR(255) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price_in_coins DECIMAL(18, 8) NOT NULL,
    price_in_usd DECIMAL(18, 2) NOT NULL,
    subtotal_in_coins DECIMAL(18, 8) NOT NULL,
    subtotal_in_usd DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create CartItems table
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    product_title VARCHAR(255) NOT NULL,
    product_image VARCHAR(255) NOT NULL,
    seller_id VARCHAR(255) NOT NULL,
    seller_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_in_coins DECIMAL(18, 8) NOT NULL,
    price_in_usd DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON cart_items(product_id);

-- Create triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. PAYMENT_DB - Create Payments and P2PTrades tables
-- ============================================
\c payment_db;

-- Create ENUM types
DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('CREDIT_CARD', 'COIN', 'P2P');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE p2p_trade_status AS ENUM ('PENDING', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED', 'VERIFYING', 'COMPLETED', 'CANCELLED', 'DISPUTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE p2p_trade_type AS ENUM ('BUY', 'SELL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255),
    amount DECIMAL(18, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_method payment_method_type NOT NULL,
    status payment_status_type NOT NULL DEFAULT 'PENDING',
    
    -- Stripe specific
    stripe_payment_intent_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- P2P specific
    p2p_trade_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create P2PTrades table
CREATE TABLE IF NOT EXISTS p2p_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    trade_type p2p_trade_type NOT NULL,
    coin_amount DECIMAL(18, 8) NOT NULL,
    coin_type VARCHAR(10) NOT NULL,
    fiat_amount DECIMAL(18, 2) NOT NULL,
    fiat_currency VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(18, 8) NOT NULL,
    
    -- Bank details
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_name VARCHAR(100) NOT NULL,
    
    -- Verification
    payment_proof_image VARCHAR(255),
    verified_by_admin VARCHAR(255),
    verification_notes TEXT,
    
    status p2p_trade_status NOT NULL DEFAULT 'PENDING',
    
    -- Timestamps for different stages
    payment_submitted_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_user_id ON p2p_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_status ON p2p_trades(status);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_trade_type ON p2p_trades(trade_type);

-- Create triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_p2p_trades_updated_at
    BEFORE UPDATE ON p2p_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE!
-- ============================================