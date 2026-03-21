#!/bin/bash
# ============================================================
# deploy.sh — Build + Push + Deploy to VPS
#
# CHẠY TRÊN LOCAL (Windows Git Bash / WSL hoặc Mac/Linux):
#   bash scripts/deploy.sh
#
# CHỨC NĂNG:
#   1. Build Docker images (main-api, payment-api, frontend, db-migrator)
#   2. Push lên Docker Hub
#   3. SSH vào VPS, pull images mới + restart stack
#   4. db-migrator tự động chạy migrations mới trên VPS
#
# YÊU CẦU:
#   - Docker Desktop đang chạy
#   - Đã login: docker login
#   - SSH key đã được add vào VPS: ssh-copy-id root@103.20.96.79
# ============================================================
set -e

# ── Config ───────────────────────────────────────────────────
VPS_HOST="103.20.96.79"
VPS_USER="root"
VPS_PROJECT_DIR="/root/services/FinalYear"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-kiendzpro}"
COMPOSE_FILE="docker/docker-compose.prod.yml"

# Colors
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${CYAN}[→]${NC} $*"; }
step() { echo ""; echo -e "${BOLD}${CYAN}━━━ $* ━━━${NC}"; }

echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════════╗"
echo "  ║     Web3Market — Full Deploy Pipeline         ║"
echo "  ║     $(date '+%Y-%m-%d %H:%M:%S')                    ║"
echo "  ╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Check we're in project root ──────────────────────────────
if [ ! -f "docker/docker-compose.prod.yml" ]; then
  echo "ERROR: Run this script from the project root directory"
  echo "  cd /path/to/FinalYear && bash scripts/deploy.sh"
  exit 1
fi

# ── Which services to build? (default: all) ─────────────────
BUILD_ALL="${BUILD_ALL:-true}"
BUILD_MIGRATOR="${BUILD_MIGRATOR:-true}"

# ── Step 1: Build images ─────────────────────────────────────
step "1/4 Building Docker images"

if [ "$BUILD_ALL" = "true" ]; then
  info "Building main-api..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-main-api:latest \
    -f backend/main-service/Dockerfile backend/main-service

  info "Building payment-api..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-payment-api:latest \
    -f backend/payment-service/Dockerfile backend/payment-service

  info "Building frontend..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-frontend:latest \
    -f frontend/Dockerfile frontend

  info "Building ai-service..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-ai-service:latest \
    -f backend/ai-service/Dockerfile backend/ai-service

  info "Building tokenization-service..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-tokenization:latest \
    -f backend/tokenization-service/Dockerfile backend/tokenization-service
fi

if [ "$BUILD_MIGRATOR" = "true" ]; then
  info "Building db-migrator..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-db-migrator:latest \
    -f init_database.sql/Dockerfile.migrator \
    init_database.sql
  log "db-migrator built ✓"
fi

log "All images built."

# ── Step 2: Push to Docker Hub ───────────────────────────────
step "2/4 Pushing images to Docker Hub"

if [ "$BUILD_ALL" = "true" ]; then
  docker push ${DOCKERHUB_USERNAME}/marketplace-main-api:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-payment-api:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-frontend:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-ai-service:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-tokenization:latest
fi

if [ "$BUILD_MIGRATOR" = "true" ]; then
  docker push ${DOCKERHUB_USERNAME}/marketplace-db-migrator:latest
fi

log "All images pushed to Docker Hub."

# ── Step 3: Deploy on VPS ────────────────────────────────────
step "3/4 Deploying on VPS ${VPS_HOST}"

ssh ${VPS_USER}@${VPS_HOST} << ENDSSH
  set -e
  echo "=== VPS: Pulling latest images ==="
  cd ${VPS_PROJECT_DIR}

  docker pull ${DOCKERHUB_USERNAME}/marketplace-db-migrator:latest
  docker pull ${DOCKERHUB_USERNAME}/marketplace-main-api:latest
  docker pull ${DOCKERHUB_USERNAME}/marketplace-payment-api:latest
  docker pull ${DOCKERHUB_USERNAME}/marketplace-frontend:latest
  docker pull ${DOCKERHUB_USERNAME}/marketplace-ai-service:latest
  docker pull ${DOCKERHUB_USERNAME}/marketplace-tokenization:latest

  echo ""
  echo "=== VPS: Restarting stack with migrations ==="
  cd docker

  # Remove old migrator container so it re-runs
  docker rm -f marketplace-db-migrator 2>/dev/null || true

  # Start/restart all services
  # db-migrator sẽ chạy trước main-api và payment-api (do depends_on)
  docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans

  echo ""
  echo "=== VPS: Waiting for db-migrator to finish (max 60s) ==="
  WAITED=0
  while docker ps --filter "name=marketplace-db-migrator" --filter "status=running" | grep -q "db-migrator"; do
    echo -n "."
    sleep 2
    WAITED=$((WAITED + 2))
    if [ \$WAITED -ge 60 ]; then
      echo ""
      echo "WARNING: db-migrator taking longer than expected"
      break
    fi
  done
  echo ""

  echo "=== VPS: Migration logs ==="
  docker logs marketplace-db-migrator 2>&1 | tail -30 || true

  echo ""
  echo "=== VPS: Service status ==="
  docker ps --format 'NAME:{{.Names}}  STATUS:{{.Status}}' | grep marketplace

  echo ""
  echo "=== VPS: Health checks ==="
  curl -sf http://127.0.0.1:3001/api/health > /dev/null && echo "OK: main-api :3001" || echo "FAIL: main-api :3001"
  curl -sf http://127.0.0.1:3002/api/health > /dev/null && echo "OK: payment-api :3002" || echo "FAIL: payment-api :3002"
  curl -sf http://127.0.0.1:3000 > /dev/null && echo "OK: frontend :3000" || echo "FAIL: frontend :3000"

  echo ""
  echo "Deploy complete on VPS!"
ENDSSH

log "VPS deployment done."

# ── Step 4: Summary ──────────────────────────────────────────
step "4/4 Deploy Summary"
echo ""
echo "  ✅ Images built & pushed to Docker Hub"
echo "  ✅ VPS pulled latest images"
echo "  ✅ db-migrator applied pending DB migrations"
echo "  ✅ Services restarted with updated code + schema"
echo ""
echo "  🌐 Site: https://kienai.id.vn"
echo ""
echo "  📋 To check migration history on VPS:"
echo "     ssh root@${VPS_HOST}"
echo "     docker exec marketplace-postgres psql -U postgres -d marketplace_db \\"
echo "       -c 'SELECT * FROM schema_migrations ORDER BY version;'"
echo ""
