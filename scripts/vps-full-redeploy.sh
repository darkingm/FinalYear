#!/bin/bash
# ============================================================
# Full clean redeploy — stops ALL containers, removes them,
# then starts fresh with docker compose prod
# ============================================================
set -e

COMPOSE_DIR=/root/services/FinalYear/docker
ENV_FILE="$COMPOSE_DIR/.env"
TAG_ENV_FILE="$COMPOSE_DIR/.image-tags.env"
PROJ=FinalYear
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-kaitojpla}"

if [ -f "$ENV_FILE" ]; then
  DOCKERHUB_USERNAME="$(grep '^DOCKERHUB_USERNAME=' "$ENV_FILE" | head -n1 | cut -d= -f2- || true)"
  DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-kaitojpla}"
fi

resolve_tag() {
  local key="$1"
  local fallback="${DEPLOY_TAG:-latest}"
  local found=""
  if [ -f "$TAG_ENV_FILE" ]; then
    found="$(grep "^${key}=" "$TAG_ENV_FILE" | head -n1 | cut -d= -f2- || true)"
  fi
  echo "${found:-$fallback}"
}

MAIN_API_TAG="$(resolve_tag MAIN_API_IMAGE_TAG)"
PAYMENT_API_TAG="$(resolve_tag PAYMENT_API_IMAGE_TAG)"
FRONTEND_TAG="$(resolve_tag FRONTEND_IMAGE_TAG)"
AI_SERVICE_TAG="$(resolve_tag AI_SERVICE_IMAGE_TAG)"
TOKENIZATION_TAG="$(resolve_tag TOKENIZATION_IMAGE_TAG)"
DB_MIGRATOR_TAG="$(resolve_tag DB_MIGRATOR_IMAGE_TAG)"

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
echo "[4] Pull pinned images from Docker Hub..."
docker pull ${DOCKERHUB_USERNAME}/marketplace-main-api:${MAIN_API_TAG} 2>&1 | tail -3
docker pull ${DOCKERHUB_USERNAME}/marketplace-payment-api:${PAYMENT_API_TAG} 2>&1 | tail -3
docker pull ${DOCKERHUB_USERNAME}/marketplace-frontend:${FRONTEND_TAG} 2>&1 | tail -3
docker pull ${DOCKERHUB_USERNAME}/marketplace-ai-service:${AI_SERVICE_TAG} 2>&1 | tail -3
docker pull ${DOCKERHUB_USERNAME}/marketplace-tokenization:${TOKENIZATION_TAG} 2>&1 | tail -3
docker pull ${DOCKERHUB_USERNAME}/marketplace-db-migrator:${DB_MIGRATOR_TAG} 2>&1 | tail -3
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

set -a
[ -f "$TAG_ENV_FILE" ] && . "$TAG_ENV_FILE"
set +a

docker compose -f docker-compose.prod.yml --env-file .env up -d 2>&1
echo "Docker compose up done."

echo ""
echo "[6] Waiting 45s for DB + services to initialize..."
sleep 45

echo ""
echo "[7] FINAL container status:"
docker ps -a --format 'NAME:{{.Names}} STATUS:{{.Status}} IMG:{{.Image}}' 2>&1

echo ""
echo "[7.1] Active pinned tags:"
[ -f "$TAG_ENV_FILE" ] && cat "$TAG_ENV_FILE" || echo "No $TAG_ENV_FILE file found"

echo ""
echo "[8] Health checks:"
curl -sf http://127.0.0.1:3000 -o /dev/null && echo "OK: Frontend port 3000" || echo "FAIL: Frontend port 3000"
curl -sf http://127.0.0.1:3001/health -o /dev/null && echo "OK: Main-API port 3001" || echo "FAIL: Main-API port 3001"
curl -sf http://127.0.0.1:3002/health -o /dev/null && echo "OK: Payment-API port 3002" || echo "FAIL: Payment-API port 3002"

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
