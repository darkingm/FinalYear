#!/bin/bash
echo "=== Token whitelist constraints ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'token_whitelist';"

echo ""
echo "=== Trying insert with UPSERT per symbol+chain ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active) SELECT 'MATIC', '0x0000000000000000000000000000000000001010', 80002, 18, TRUE WHERE NOT EXISTS (SELECT 1 FROM token_whitelist WHERE chain_id=80002 AND symbol='MATIC');"

docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active) SELECT 'ETH', '0x0000000000000000000000000000000000000000', 80002, 18, TRUE WHERE NOT EXISTS (SELECT 1 FROM token_whitelist WHERE chain_id=80002 AND symbol='ETH');"

docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active) SELECT 'USDT', '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 80002, 6, TRUE WHERE NOT EXISTS (SELECT 1 FROM token_whitelist WHERE chain_id=80002 AND symbol='USDT');"

echo ""
echo "=== Result ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "SELECT token_id, symbol, left(token_address,10) as addr, chain_id, decimals, is_active FROM token_whitelist ORDER BY chain_id, symbol;"
