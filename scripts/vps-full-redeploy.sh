#!/bin/bash
# ============================================================
# Full clean redeploy — stops ALL containers, removes them,
# then starts fresh with docker compose prod
# ============================================================
set -e

COMPOSE_DIR=/root/services/FinalYear/docker
PROJ=FinalYear

echo "================================================================"
echo "  FULL CLEAN REDEPLOY — $(date)"
echo "================================================================"

echo ""
echo "[0] Current container list BEFORE cleanup:"
docker ps -a --format 'NAME:{{.Names}} STATUS:{{.Status}}' 2>&1

echo ""
echo "[1] Stop ALL running containers..."
docker stop $(docker ps -q) 2>/dev/null && echo "All stopped" || echo "Nothing to stop"

echo ""
echo "[2] Remove ALL containers (to avoid name conflicts)..."
docker rm -f $(docker ps -aq) 2>/dev/null && echo "All removed" || echo "Nothing to remove"

echo ""
echo "[3] Current images:"
docker images --format 'REPO:{{.Repository}} TAG:{{.Tag}} SIZE:{{.Size}}' 2>&1

echo ""
echo "[4] Pull LATEST images from Docker Hub..."
docker pull kiendzpro/marketplace-main-api:latest 2>&1 | tail -3
docker pull kiendzpro/marketplace-payment-api:latest 2>&1 | tail -3
docker pull kiendzpro/marketplace-frontend:latest 2>&1 | tail -3
docker pull kiendzpro/marketplace-ai-service:latest 2>&1 | tail -3
echo "All images pulled."

echo ""
echo "[5] Starting stack with docker compose prod..."
cd $COMPOSE_DIR

if [ ! -f ".env" ]; then
  echo "ERROR: .env not found in $COMPOSE_DIR!"
  exit 1
fi

echo "Using .env:"
cat .env | grep -v KEY | grep -v SECRET | grep -v PASS | grep -v PRIVATE 2>&1

docker compose -f docker-compose.prod.yml --env-file .env up -d 2>&1
echo "Docker compose up done."

echo ""
echo "[6] Waiting 45s for DB + services to initialize..."
sleep 45

echo ""
echo "[7] FINAL container status:"
docker ps -a --format 'NAME:{{.Names}} STATUS:{{.Status}} IMG:{{.Image}}' 2>&1

echo ""
echo "[8] Health checks:"
curl -sf http://127.0.0.1:3000 -o /dev/null && echo "OK: Frontend port 3000" || echo "FAIL: Frontend port 3000"
curl -sf http://127.0.0.1:3001/api/health -o /dev/null && echo "OK: Main-API port 3001" || echo "FAIL: Main-API port 3001"
curl -sf http://127.0.0.1:3002/api/health -o /dev/null && echo "OK: Payment-API port 3002" || echo "FAIL: Payment-API port 3002"

echo ""
echo "[9] main-api logs (last 30 lines):"
docker logs marketplace-main-api --tail 30 2>&1

echo ""
echo "[10] payment-api logs (last 20 lines):"
docker logs marketplace-payment-api --tail 20 2>&1

echo ""
echo "[11] frontend logs (last 10 lines):"
docker logs marketplace-frontend --tail 10 2>&1

echo ""
echo "[12] System resources:"
df -h / 2>&1
free -h 2>&1

echo ""
echo "================================================================"
echo "  DONE — $(date)"
echo "================================================================"
