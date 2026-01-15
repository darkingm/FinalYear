-- Seed data: Sample orders and order history

-- Sample Orders with various statuses
INSERT INTO orders (
    id, order_number, user_id,
    shipping_name, shipping_email, shipping_phone, shipping_address, shipping_city, shipping_country, shipping_postal_code,
    total_items, subtotal_in_coins, subtotal_in_usd, shipping_fee_in_coins, shipping_fee_in_usd,
    total_in_coins, total_in_usd,
    payment_method, payment_status, order_status,
    created_at
) VALUES
-- Completed orders
(
    'ord-0001-0000-0000-000000000001',
    'ORD-20240101-001',
    'u0000000-0000-0000-0000-000000000001',
    'Nguyễn Văn A', 'nguyenvana@example.com', '0912345678',
    '123 Đường ABC, Phường XYZ', 'Hà Nội', 'Việt Nam', '100000',
    2, 0.0005, 250.00, 0.0001, 5.00,
    0.0006, 255.00,
    'COIN', 'PAID', 'DELIVERED',
    NOW() - INTERVAL '30 days'
),
(
    'ord-0002-0000-0000-000000000002',
    'ORD-20240102-002',
    'u0000000-0000-0000-0000-000000000001',
    'Nguyễn Văn A', 'nguyenvana@example.com', '0912345678',
    '123 Đường ABC, Phường XYZ', 'Hà Nội', 'Việt Nam', '100000',
    1, 0.001, 500.00, 0.0001, 5.00,
    0.0011, 505.00,
    'COIN', 'PAID', 'DELIVERED',
    NOW() - INTERVAL '20 days'
),
-- Processing orders
(
    'ord-0003-0000-0000-000000000003',
    'ORD-20240115-003',
    'u0000000-0000-0000-0000-000000000002',
    'Trần Thị B', 'tranthib@example.com', '0987654321',
    '456 Đường DEF, Phường UVW', 'TP. Hồ Chí Minh', 'Việt Nam', '700000',
    3, 0.002, 1000.00, 0.0002, 10.00,
    0.0022, 1010.00,
    'COIN', 'PAID', 'PROCESSING',
    NOW() - INTERVAL '5 days'
),
-- Shipped orders
(
    'ord-0004-0000-0000-000000000004',
    'ORD-20240118-004',
    'u0000000-0000-0000-0000-000000000003',
    'Lê Văn C', 'levanc@example.com', '0901234567',
    '789 Đường GHI, Phường RST', 'Đà Nẵng', 'Việt Nam', '550000',
    1, 0.0003, 150.00, 0.00005, 3.00,
    0.00035, 153.00,
    'COIN', 'PAID', 'SHIPPED',
    NOW() - INTERVAL '3 days'
),
-- Pending orders
(
    'ord-0005-0000-0000-000000000005',
    'ORD-20240120-005',
    'u0000000-0000-0000-0000-000000000001',
    'Nguyễn Văn A', 'nguyenvana@example.com', '0912345678',
    '123 Đường ABC, Phường XYZ', 'Hà Nội', 'Việt Nam', '100000',
    2, 0.0008, 400.00, 0.0001, 5.00,
    0.0009, 405.00,
    'COIN', 'PENDING', 'PENDING',
    NOW() - INTERVAL '1 day'
);

-- Sample Order Items
INSERT INTO order_items (
    id, order_id, product_id, product_title, product_image,
    quantity, unit_price_in_coins, unit_price_in_usd,
    total_price_in_coins, total_price_in_usd,
    created_at
) VALUES
-- Items for order 1
(
    'item-0001-0000-0000-000000000001',
    'ord-0001-0000-0000-000000000001',
    '507f1f77bcf86cd799439011',
    'iPhone 15 Pro Max 256GB',
    'https://via.placeholder.com/400',
    1, 0.00025, 125.00,
    0.00025, 125.00,
    NOW() - INTERVAL '30 days'
),
(
    'item-0002-0000-0000-000000000002',
    'ord-0001-0000-0000-000000000001',
    '507f1f77bcf86cd799439012',
    'Samsung Galaxy S24 Ultra',
    'https://via.placeholder.com/400',
    1, 0.00025, 125.00,
    0.00025, 125.00,
    NOW() - INTERVAL '30 days'
),
-- Items for order 2
(
    'item-0003-0000-0000-000000000003',
    'ord-0002-0000-0000-000000000002',
    '507f1f77bcf86cd799439013',
    'MacBook Pro 16 inch M3',
    'https://via.placeholder.com/400',
    1, 0.001, 500.00,
    0.001, 500.00,
    NOW() - INTERVAL '20 days'
),
-- Items for order 3
(
    'item-0004-0000-0000-000000000004',
    'ord-0003-0000-0000-000000000003',
    '507f1f77bcf86cd799439014',
    'iPad Pro 12.9 inch',
    'https://via.placeholder.com/400',
    2, 0.0003, 150.00,
    0.0006, 300.00,
    NOW() - INTERVAL '5 days'
),
(
    'item-0005-0000-0000-000000000005',
    'ord-0003-0000-0000-000000000003',
    '507f1f77bcf86cd799439015',
    'Apple Watch Series 9',
    'https://via.placeholder.com/400',
    1, 0.0004, 200.00,
    0.0004, 200.00,
    NOW() - INTERVAL '5 days'
);

-- Sample Vouchers
INSERT INTO vouchers (
    id, code, seller_id, title, description,
    type, discount_value, min_purchase_amount, max_discount_amount,
    max_uses, max_uses_per_user, used_count,
    start_date, end_date, status
) VALUES
-- Global vouchers
(
    'vch-0001-0000-0000-000000000001',
    'WELCOME10',
    NULL,
    'Welcome Discount 10%',
    'Giảm 10% cho đơn hàng đầu tiên',
    'PERCENTAGE', 10, 100.00, 50.00,
    1000, 1, 150,
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '30 days',
    'ACTIVE'
),
(
    'vch-0002-0000-0000-000000000002',
    'FREESHIP',
    NULL,
    'Free Shipping',
    'Miễn phí vận chuyển cho đơn hàng trên $50',
    'FREE_SHIPPING', 0, 50.00, NULL,
    500, 3, 89,
    NOW() - INTERVAL '15 days',
    NOW() + INTERVAL '45 days',
    'ACTIVE'
),
-- Seller-specific vouchers
(
    'vch-0003-0000-0000-000000000003',
    'SELLER50K',
    'seller-0001-0000-0000-000000000001',
    'Seller Discount $50',
    'Giảm $50 cho đơn hàng trên $200',
    'FIXED_AMOUNT', 50.00, 200.00, NULL,
    100, 2, 25,
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '20 days',
    'ACTIVE'
);

