#!/bin/bash
# ===========================================================
# Manual deploy — LEGACY script (prefer docker compose now)
# Reads ALL secrets from /root/services/FinalYear/docker/.env
# Usage:
#   bash scripts/deploy_manual.sh           # restart with current images
#   bash scripts/deploy_manual.sh pull      # pull latest then restart
# ===========================================================
set -e

TAG=latest
COMPOSE_DIR="/root/services/FinalYear/docker"
ENV_FILE="$COMPOSE_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Create it from setup_vps.py template first."
  exit 1
fi

# Load env vars from .env file
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

NETWORK="${DOCKER_NETWORK:-docker_marketplace-network}"
DO_PULL=${1:-""}

if [ "$DO_PULL" = "pull" ]; then
  echo "=== Pulling latest images ==="
  docker pull kaitojpla/marketplace-frontend:$TAG &
  docker pull kaitojpla/marketplace-main-api:$TAG &
  docker pull kaitojpla/marketplace-payment-api:$TAG &
  wait
  echo "=== Pull complete ==="
fi

# Validate required secrets
for VAR in POSTGRES_PASSWORD REDIS_PASSWORD JWT_SECRET JWT_REFRESH_SECRET NEXTAUTH_SECRET; do
  if [ -z "${!VAR}" ]; then
    echo "ERROR: $VAR is not set in $ENV_FILE"
    exit 1
  fi
done

echo "=== [1/3] Restarting main-api ==="
docker rm -f marketplace-main-api 2>/dev/null || true
docker run -d --name marketplace-main-api --network "$NETWORK" \
  -e NODE_ENV=production -e PORT=3001 \
  -e "DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@marketplace-postgres:5432/${POSTGRES_DB:-marketplace_db}" \
  -e "REDIS_URL=redis://:${REDIS_PASSWORD}@marketplace-redis:6379" \
  -e "RABBITMQ_URL=amqp://${RABBITMQ_USER:-kaitojpla}:${RABBITMQ_PASSWORD}@marketplace-rabbitmq:5672" \
  -e JWT_SECRET="${JWT_SECRET}" \
  -e JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}" \
  -e JWT_EXPIRES_IN=24h \
  -e FRONTEND_URL=https://kienai.id.vn \
  -e SMTP_HOST=smtp.gmail.com -e SMTP_PORT=587 \
  -e SMTP_USER="${SMTP_USER}" \
  -e SMTP_PASSWORD="${SMTP_PASSWORD}" \
  -e HCAPTCHA_SECRET="${HCAPTCHA_SECRET}" \
  -e CLOUDINARY_CLOUD_NAME="${CLOUDINARY_CLOUD_NAME}" \
  -e CLOUDINARY_API_KEY="${CLOUDINARY_API_KEY}" \
  -e CLOUDINARY_API_SECRET="${CLOUDINARY_API_SECRET}" \
  -e INTERNAL_SERVICE_KEY="${INTERNAL_SERVICE_KEY}" \
  -e PAYMENT_SERVICE_URL="http://marketplace-payment-api:3002" \
  -p 127.0.0.1:3001:3001 --restart unless-stopped \
  kaitojpla/marketplace-main-api:$TAG

echo "=== [2/3] Restarting payment-api ==="
docker rm -f marketplace-payment-api 2>/dev/null || true
docker run -d --name marketplace-payment-api --network "$NETWORK" \
  -e NODE_ENV=production -e PORT=3002 \
  -e "DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@marketplace-payment-postgres:5432/payment_db" \
  -e "MAIN_DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@marketplace-postgres:5432/${POSTGRES_DB:-marketplace_db}" \
  -e "REDIS_URL=redis://:${REDIS_PASSWORD}@marketplace-redis:6379" \
  -e "RABBITMQ_URL=amqp://${RABBITMQ_USER:-kaitojpla}:${RABBITMQ_PASSWORD}@marketplace-rabbitmq:5672" \
  -e JWT_SECRET="${JWT_SECRET}" \
  -e PAYPAL_CLIENT_ID="${PAYPAL_CLIENT_ID}" \
  -e PAYPAL_SECRET="${PAYPAL_SECRET}" \
  -e PAYPAL_MODE="${PAYPAL_MODE:-sandbox}" \
  -e INTERNAL_SERVICE_KEY="${INTERNAL_SERVICE_KEY}" \
  -e ESCROW_CONTRACT_LOCALHOST="${ESCROW_CONTRACT_LOCALHOST:-0x5FbDB2315678afecb367f032d93F642f64180aa3}" \
  -e ESCROW_CONTRACT_POLYGON_AMOY="${ESCROW_CONTRACT_POLYGON_AMOY:-0xCDE08Be0190482691b3288C27240378497d74E79}" \
  -e POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology \
  -e POLYGON_RPC_URL=https://polygon.drpc.org \
  -e BLOCKCHAIN_PRIVATE_KEY="${BLOCKCHAIN_PRIVATE_KEY}" \
  -e FRONTEND_URL=https://kienai.id.vn \
  -p 127.0.0.1:3002:3002 --restart unless-stopped \
  kaitojpla/marketplace-payment-api:$TAG

echo "=== [3/3] Restarting frontend ==="
docker rm -f marketplace-frontend 2>/dev/null || true
docker run -d --name marketplace-frontend --network "$NETWORK" \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_URL=https://kienai.id.vn \
  -e INTERNAL_API_URL=http://marketplace-main-api:3001 \
  -e NEXTAUTH_URL=https://kienai.id.vn \
  -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  -e FACEBOOK_CLIENT_ID="${FACEBOOK_CLIENT_ID}" \
  -e FACEBOOK_CLIENT_SECRET="${FACEBOOK_CLIENT_SECRET}" \
  -e NEXT_PUBLIC_HCAPTCHA_SITEKEY=fd6eea20-ea7a-42f0-8eb4-878285a04eea \
  -e NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=cea17a07a0cb8c74b022c41e21294643 \
  -e "NEXT_PUBLIC_BINANCE_WS=wss://stream.binance.com:9443/ws" \
  -e NEXT_PUBLIC_POLYGON_RPC=https://polygon.drpc.org \
  -e NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:-${CLOUDINARY_CLOUD_NAME}}" \
  -p 127.0.0.1:3000:3000 --restart unless-stopped \
  kaitojpla/marketplace-frontend:$TAG

echo "=== Waiting 10s for init ==="
sleep 10

echo "=== Container Status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep market

echo "=== Health Checks ==="
curl -sf http://127.0.0.1:3000/ -o /dev/null     && echo "✓ Frontend   OK" || echo "✗ Frontend   FAIL"
curl -sf http://127.0.0.1:3001/health -o /dev/null && echo "✓ Main-API   OK" || echo "✗ Main-API   FAIL"
curl -sf http://127.0.0.1:3002/health -o /dev/null && echo "✓ Payment-API OK" || echo "✗ Payment-API FAIL"
