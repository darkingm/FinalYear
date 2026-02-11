-- =====================================================
-- SAMPLE DATA FOR WEB3 MARKETPLACE
-- Testing & Demonstration Data
-- =====================================================

-- Clear existing data (careful in production!)
-- TRUNCATE TABLE users CASCADE;

-- =====================================================
-- SECTION 1: USERS & AUTHENTICATION
-- =====================================================

-- Insert sample users
INSERT INTO users (email, wallet_address, username, role, status) VALUES
('admin@marketplace.com', '0x1234567890123456789012345678901234567890', 'admin_master', 'admin', 'active'),
('john.buyer@email.com', '0x2345678901234567890123456789012345678901', 'john_buyer', 'buyer', 'active'),
('jane.seller@email.com', '0x3456789012345678901234567890123456789012', 'jane_tech', 'seller', 'active'),
('mike.seller@email.com', '0x4567890123456789012345678901234567890123', 'mike_fashion', 'seller', 'active'),
('sarah.buyer@email.com', '0x5678901234567890123456789012345678901234', 'sarah_shopper', 'buyer', 'active');

-- Insert seller profiles
INSERT INTO seller_profiles (user_id, display_name, description, payout_wallet, kyc_status, kyc_verified_at, rating_avg, total_sales) VALUES
(3, 'TechGadgets Pro', 'Premium electronics and gadgets', '0x3456789012345678901234567890123456789012', 'verified', NOW() - INTERVAL '30 days', 4.85, 150),
(4, 'Fashion Avenue', 'Trendy clothing and accessories', '0x4567890123456789012345678901234567890123', 'verified', NOW() - INTERVAL '60 days', 4.60, 89);

-- Insert shipping addresses
INSERT INTO addresses (user_id, full_name, phone, country, province, district, address_line, postal_code, is_default) VALUES
(2, 'John Doe', '+1-555-0101', 'US', 'California', 'San Francisco', '123 Main St, Apt 4B', '94102', TRUE),
(2, 'John Doe', '+1-555-0101', 'US', 'New York', 'Manhattan', '456 Park Ave', '10001', FALSE),
(5, 'Sarah Smith', '+1-555-0202', 'US', 'Texas', 'Austin', '789 Oak Drive', '73301', TRUE);

-- =====================================================
-- SECTION 2: WAREHOUSES & INVENTORY SETUP
-- =====================================================

-- Insert warehouses
INSERT INTO warehouses (name, code, country, province, address, status) VALUES
('West Coast Warehouse', 'WH-WC-001', 'US', 'California', '1000 Warehouse Blvd, Los Angeles, CA 90001', 'active'),
('East Coast Warehouse', 'WH-EC-001', 'US', 'New York', '2000 Distribution Dr, New York, NY 10001', 'active'),
('Central Warehouse', 'WH-CT-001', 'US', 'Texas', '3000 Logistics Ln, Dallas, TX 75201', 'active');

-- =====================================================
-- SECTION 3: PRODUCTS & CATALOG
-- =====================================================

-- Insert products from TechGadgets Pro
INSERT INTO products (seller_id, name, description, category, base_price_usd, status) VALUES
(1, 'Premium Wireless Headphones', 'High-fidelity wireless headphones with active noise cancellation', 'Electronics', 299.99, 'active'),
(1, 'Smart Watch Pro', 'Advanced fitness tracker with heart rate monitoring', 'Electronics', 399.99, 'active'),
(1, 'Portable Bluetooth Speaker', 'Waterproof speaker with 20-hour battery life', 'Electronics', 79.99, 'active'),
(1, 'USB-C Hub 7-in-1', 'Multi-port adapter for laptops and tablets', 'Electronics', 49.99, 'active'),
(1, 'Wireless Charging Pad', 'Fast wireless charger compatible with all Qi devices', 'Electronics', 29.99, 'active');

