#!/bin/bash
# Fix payment_db schema + diagnose payment-api
echo "================================================================"
echo "  PAYMENT-DB FIX + PAYMENT-API DIAGNOSIS"
echo "================================================================"

echo ""
echo "[1] Payment-API process check:"
docker exec marketplace-payment-api ps aux 2>&1 || echo "exec failed"

echo ""
echo "[2] Payment-API env check (no secrets):"
docker exec marketplace-payment-api env 2>&1 | grep -E 'PORT|NODE_ENV|DATABASE_URL|RABBITMQ|REDIS' | sed 's/PASSWORD[^=]*=.*/PASSWORD=HIDDEN/g'

echo ""
echo "[3] Payment-API dist check:"
docker exec marketplace-payment-api ls /app/dist/ 2>&1

echo ""
echo "[4] Payment-db current tables:"
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name" 2>&1

echo ""
echo "[5] Check if payment_db has wrong schema (addresses table = marketplace schema):"
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='token_whitelist'" 2>&1

echo ""
echo "[6] Check payment_db has token_whitelist with correct columns:"
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -t -c "SELECT column_name FROM information_schema.columns WHERE table_name='token_whitelist' ORDER BY column_name" 2>&1

echo ""
echo "[7] Token whitelist data:"
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "SELECT * FROM token_whitelist LIMIT 10" 2>&1

echo ""
echo "[8] Try curling payment-api from inside network:"
docker exec marketplace-postgres wget -qO- http://marketplace-payment-api:3002/ 2>&1 || echo "wget from postgres failed"
docker exec marketplace-redis wget -qO- http://marketplace-payment-api:3002/ 2>&1 || echo "wget from redis failed"

echo ""
echo "[9] Payment-api docker inspect (LogPath + Cmd):"
docker inspect marketplace-payment-api 2>&1 | grep -E '"Cmd"|"Entrypoint"|"LogPath"|"StartedAt"'

echo ""
echo "[10] Payment-api strace-like: check open ports on VPS:"
ss -tlnp 2>&1 | grep -E '3001|3002|3000|8000'

echo "================================================================"
echo "DONE"
echo "================================================================"
