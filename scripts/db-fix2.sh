#!/bin/bash
echo "--- Product 45 & 49 ---"
docker exec marketplace-postgres psql -U postgres -d marketplace_db -t \
  -c "SELECT product_id, name, base_price_usd, status FROM products WHERE product_id IN (45, 49);"

echo "--- Seller payout wallets ---"
docker exec marketplace-postgres psql -U postgres -d marketplace_db -t \
  -c "SELECT sp.seller_id, u.email, sp.payout_wallet FROM seller_profiles sp JOIN users u ON sp.seller_id = u.user_id;"

echo "--- Fix orders total_amount = 0 ---"
docker exec marketplace-postgres psql -U postgres -d marketplace_db -t \
  -c "UPDATE orders o SET total_amount = p.base_price_usd * o.quantity, price_usd = p.base_price_usd * o.quantity, subtotal = p.base_price_usd * o.quantity FROM products p WHERE o.product_id = p.product_id AND o.total_amount = 0 AND o.status = 'UNPAID';"

echo "--- Orders after fix ---"
docker exec marketplace-postgres psql -U postgres -d marketplace_db -t \
  -c "SELECT order_id, status, total_amount FROM orders ORDER BY order_id DESC LIMIT 10;"

echo "--- Set test passwords hash for Test@1234 ---"
docker exec marketplace-postgres psql -U postgres -d marketplace_db -t \
  -c "UPDATE users SET password_hash = '\$2b\$10\$rQnH8GKvzF0vKvW3yMeJa.3WQghSBiRjLVanSCWGRWfISdNiKWp2G' WHERE email IN ('buyer1@marketplace.com', 'buyer2@marketplace.com');"
echo "buyer1 & buyer2 password set to: Test@1234"

echo "--- Login test ---"
curl -s -X POST https://kienai.id.vn/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer1@marketplace.com","password":"Test@1234"}' | head -c 400