-- Insert products from Fashion Avenue
INSERT INTO products (seller_id, name, description, category, base_price_usd, status) VALUES
(2, 'Premium Cotton T-Shirt', 'Soft, breathable cotton tee in multiple colors', 'Clothing', 24.99, 'active'),
(2, 'Denim Jeans Classic Fit', 'Comfortable denim jeans with classic styling', 'Clothing', 59.99, 'active'),
(2, 'Leather Wallet', 'Genuine leather bifold wallet with RFID protection', 'Accessories', 39.99, 'active'),
(2, 'Unisex Backpack', 'Durable canvas backpack with laptop compartment', 'Accessories', 69.99, 'active'),
(2, 'Sunglasses UV400', 'Polarized sunglasses with UV protection', 'Accessories', 89.99, 'active');

-- Insert product images
INSERT INTO product_images (product_id, image_url, sort_order, is_primary, alt_text) VALUES
-- Headphones
(1, 'https://images.example.com/headphones-main.jpg', 1, TRUE, 'Wireless headphones main view'),
(1, 'https://images.example.com/headphones-side.jpg', 2, FALSE, 'Wireless headphones side view'),
(1, 'https://images.example.com/headphones-case.jpg', 3, FALSE, 'Headphones with case'),
-- Smart Watch
(2, 'https://images.example.com/smartwatch-main.jpg', 1, TRUE, 'Smart watch display'),
(2, 'https://images.example.com/smartwatch-black.jpg', 2, FALSE, 'Smart watch black'),
-- Speaker
(3, 'https://images.example.com/speaker-main.jpg', 1, TRUE, 'Bluetooth speaker'),
-- USB Hub
(4, 'https://images.example.com/usb-hub-main.jpg', 1, TRUE, 'USB-C hub'),
-- Wireless Charger
(5, 'https://images.example.com/charger-main.jpg', 1, TRUE, 'Wireless charging pad'),
-- T-Shirt
(6, 'https://images.example.com/tshirt-white.jpg', 1, TRUE, 'White cotton t-shirt'),
(6, 'https://images.example.com/tshirt-black.jpg', 2, FALSE, 'Black cotton t-shirt'),
-- Jeans
(7, 'https://images.example.com/jeans-blue.jpg', 1, TRUE, 'Blue denim jeans'),
-- Wallet
(8, 'https://images.example.com/wallet-brown.jpg', 1, TRUE, 'Brown leather wallet'),
-- Backpack
(9, 'https://images.example.com/backpack-main.jpg', 1, TRUE, 'Canvas backpack'),
-- Sunglasses
(10, 'https://images.example.com/sunglasses-main.jpg', 1, TRUE, 'Polarized sunglasses');

-- Insert inventory
INSERT INTO inventory (product_id, warehouse_id, total_stock, available, reserved) VALUES
-- TechGadgets products in West Coast warehouse
(1, 1, 100, 95, 5),
(2, 1, 75, 70, 5),
(3, 1, 150, 148, 2),
(4, 1, 200, 200, 0),
(5, 1, 180, 175, 5),
-- Fashion products in East Coast warehouse
(6, 2, 500, 480, 20),
(7, 2, 300, 290, 10),
(8, 2, 150, 145, 5),
(9, 2, 200, 195, 5),
(10, 2, 100, 98, 2);

