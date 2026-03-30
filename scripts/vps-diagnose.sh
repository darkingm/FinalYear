#!/bin/bash
# Test proxy endpoints and check frontend health
echo "=== Container Status ==="
docker ps --format '{{.Names}}  {{.Status}}'

echo ""
echo "=== Frontend health ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:3000
echo ""

echo ""
echo "=== Main API health ==="
curl -s http://127.0.0.1:3001/health
echo ""

echo ""
echo "=== Payment API health ==="
curl -s http://127.0.0.1:3002/health
echo ""

echo ""
echo "=== Test /api/proxy/subgraph (POST) ==="
curl -s -X POST http://127.0.0.1:3000/api/proxy/subgraph \
  -H "Content-Type: application/json" \
  -d '{"chain":"BSC","query":"{pairs(first:1){id token0{symbol} token1{symbol}}}"}' \
  | head -c 500
echo ""

echo ""
echo "=== Test /api/proxy/rpc (POST) ==="
curl -s -X POST http://127.0.0.1:3000/api/proxy/rpc \
  -H "Content-Type: application/json" \
  -d '{"chain":"BSC","method":"eth_blockNumber","params":[]}' \
  | head -c 500
echo ""

echo ""
echo "=== Test /api/proxy/etherscan (GET) ==="
curl -s "http://127.0.0.1:3000/api/proxy/etherscan?chainid=56&module=account&action=balance&address=0x0000000000000000000000000000000000000000" \
  | head -c 500
echo ""

echo ""
echo "=== Frontend logs (last 30 lines) ==="
docker logs marketplace-frontend --tail 30 2>&1

echo ""
echo "=== Main API logs (last 20 lines) ==="
docker logs marketplace-main-api --tail 20 2>&1
