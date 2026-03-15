#!/bin/bash
# ===========================================================
# Manual deploy script for kienai.id.vn
# VPS: 2 core / 2GB RAM — images built on GitHub Actions only
# Usage:
#   bash /root/deploy_manual.sh           # restart with current local images
#   bash /root/deploy_manual.sh pull      # pull latest then restart
# ===========================================================
set -e
TAG=latest
NETWORK=docker_marketplace-network
DO_PULL=${1:-""}

if [ "$DO_PULL" = "pull" ]; then
  echo "=== Pulling latest images ==="
  docker pull kiendzpro/marketplace-frontend:$TAG &
  docker pull kiendzpro/marketplace-main-api:$TAG &
  docker pull kiendzpro/marketplace-payment-api:$TAG &
  wait
  echo "=== Pull complete ==="
fi

echo "=== [1/3] Restarting main-api ==="
docker rm -f marketplace-main-api 2>/dev/null || true
docker run -d --name marketplace-main-api --network "$NETWORK" \
  -e NODE_ENV=production -e PORT=3001 \
  -e "DATABASE_URL=postgresql://postgres:%40Kien2909@marketplace-postgres:5432/marketplace_db" \
  -e "REDIS_URL=redis://:%40Kien2909@marketplace-redis:6379" \
  -e "RABBITMQ_URL=amqp://kaitojpla:%40Kien2909@marketplace-rabbitmq:5672" \
  -e JWT_SECRET=kien2909_jwt_secret_long_secure_key_xyz123 \
  -e JWT_REFRESH_SECRET=kien2909_refresh_secret_long_key_abc456 \
  -e JWT_EXPIRES_IN=24h \
  -e FRONTEND_URL=https://kienai.id.vn \
  -e SMTP_HOST=smtp.gmail.com -e SMTP_PORT=587 \
  -e SMTP_USER=kaitojpla@gmail.com \
  -e HCAPTCHA_SECRET=ES_9a13fd597b2c4cd5a3b0ded489fd5e17 \
  -e CLOUDINARY_CLOUD_NAME=deyjlti3v \
  -e CLOUDINARY_API_KEY=769799281583264 \
  -e CLOUDINARY_API_SECRET=FpgAWZCGduORuwPClfJXt5d6aas \
  -p 127.0.0.1:3001:3001 --restart unless-stopped \
  kiendzpro/marketplace-main-api:$TAG

echo "=== [2/3] Restarting payment-api ==="
docker rm -f marketplace-payment-api 2>/dev/null || true
docker run -d --name marketplace-payment-api --network "$NETWORK" \
  -e NODE_ENV=production -e PORT=3002 \
  -e "DATABASE_URL=postgresql://postgres:%40Kien2909@marketplace-payment-postgres:5432/payment_db" \
  -e "MAIN_DATABASE_URL=postgresql://postgres:%40Kien2909@marketplace-postgres:5432/marketplace_db" \
  -e "REDIS_URL=redis://:%40Kien2909@marketplace-redis:6379" \
  -e "RABBITMQ_URL=amqp://kaitojpla:%40Kien2909@marketplace-rabbitmq:5672" \
  -e JWT_SECRET=kien2909_jwt_secret_long_secure_key_xyz123 \
  -e PAYPAL_CLIENT_ID=AYxcD1jBUgx2LMY2eoXyM \
  -e "PAYPAL_SECRET=EPxefifbE6-6hPXAsqdY8jGlxcTpYRwuAjhT2aRPxWChSK0QOwIhijGbgwfRNhS2TEN2FSwSG-Mf4hhN" \
  -e PAYPAL_MODE=sandbox \
  -e ESCROW_CONTRACT_ADDRESS=0xCDE08Be0190482691b3288C27240378497d74E79 \
  -e ESCROW_CONTRACT_POLYGON_AMOY=0xCDE08Be0190482691b3288C27240378497d74E79 \
  -e POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology \
  -e POLYGON_RPC_URL=https://polygon.drpc.org \
  -e BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545 \
  -e ARB_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc \
  -e FRONTEND_URL=https://kienai.id.vn \
  -p 127.0.0.1:3002:3002 --restart unless-stopped \
  kiendzpro/marketplace-payment-api:$TAG

echo "=== [3/3] Restarting frontend ==="
docker rm -f marketplace-frontend 2>/dev/null || true
docker run -d --name marketplace-frontend --network "$NETWORK" \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_URL=https://kienai.id.vn \
  -e INTERNAL_API_URL=http://marketplace-main-api:3001 \
  -e NEXTAUTH_URL=https://kienai.id.vn \
  -e NEXTAUTH_SECRET=kien2909_nextauth_secret_min32chars_xyz789 \
  -e GOOGLE_CLIENT_ID=946575631331-1p51ll7tpqd0bo1impek2nggoqjrcoo8.apps.googleusercontent.com \
  -e GOOGLE_CLIENT_SECRET=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 \
  -e NEXT_PUBLIC_HCAPTCHA_SITEKEY=fd6eea20-ea7a-42f0-8eb4-878285a04eea \
  -e NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=cea17a07a0cb8c74b022c41e21294643 \
  -e "NEXT_PUBLIC_BINANCE_WS=wss://stream.binance.com:9443/ws" \
  -e NEXT_PUBLIC_POLYGON_RPC=https://polygon.drpc.org \
  -p 127.0.0.1:3000:3000 --restart unless-stopped \
  kiendzpro/marketplace-frontend:$TAG

echo "=== Waiting for services to initialize (10s) ==="
sleep 10

echo "=== Container Status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep market

echo "=== Health Checks ==="
curl -sf http://127.0.0.1:3000/ -o /dev/null     && echo "✓ Frontend   OK (port 3000)" || echo "✗ Frontend   FAIL"
curl -sf "http://127.0.0.1:3001/api/products?limit=1" -o /dev/null && echo "✓ Main-API   OK (port 3001)" || echo "✗ Main-API   FAIL"
curl -sf http://127.0.0.1:3002/api/health -o /dev/null && echo "✓ Payment-API OK (port 3002)" || echo "  Payment-API still starting..."

echo "=== CPU/Memory ==="
uptime
free -h | grep Mem