-- Insert product variants
INSERT INTO product_variants (product_id, sku, attributes, inventory_id, status) VALUES
-- Headphones variants
(1, 'HP-WH-BLK-001', '{"color": "black"}', 1, 'active'),
(1, 'HP-WH-WHT-001', '{"color": "white"}', 1, 'active'),
(1, 'HP-WH-SLV-001', '{"color": "silver"}', 1, 'active'),
-- Smart Watch variants
(2, 'SW-PR-BLK-42', '{"color": "black", "size": "42mm"}', 2, 'active'),
(2, 'SW-PR-BLK-46', '{"color": "black", "size": "46mm"}', 2, 'active'),
(2, 'SW-PR-SLV-42', '{"color": "silver", "size": "42mm"}', 2, 'active'),
-- T-Shirt variants
(6, 'TS-CT-WHT-S', '{"color": "white", "size": "S"}', 6, 'active'),
(6, 'TS-CT-WHT-M', '{"color": "white", "size": "M"}', 6, 'active'),
(6, 'TS-CT-WHT-L', '{"color": "white", "size": "L"}', 6, 'active'),
(6, 'TS-CT-WHT-XL', '{"color": "white", "size": "XL"}', 6, 'active'),
(6, 'TS-CT-BLK-S', '{"color": "black", "size": "S"}', 6, 'active'),
(6, 'TS-CT-BLK-M', '{"color": "black", "size": "M"}', 6, 'active'),
(6, 'TS-CT-BLK-L', '{"color": "black", "size": "L"}', 6, 'active'),
(6, 'TS-CT-BLK-XL', '{"color": "black", "size": "XL"}', 6, 'active'),
-- Jeans variants
(7, 'JN-DN-BLU-30', '{"color": "blue", "waist": "30"}', 7, 'active'),
(7, 'JN-DN-BLU-32', '{"color": "blue", "waist": "32"}', 7, 'active'),
(7, 'JN-DN-BLU-34', '{"color": "blue", "waist": "34"}', 7, 'active'),
(7, 'JN-DN-BLU-36', '{"color": "blue", "waist": "36"}', 7, 'active');

-- =====================================================
-- SECTION 4: CRYPTO TOKENS
-- =====================================================

-- Insert supported payment tokens
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, oracle_price_feed, is_active) VALUES
('ETH', '0x0000000000000000000000000000000000000000', 1, 18, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', TRUE),
('USDT', '0xdac17f958d2ee523a2206206994597c13d831ec7', 1, 6, '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', TRUE),
('USDC', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1, 6, '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', TRUE),
('DAI', '0x6b175474e89094c44da98b954eedeac495271d0f', 1, 18, '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', TRUE),
('WETH', '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 1, 18, '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', TRUE);

-- Insert exchange rates (current snapshot)
INSERT INTO exchange_rates (token_id, usd_rate, source) VALUES
(1, 2450.50, 'Chainlink'),
(2, 1.00, 'Chainlink'),
(3, 1.00, 'Chainlink'),
(4, 1.00, 'Chainlink'),
(5, 2450.50, 'Chainlink');

-- =====================================================
-- SECTION 5: SHOPPING CARTS
-- =====================================================

-- Create active carts
INSERT INTO carts (user_id, status) VALUES
(2, 'active'),
(5, 'active');

-- Add items to John's cart
INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_snapshot) VALUES
(1, 1, 1, 1, 299.99),  -- Black headphones
(1, 3, NULL, 1, 79.99); -- Bluetooth speaker

-- Add items to Sarah's cart
INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, price_snapshot) VALUES
(2, 6, 8, 2, 24.99),   -- 2x White T-Shirt Medium
(2, 7, 16, 1, 59.99);  -- Blue Jeans 32

-- =====================================================
-- SECTION 6: ORDERS & PAYMENTS
-- =====================================================

-- Create completed orders
INSERT INTO orders (buyer_id, seller_id, shipping_address_id, order_number, quantity, price_usd, subtotal, shipping_fee, total_amount, status) VALUES
(2, 1, 1, 'ORD-2024-00001', 1, 399.99, 399.99, 15.00, 414.99, 'delivered'),
(5, 2, 3, 'ORD-2024-00002', 3, 24.99, 74.97, 10.00, 84.97, 'delivered'),
(2, 1, 1, 'ORD-2024-00003', 2, 299.99, 599.98, 15.00, 614.98, 'shipped'),
(5, 2, 3, 'ORD-2024-00004', 1, 59.99, 59.99, 10.00, 69.99, 'processing');

