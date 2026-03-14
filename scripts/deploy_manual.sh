#!/bin/bash
# Manual deploy script for kienai.id.vn
# Usage: bash /root/deploy_manual.sh [optional_tag]
TAG=${1:-latest}
NETWORK=docker_marketplace-network

echo "=== Pulling images (tag: $TAG) ==="
docker pull kiendzpro/marketplace-frontend:$TAG
docker pull kiendzpro/marketplace-main-api:$TAG

echo "=== Restarting main-api ==="
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
  -p 127.0.0.1:3001:3001 --restart unless-stopped \
  kiendzpro/marketplace-main-api:$TAG

echo "=== Restarting frontend ==="
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

echo "=== Status ==="
sleep 8
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep market
echo "=== Health checks ==="
sleep 5
curl -sf http://127.0.0.1:3001/api/health && echo " API OK" || echo " API FAIL"
curl -sf http://127.0.0.1:3000/ -o /dev/null && echo "Frontend OK" || echo "Frontend FAIL"
