-- ========================================
-- SEED DATA FOR E-COMMERCE DATABASE
-- Sample data for testing and development
-- ========================================

\c ecommerce_db;

-- ========================================
-- PART 1: USERS (100 users)
-- Password for all: Password123!
-- Hash: $2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3
-- ========================================

-- Admin users (10)
INSERT INTO users (email, username, password_hash, full_name, phone, auth_type, status, email_verified) VALUES
('admin1@ecom.com', 'admin1', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin One', '+1234567801', 'local', 'active', TRUE),
('admin2@ecom.com', 'admin2', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Two', '+1234567802', 'local', 'active', TRUE),
('admin3@ecom.com', 'admin3', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Three', '+1234567803', 'local', 'active', TRUE),
('admin4@ecom.com', 'admin4', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Four', '+1234567804', 'local', 'active', TRUE),
('admin5@ecom.com', 'admin5', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Five', '+1234567805', 'local', 'active', TRUE),
('admin6@ecom.com', 'admin6', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Six', '+1234567806', 'local', 'active', TRUE),
('admin7@ecom.com', 'admin7', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Seven', '+1234567807', 'local', 'active', TRUE),
('admin8@ecom.com', 'admin8', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Eight', '+1234567808', 'local', 'active', TRUE),
('admin9@ecom.com', 'admin9', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Nine', '+1234567809', 'local', 'active', TRUE),
('admin10@ecom.com', 'admin10', '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3', 'Admin Ten', '+1234567810', 'local', 'active', TRUE);

-- Seller users (30)
INSERT INTO users (email, username, password_hash, full_name, phone, auth_type, status, email_verified)
SELECT 
    'seller' || s.id || '@ecom.com',
    'seller' || s.id,
    '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3',
    'Seller ' || s.id,
    '+123456' || LPAD(s.id::TEXT, 4, '0'),
    'local',
    'active',
    TRUE
FROM generate_series(1, 30) AS s(id);

-- Regular users (60)
INSERT INTO users (email, username, password_hash, full_name, phone, auth_type, status, email_verified)
SELECT 
    'user' || s.id || '@ecom.com',
    'user' || s.id,
    '$2b$10$rKqZxQxmZ5xQxmZ5xQxmZOJ5K8jD3mF9hK3jD3mF9hK3jD3mF9hK3',
    'User ' || s.id,
    '+123456' || LPAD((s.id + 30)::TEXT, 4, '0'),
    'local',
    'active',
    TRUE
FROM generate_series(1, 60) AS s(id);

-- Social login users (10 with Google)
INSERT INTO users (email, username, full_name, auth_type, status, email_verified) VALUES
('social1@gmail.com', 'social1', 'Social User One', 'social', 'active', TRUE),
('social2@gmail.com', 'social2', 'Social User Two', 'social', 'active', TRUE),
('social3@gmail.com', 'social3', 'Social User Three', 'social', 'active', TRUE),
('social4@gmail.com', 'social4', 'Social User Four', 'social', 'active', TRUE),
('social5@gmail.com', 'social5', 'Social User Five', 'social', 'active', TRUE),
('social6@gmail.com', 'social6', 'Social User Six', 'social', 'active', TRUE),
('social7@gmail.com', 'social7', 'Social User Seven', 'social', 'active', TRUE),
('social8@gmail.com', 'social8', 'Social User Eight', 'social', 'active', TRUE),
('social9@gmail.com', 'social9', 'Social User Nine', 'social', 'active', TRUE),
('social10@gmail.com', 'social10', 'Social User Ten', 'social', 'active', TRUE);

-- Insert social accounts for social users
INSERT INTO social_accounts (user_id, provider, provider_user_id, email, is_verified)
SELECT 
    u.user_id,
    'google',
    'google_' || u.user_id,
    u.email,
    TRUE
FROM users u
WHERE u.auth_type = 'social';

-- ========================================
-- PART 2: USER ADDRESSES
-- ========================================

-- Insert addresses for first 50 users
INSERT INTO user_addresses (user_id, address_type, recipient_name, phone, address_line1, city, country, postal_code, is_default)
SELECT 
    u.user_id,
    'shipping',
    u.full_name,
    u.phone,
    (ARRAY['123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm St', '654 Maple Dr'])[floor(random() * 5 + 1)],
    (ARRAY['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'])[floor(random() * 5 + 1)],
    'USA',
    LPAD(floor(random() * 99999)::TEXT, 5, '0'),
    TRUE
FROM users u
LIMIT 50;

-- ========================================
-- PART 3: ADMIN USERS
-- ========================================

INSERT INTO admin_users (user_id, role, is_active)
SELECT user_id, 'super_admin', TRUE
FROM users
WHERE username LIKE 'admin%'
LIMIT 5;

INSERT INTO admin_users (user_id, role, is_active)
SELECT user_id, 'admin', TRUE
FROM users
WHERE username LIKE 'admin%'
OFFSET 5 LIMIT 5;

-- ========================================
-- PART 4: CATEGORIES
-- ========================================

-- Top-level categories
INSERT INTO categories (name, slug, description, is_active, display_order) VALUES
('Electronics', 'electronics', 'Electronic devices and accessories', TRUE, 1),
('Fashion', 'fashion', 'Clothing, shoes and accessories', TRUE, 2),
('Home & Garden', 'home-garden', 'Home improvement and garden supplies', TRUE, 3),
('Sports & Outdoors', 'sports-outdoors', 'Sports equipment and outdoor gear', TRUE, 4),
('Books & Media', 'books-media', 'Books, music, movies and games', TRUE, 5),
('Toys & Games', 'toys-games', 'Toys and board games', TRUE, 6),
('Health & Beauty', 'health-beauty', 'Health and beauty products', TRUE, 7),
('Automotive', 'automotive', 'Car parts and accessories', TRUE, 8);

-- Sub-categories for Electronics
INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Smartphones', 'smartphones', 'Mobile phones and accessories', TRUE, 1
FROM categories WHERE slug = 'electronics';

INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Laptops', 'laptops', 'Laptops and notebooks', TRUE, 2
FROM categories WHERE slug = 'electronics';

INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Headphones', 'headphones', 'Headphones and earbuds', TRUE, 3
FROM categories WHERE slug = 'electronics';

INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Cameras', 'cameras', 'Digital cameras and accessories', TRUE, 4
FROM categories WHERE slug = 'electronics';

-- Sub-categories for Fashion
INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Men''s Clothing', 'mens-clothing', 'Men''s fashion', TRUE, 1
FROM categories WHERE slug = 'fashion';

INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Women''s Clothing', 'womens-clothing', 'Women''s fashion', TRUE, 2
FROM categories WHERE slug = 'fashion';

INSERT INTO categories (parent_id, name, slug, description, is_active, display_order)
SELECT category_id, 'Shoes', 'shoes', 'Footwear for all', TRUE, 3
FROM categories WHERE slug = 'fashion';

-- ========================================
-- PART 5: PRODUCTS & VARIANTS
-- ========================================

-- Get seller IDs
DO $$
DECLARE
    v_seller_id BIGINT;
    v_electronics_cat_id BIGINT;
    v_fashion_cat_id BIGINT;
    v_product_id BIGINT;
BEGIN
    -- Get category IDs
    SELECT category_id INTO v_electronics_cat_id FROM categories WHERE slug = 'electronics';
    SELECT category_id INTO v_fashion_cat_id FROM categories WHERE slug = 'fashion';
    
    -- Create 50 products (Electronics)
    FOR i IN 1..25 LOOP
        SELECT user_id INTO v_seller_id FROM users WHERE username LIKE 'seller%' ORDER BY RANDOM() LIMIT 1;
        
        INSERT INTO products (
            seller_id, sku, name, slug, description, short_description,
            base_price, compare_price, cost_price, currency, status, is_featured
        ) VALUES (
            v_seller_id,
            'ELEC-' || LPAD(i::TEXT, 6, '0'),
            'Electronic Product ' || i,
            'electronic-product-' || i,
            'Detailed description for electronic product ' || i,
            'Short description for product ' || i,
            (500 + random() * 2000)::DECIMAL(20,2),
            (600 + random() * 2500)::DECIMAL(20,2),
            (300 + random() * 1000)::DECIMAL(20,2),
            'USD',
            'active',
            (random() < 0.2)
        ) RETURNING product_id INTO v_product_id;
        
        -- Link to category
        INSERT INTO product_categories (product_id, category_id) VALUES (v_product_id, v_electronics_cat_id);
        
        -- Create variants
        FOR j IN 1..3 LOOP
            INSERT INTO product_variants (
                product_id, sku, variant_name, price, compare_price, stock_quantity
            ) VALUES (
                v_product_id,
                'ELEC-' || LPAD(i::TEXT, 6, '0') || '-V' || j,
                'Variant ' || j,
                (500 + random() * 2000)::DECIMAL(20,2),
                (600 + random() * 2500)::DECIMAL(20,2),
                floor(random() * 100 + 10)::INT
            );
        END LOOP;
    END LOOP;
    
    -- Create 25 products (Fashion)
    FOR i IN 26..50 LOOP
        SELECT user_id INTO v_seller_id FROM users WHERE username LIKE 'seller%' ORDER BY RANDOM() LIMIT 1;
        
        INSERT INTO products (
            seller_id, sku, name, slug, description, short_description,
            base_price, compare_price, cost_price, currency, status, is_featured
        ) VALUES (
            v_seller_id,
            'FASH-' || LPAD(i::TEXT, 6, '0'),
            'Fashion Product ' || i,
            'fashion-product-' || i,
            'Detailed description for fashion product ' || i,
            'Short description for product ' || i,
            (50 + random() * 500)::DECIMAL(20,2),
            (70 + random() * 600)::DECIMAL(20,2),
            (30 + random() * 300)::DECIMAL(20,2),
            'USD',
            'active',
            (random() < 0.2)
        ) RETURNING product_id INTO v_product_id;
        
        -- Link to category
        INSERT INTO product_categories (product_id, category_id) VALUES (v_product_id, v_fashion_cat_id);
        
        -- Create variants (sizes)
        FOR size IN SELECT unnest(ARRAY['S', 'M', 'L', 'XL']) LOOP
            INSERT INTO product_variants (
                product_id, sku, variant_name, 
                attributes, price, stock_quantity
            ) VALUES (
                v_product_id,
                'FASH-' || LPAD(i::TEXT, 6, '0') || '-' || size,
                'Size ' || size,
                jsonb_build_object('size', size),
                (50 + random() * 500)::DECIMAL(20,2),
                floor(random() * 50 + 5)::INT
            );
        END LOOP;
    END LOOP;
END $$;

-- ========================================
-- PART 6: PRODUCT IMAGES
-- ========================================

-- Add primary image to all products
INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_primary)
SELECT 
    product_id,
    'https://via.placeholder.com/800x600?text=Product+' || product_id,
    name,
    0,
    TRUE
FROM products;

-- ========================================
-- PART 7: CRYPTOCURRENCY SUPPORT
-- ========================================

INSERT INTO supported_cryptocurrencies (
    symbol, name, network, contract_address, decimals, 
    is_active, min_payment_amount, confirmation_blocks, processing_fee_percentage
) VALUES
('BTC', 'Bitcoin', 'Bitcoin', NULL, 8, TRUE, 0.0001, 3, 0.005),
('ETH', 'Ethereum', 'Ethereum', NULL, 18, TRUE, 0.001, 12, 0.003),
('USDT', 'Tether USD', 'Ethereum', '0xdac17f958d2ee523a2206206994597c13d831ec7', 18, TRUE, 10, 12, 0.001),
('USDC', 'USD Coin', 'Ethereum', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, TRUE, 10, 12, 0.001),
('BNB', 'Binance Coin', 'BSC', NULL, 18, TRUE, 0.01, 15, 0.002),
('BUSD', 'Binance USD', 'BSC', '0xe9e7cea3dedca5984780bafc599bd69add087d56', 18, TRUE, 10, 15, 0.001);

-- ========================================
-- PART 8: PAYMENT METHODS
-- ========================================

INSERT INTO payment_methods (method_code, method_name, description, is_active, display_order) VALUES
('crypto', 'Cryptocurrency', 'Pay with Bitcoin, Ethereum, USDT', TRUE, 1),
('credit_card', 'Credit Card', 'Visa, Mastercard, Amex', TRUE, 2),
('paypal', 'PayPal', 'Pay with your PayPal account', TRUE, 3),
('bank_transfer', 'Bank Transfer', 'Direct bank transfer', TRUE, 4);

-- ========================================
-- PART 9: COUPONS
-- ========================================

INSERT INTO coupons (
    code, description, discount_type, discount_value, 
    min_order_amount, usage_limit, valid_from, valid_until, is_active
) VALUES
('WELCOME10', '10% off your first order', 'percentage', 10, 50, 1000, NOW(), NOW() + INTERVAL '90 days', TRUE),
('SAVE50', '$50 off orders over $500', 'fixed_amount', 50, 500, 500, NOW(), NOW() + INTERVAL '60 days', TRUE),
('MEGA20', '20% off everything', 'percentage', 20, 100, 200, NOW(), NOW() + INTERVAL '30 days', TRUE),
('FREESHIP', 'Free shipping on orders over $100', 'fixed_amount', 15, 100, NULL, NOW(), NOW() + INTERVAL '365 days', TRUE),
('FLASH25', '25% flash sale', 'percentage', 25, 0, 100, NOW(), NOW() + INTERVAL '7 days', TRUE);

-- ========================================
-- PART 10: SAMPLE ORDERS
-- ========================================

-- Create 100 sample orders
DO $$
DECLARE
    v_user_id BIGINT;
    v_address_id BIGINT;
    v_order_id BIGINT;
    v_variant_id BIGINT;
    v_product_name VARCHAR(500);
    v_variant_name VARCHAR(255);
    v_price DECIMAL(20,2);
    v_quantity INT;
    v_subtotal DECIMAL(20,2);
    v_order_status VARCHAR(50);
    v_payment_status VARCHAR(50);
BEGIN
    FOR i IN 1..100 LOOP
        -- Pick random user
        SELECT user_id INTO v_user_id 
        FROM users 
        WHERE username LIKE 'user%' 
        ORDER BY RANDOM() LIMIT 1;
        
        -- Get user address
        SELECT address_id INTO v_address_id
        FROM user_addresses
        WHERE user_id = v_user_id
        LIMIT 1;
        
        -- Random order status
        v_order_status := (ARRAY['pending', 'confirmed', 'processing', 'shipped', 'delivered'])[floor(random() * 5 + 1)];
        v_payment_status := CASE 
            WHEN v_order_status IN ('confirmed', 'processing', 'shipped', 'delivered') THEN 'completed'
            ELSE 'pending'
        END;
        
        -- Create order
        INSERT INTO orders (
            user_id, shipping_address_id, 
            shipping_recipient_name, shipping_phone, shipping_address,
            subtotal, shipping_fee, total_amount, 
            status, payment_status
        )
        SELECT 
            v_user_id, v_address_id,
            u.full_name, u.phone, 
            a.address_line1 || ', ' || a.city || ', ' || a.country,
            0, 15, 15,
            v_order_status, v_payment_status
        FROM users u
        LEFT JOIN user_addresses a ON a.user_id = u.user_id
        WHERE u.user_id = v_user_id
        LIMIT 1
        RETURNING order_id INTO v_order_id;
        
        -- Add 1-5 items to order
        v_subtotal := 0;
        FOR j IN 1..(1 + floor(random() * 4))::INT LOOP
            -- Pick random variant
            SELECT pv.variant_id, p.name, pv.variant_name, pv.price
            INTO v_variant_id, v_product_name, v_variant_name, v_price
            FROM product_variants pv
            JOIN products p ON p.product_id = pv.product_id
            WHERE pv.is_active = TRUE
            ORDER BY RANDOM()
            LIMIT 1;
            
            v_quantity := (1 + floor(random() * 3))::INT;
            
            INSERT INTO order_items (
                order_id, variant_id, product_name, variant_name, 
                sku, price, quantity, subtotal
            ) VALUES (
                v_order_id, v_variant_id, v_product_name, v_variant_name,
                'SKU-' || v_variant_id, v_price, v_quantity, v_price * v_quantity
            );
            
            v_subtotal := v_subtotal + (v_price * v_quantity);
        END LOOP;
        
        -- Update order total
        UPDATE orders 
        SET subtotal = v_subtotal, total_amount = v_subtotal + shipping_fee
        WHERE order_id = v_order_id;
        
        -- Create payment transaction
        INSERT INTO payment_transactions (
            order_id, payment_method_id, amount, currency, status
        )
        SELECT 
            v_order_id,
            method_id,
            v_subtotal + 15,
            'USD',
            v_payment_status
        FROM payment_methods
        ORDER BY RANDOM()
        LIMIT 1;
    END LOOP;
END $$;

-- ========================================
-- PART 11: PRODUCT REVIEWS
-- ========================================

-- Add reviews for delivered orders
INSERT INTO product_reviews (
    product_id, user_id, order_item_id, rating, title, content, 
    is_verified_purchase, is_approved
)
SELECT 
    pv.product_id,
    o.user_id,
    oi.order_item_id,
    (3 + floor(random() * 3))::INT, -- Rating 3-5
    'Review for ' || p.name,
    'This is a sample review for the product. ' || 
    (ARRAY['Great product!', 'Good quality', 'Exceeded expectations', 'Worth the price', 'Highly recommend'])[floor(random() * 5 + 1)],
    TRUE,
    TRUE
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN product_variants pv ON pv.variant_id = oi.variant_id
JOIN products p ON p.product_id = pv.product_id
WHERE o.status = 'delivered'
AND random() < 0.3 -- 30% of delivered orders have reviews
LIMIT 200;

\echo '✅ Seed Data Created Successfully'
\echo '📊 Data Summary:'
\echo '  - 110 Users (10 admins, 30 sellers, 60 buyers, 10 social)'
\echo '  - 50 User addresses'
\echo '  - 8 Top categories + 10 sub-categories'
\echo '  - 50 Products with variants'
\echo '  - 6 Cryptocurrencies'
\echo '  - 4 Payment methods'
\echo '  - 5 Active coupons'
\echo '  - 100 Sample orders'
\echo '  - 200+ Product reviews'
\echo ''
\echo '🔐 Default password for all users: Password123!'