-- Add order items
INSERT INTO order_items (order_id, product_id, variant_id, quantity, price_snapshot, subtotal) VALUES
-- Order 1
(1, 2, 4, 1, 399.99, 399.99),
-- Order 2
(2, 6, 7, 2, 24.99, 49.98),
(2, 6, 8, 1, 24.99, 24.99),
-- Order 3
(3, 1, 1, 2, 299.99, 599.98),
-- Order 4
(4, 7, 16, 1, 59.99, 59.99);

-- Create payments
INSERT INTO order_payments (order_id, token_id, amount, tx_hash, chain_id, block_number, status, verified_by_rpc, verified_by_indexer, confirmations) VALUES
(1, 2, 414.990000, '0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234', 1, 18500000, 'confirmed', TRUE, TRUE, 15),
(2, 3, 84.970000, '0xefab5678901234efab5678901234efab5678901234efab5678901234efab5678', 1, 18500100, 'confirmed', TRUE, TRUE, 12),
(3, 1, 0.251020000000000000, '0x1234abcd5678efab1234abcd5678efab1234abcd5678efab1234abcd5678efab', 1, 18500200, 'confirmed', TRUE, TRUE, 8),
(4, 2, 69.990000, '0x9876fedc5432ba109876fedc5432ba109876fedc5432ba109876fedc5432ba10', 1, 18500250, 'confirming', TRUE, FALSE, 3);

-- Create shipments
INSERT INTO shipments (order_id, carrier, tracking_code, shipping_fee, status, shipped_at, delivered_at) VALUES
(1, 'FedEx', 'FDX1234567890', 15.00, 'delivered', NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),
(2, 'USPS', 'USPS9876543210', 10.00, 'delivered', NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days'),
(3, 'DHL', 'DHL5555666677', 15.00, 'in_transit', NOW() - INTERVAL '2 days', NULL);

-- Create platform fees
INSERT INTO platform_fees (order_id, fee_amount_usd, fee_percentage, collector_wallet, status) VALUES
(1, 12.45, 3.00, '0x9999999999999999999999999999999999999999', 'collected'),
(2, 2.55, 3.00, '0x9999999999999999999999999999999999999999', 'collected'),
(3, 18.45, 3.00, '0x9999999999999999999999999999999999999999', 'collected'),
(4, 2.10, 3.00, '0x9999999999999999999999999999999999999999', 'pending');

-- =====================================================
-- SECTION 7: REVIEWS
-- =====================================================

-- Create reviews (triggers will update ratings automatically)
INSERT INTO reviews (order_id, product_id, buyer_id, rating, comment, status) VALUES
(1, 2, 2, 5, 'Excellent smart watch! Battery life is amazing and the fitness tracking is very accurate.', 'published'),
(2, 6, 5, 4, 'Good quality t-shirt, very comfortable. Color is exactly as shown.', 'published'),
(2, 6, 5, 5, 'Love these shirts! Ordered more in different colors.', 'published');

-- =====================================================
-- SECTION 8: NOTIFICATIONS
-- =====================================================

-- Create notifications
INSERT INTO notifications (user_id, type, title, message, is_read) VALUES
(2, 'order', 'Order Shipped', 'Your order #ORD-2024-00003 has been shipped via DHL. Tracking: DHL5555666677', FALSE),
(2, 'order', 'Order Delivered', 'Your order #ORD-2024-00001 has been delivered!', TRUE),
(5, 'order', 'Order Delivered', 'Your order #ORD-2024-00002 has been delivered!', TRUE),
(5, 'payment', 'Payment Confirmed', 'Your payment of 84.97 USDC has been confirmed.', TRUE);

-- =====================================================
-- SECTION 9: COUPONS
-- =====================================================

-- Create sample coupons
INSERT INTO coupons (code, discount_type, discount_value, min_purchase, max_uses, used_count, valid_from, valid_until, status) VALUES
('WELCOME10', 'percentage', 10.00, 50.00, 100, 12, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 'active'),
('SAVE20', 'fixed', 20.00, 100.00, 50, 8, NOW() - INTERVAL '15 days', NOW() + INTERVAL '45 days', 'active'),
('FLASH50', 'percentage', 50.00, 200.00, 20, 20, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', 'expired'),
('NEWUSER15', 'percentage', 15.00, 30.00, 1000, 145, NOW() - INTERVAL '60 days', NOW() + INTERVAL '30 days', 'active');

-- =====================================================
-- SECTION 10: INVENTORY LOCKS (ACTIVE)
-- =====================================================

-- Create some active locks (simulating checkout in progress)
INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status) VALUES
(1, NULL, 2, NOW() + INTERVAL '10 minutes', 'active'),
(6, NULL, 1, NOW() + INTERVAL '12 minutes', 'active');

-- Create committed locks for completed orders
INSERT INTO inventory_locks (inventory_id, order_id, quantity, expires_at, status) VALUES
(2, 1, 1, NOW() - INTERVAL '10 days', 'committed'),
(6, 2, 3, NOW() - INTERVAL '8 days', 'committed'),
(1, 3, 2, NOW() - INTERVAL '2 days', 'committed');

-- =====================================================
-- SECTION 11: AUDIT LOGS
-- =====================================================

-- Log some important events
INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, changed_by) VALUES
('order', 1, 'status_changed', '{"status": "confirmed"}', '{"status": "shipped"}', 1),
('order', 1, 'status_changed', '{"status": "shipped"}', '{"status": "delivered"}', 1),
('payment', 1, 'verified', '{"verified_by_rpc": false}', '{"verified_by_rpc": true}', 1),
('product', 1, 'price_updated', '{"base_price_usd": 289.99}', '{"base_price_usd": 299.99}', 3);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify data inserted correctly
SELECT 'Total Users:' as metric, COUNT(*) as count FROM users
UNION ALL
SELECT 'Total Sellers:', COUNT(*) FROM seller_profiles
UNION ALL
SELECT 'Total Products:', COUNT(*) FROM products
UNION ALL
SELECT 'Total Orders:', COUNT(*) FROM orders
UNION ALL
SELECT 'Total Payments:', COUNT(*) FROM order_payments
UNION ALL
SELECT 'Total Reviews:', COUNT(*) FROM reviews
UNION ALL
SELECT 'Total Inventory Records:', COUNT(*) FROM inventory
UNION ALL
SELECT 'Active Carts:', COUNT(*) FROM carts WHERE status = 'active'
UNION ALL
SELECT 'Active Locks:', COUNT(*) FROM inventory_locks WHERE status = 'active';

