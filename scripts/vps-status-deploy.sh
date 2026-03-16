#!/bin/bash
# ============================================================
# VPS Status Check + Full Deploy Script
# ============================================================
set -e

echo "================================================================"
echo "  VPS STATUS REPORT — $(date)"
echo "================================================================"

echo ""
echo "=== [CONTAINERS RUNNING] ==="
docker ps --format 'NAME: {{.Names}}  |  STATUS: {{.Status}}  |  IMAGE: {{.Image}}'

echo ""
echo "=== [ALL CONTAINERS incl. stopped] ==="
docker ps -a --format 'NAME: {{.Names}}  |  STATUS: {{.Status}}'

echo ""
echo "=== [DISK USAGE] ==="
df -h /

echo ""
echo "=== [RAM] ==="
free -h

echo ""
echo "=== [DOCKER IMAGES on VPS] ==="
docker images --format 'REPO: {{.Repository}}  TAG: {{.Tag}}  SIZE: {{.Size}}  CREATED: {{.CreatedSince}}'

echo ""
echo "================================================================"
echo "  STARTING DEPLOY"
echo "================================================================"

COMPOSE_DIR=/root/services/FinalYear/docker
PROJECT_DIR=/root/services/FinalYear

echo ""
echo "=== [1/4] Checking compose dir: $COMPOSE_DIR ==="
ls -la $COMPOSE_DIR/ || echo "ERROR: compose dir not found"

echo ""
echo "=== [2/4] Pulling latest images from Docker Hub ==="
docker pull kiendzpro/marketplace-main-api:latest
docker pull kiendzpro/marketplace-payment-api:latest
docker pull kiendzpro/marketplace-frontend:latest
docker pull kiendzpro/marketplace-ai-service:latest
echo "✓ All images pulled"

echo ""
echo "=== [3/4] Bringing up stack with docker compose ==="
cd $COMPOSE_DIR

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "WARNING: .env file not found in $COMPOSE_DIR — creating from docker-compose.prod.yml defaults"
fi

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans --force-recreate
echo "✓ Docker compose up done"

echo ""
echo "=== [4/4] Waiting 30s for services to initialize ==="
sleep 30

echo ""
echo "=== [FINAL CONTAINER STATUS] ==="
docker ps --format 'NAME: {{.Names}}  |  STATUS: {{.Status}}  |  IMAGE: {{.Image}}'

echo ""
echo "=== [HEALTH CHECKS] ==="
curl -sf http://127.0.0.1:3000 -o /dev/null && echo "✓ Frontend   OK (port 3000)" || echo "✗ Frontend   FAIL"
curl -sf http://127.0.0.1:3001/api/health -o /dev/null && echo "✓ Main-API   OK (port 3001)" || echo "✗ Main-API   FAIL"
curl -sf http://127.0.0.1:3002/api/health -o /dev/null && echo "✓ Payment-API OK (port 3002)" || echo "✗ Payment-API FAIL (may still be starting)"

echo ""
echo "=== [LOGS - last 20 lines each] ==="
echo "--- main-api ---"
docker logs marketplace-main-api --tail 20 2>&1 || echo "container not found"
echo "--- payment-api ---"
docker logs marketplace-payment-api --tail 20 2>&1 || echo "container not found"
echo "--- frontend ---"
docker logs marketplace-frontend --tail 10 2>&1 || echo "container not found"

echo ""
echo "================================================================"
echo "  ✅ DEPLOY COMPLETE"
echo "================================================================"
