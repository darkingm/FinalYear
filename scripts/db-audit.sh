#!/bin/bash
echo "=== Users ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT user_id, email, username, role, status FROM users ORDER BY user_id LIMIT 10;"

echo "=== Seller Profiles (with payout_wallet) ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT sp.seller_id, u.email, u.username, sp.payout_wallet, sp.store_name FROM seller_profiles sp JOIN users u ON sp.seller_id = u.user_id LIMIT 5;"

echo "=== Products (first 5) ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT product_id, name, base_price_usd, status FROM products ORDER BY product_id LIMIT 5;"

echo "=== Recent Orders ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT order_id, buyer_id, seller_id, product_id, status, total_amount, created_at FROM orders ORDER BY order_id DESC LIMIT 10;"

echo "=== Token Whitelist ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db \
  -c "SELECT token_id, symbol, chain_id, token_address, is_active FROM token_whitelist ORDER BY token_id;"
