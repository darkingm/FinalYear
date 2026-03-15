#!/bin/bash
echo "=== Products table schema ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;"

echo "=== Orders table schema ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders' ORDER BY ordinal_position;"

echo "=== Sample product prices ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "SELECT product_id, name, price, price_token, token_id, metadata->'accepted_tokens' as tokens FROM products LIMIT 5;"

echo "=== Sample orders ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "SELECT order_id, status, total_amount, amount_token, token_id, chain_id, payment_method FROM orders LIMIT 5;"
