-- Migration: Create vouchers and voucher_usages tables

-- Create vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    seller_id VARCHAR(255), -- NULL for global vouchers
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING')),
    discount_value DECIMAL(18, 2) NOT NULL,
    min_purchase_amount DECIMAL(18, 2),
    max_discount_amount DECIMAL(18, 2),
    max_uses INTEGER,
    max_uses_per_user INTEGER,
    used_count INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    applicable_categories TEXT[], -- Array of category names
    applicable_products TEXT[], -- Array of product IDs
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_seller_id ON vouchers(seller_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_dates ON vouchers(start_date, end_date);

-- Create voucher_usages table
CREATE TABLE IF NOT EXISTS voucher_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    discount_amount DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_voucher_usages_voucher_id ON voucher_usages(voucher_id);
CREATE INDEX idx_voucher_usages_user_id ON voucher_usages(user_id);
CREATE INDEX idx_voucher_usages_order_id ON voucher_usages(order_id);
CREATE INDEX idx_voucher_usages_user_voucher ON voucher_usages(user_id, voucher_id);

-- Add voucher columns to orders table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'voucher_code') THEN
        ALTER TABLE orders ADD COLUMN voucher_code VARCHAR(50);
        ALTER TABLE orders ADD COLUMN voucher_discount DECIMAL(18, 2);
        ALTER TABLE orders ADD COLUMN voucher_discount_in_coins DECIMAL(18, 8);
    END IF;
END $$;

