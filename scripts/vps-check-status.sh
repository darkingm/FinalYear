#!/bin/bash
# Final status check script - runs entirely on VPS
echo "=== CONTAINER STATUS ==="
docker ps -a --format 'NAME:{{.Names}} | STATUS:{{.Status}} | IMG:{{.Image}}'

echo ""
echo "=== HTTP HEALTH CHECKS ==="
echo -n "Frontend  (3000): "; curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3000 2>&1
echo -n "Main-API  (3001): "; curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/api/products?limit=1 2>&1
echo -n "Pay-API   (3002): "; curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3002/ 2>&1

echo ""
echo "=== MAIN-API LOGS (last 30) ==="
docker logs marketplace-main-api --tail 30 2>&1

echo ""
echo "=== PAYMENT-API LOGS (last 30) ==="
docker logs marketplace-payment-api --tail 30 2>&1

echo ""
echo "=== FRONTEND LOGS (last 15) ==="
docker logs marketplace-frontend --tail 15 2>&1

echo ""
echo "=== AI-SERVICE LOGS (last 10) ==="
docker logs marketplace-ai --tail 10 2>&1

echo ""
echo "=== DB CHECK - marketplace_db tables ==="
docker exec marketplace-postgres psql -U postgres -d marketplace_db -c "\dt" 2>&1 | head -30

echo ""
echo "=== DB CHECK - payment_db tables ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -c "\dt" 2>&1 | head -20

echo ""
echo "=== AMOY TOKEN CHECK ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -t -c "SELECT chain_id, symbol, contract_address FROM token_whitelist WHERE chain_id='80002' LIMIT 5" 2>&1

echo ""
echo "=== DISK & RAM ==="
df -h / 2>&1
free -h 2>&1

echo ""
echo "=== NGINX STATUS ==="
systemctl status nginx --no-pager 2>&1 | head -10

echo "=== DONE ==="