-- Show product ratings (updated by triggers)
SELECT 
    p.product_id,
    p.name,
    p.rating_avg,
    p.review_count
FROM products p
WHERE p.review_count > 0
ORDER BY p.rating_avg DESC;

-- Show seller ratings (updated by triggers)
SELECT 
    sp.seller_id,
    sp.display_name,
    sp.rating_avg,
    sp.total_sales
FROM seller_profiles sp
ORDER BY sp.rating_avg DESC;

-- Show inventory status
SELECT 
    p.name as product_name,
    w.name as warehouse_name,
    i.total_stock,
    i.available,
    i.reserved
FROM inventory i
JOIN products p ON i.product_id = p.product_id
JOIN warehouses w ON i.warehouse_id = w.warehouse_id
ORDER BY p.product_id;

-- Show recent orders with payment status
SELECT 
    o.order_number,
    u.email as buyer_email,
    o.total_amount,
    o.status as order_status,
    op.amount as paid_amount,
    tw.symbol as payment_token,
    op.status as payment_status
FROM orders o
JOIN users u ON o.buyer_id = u.user_id
LEFT JOIN order_payments op ON o.order_id = op.order_id
LEFT JOIN token_whitelist tw ON op.token_id = tw.token_id
ORDER BY o.created_at DESC;

-- =====================================================
-- END OF SAMPLE DATA
-- =====================================================

-- Success message
SELECT 'Sample data inserted successfully!' as message;