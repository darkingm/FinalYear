#!/bin/bash
set -e
echo "=== STEP 1: Stop and remove all containers ==="
docker stop $(docker ps -q) 2>/dev/null || true
docker rm $(docker ps -a -q) 2>/dev/null || true

echo "=== STEP 2: Start full stack with correct compose ==="
cd /root/services/FinalYear/docker
docker compose -f docker-compose.prod.yml --env-file .env up -d

echo "=== STEP 3: Waiting 30s for DB to initialize ==="
sleep 30

echo "=== STEP 4: Check containers ==="
docker ps --format 'table {{.Names}}\t{{.Status}}'

echo "=== STEP 5: Test API health ==="
curl -sf http://127.0.0.1:3001/api/health && echo "main-api OK" || echo "main-api FAIL"
curl -sf http://127.0.0.1:3002/api/health && echo "payment-api OK" || echo "payment-api FAIL"

echo "=== STEP 6: Verify Amoy tokens ==="
docker exec marketplace-payment-postgres psql -U postgres -d payment_db -t -c 'SELECT chain_id, count(*) as tokens FROM token_whitelist GROUP BY chain_id ORDER BY chain_id'

echo "=== STEP 7: Check payment-api has Amoy config ==="
docker exec marketplace-payment-api printenv | grep -E 'AMOY|DEFAULT_CHAIN|ESCROW_CONTRACT_POLYGON'

echo "=== DONE ==="
