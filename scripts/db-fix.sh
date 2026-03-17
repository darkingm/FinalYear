#!/bin/bash
echo "=== Products 45 & 49 ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT p.product_id, p.name, p.base_price_usd, p.status, i.available FROM products p LEFT JOIN inventory i ON p.product_id = i.product_id WHERE p.product_id IN (45, 49);"

echo "=== Seller payout wallets ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT sp.seller_id, u.email, u.username, sp.payout_wallet FROM seller_profiles sp JOIN users u ON sp.seller_id = u.user_id;"

echo "=== Fix: Update products 21-30 to have proper min price ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "UPDATE orders SET total_amount = 0.01, price_usd = 0.01, subtotal = 0.01 WHERE total_amount = 0 AND status = 'UNPAID';"

echo "=== Set buyer1 test password ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "UPDATE users SET password_hash = '\$2b\$10\$rQnH8GKvzF0vKvW3yMeJa.3WQghSBiRjLVanSCWGRWfISdNiKWp2G' WHERE email IN ('buyer1@marketplace.com', 'buyer2@marketplace.com');"

echo "=== Users passwords reset to 'Test@1234' ==="
