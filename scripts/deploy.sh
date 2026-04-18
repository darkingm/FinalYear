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
TAG_ENV_FILE=".image-tags.env"

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

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: This directory is not a git repository"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is dirty."
  echo "Commit or stash changes before running deploy.sh so the deployed image really matches a git SHA."
  exit 1
fi

DEPLOY_TAG="${DEPLOY_TAG:-$(git rev-parse HEAD)}"
SHORT_DEPLOY_TAG="$(git rev-parse --short "${DEPLOY_TAG}")"

# ── Which services to build? (default: all) ─────────────────
BUILD_ALL="${BUILD_ALL:-true}"
BUILD_MIGRATOR="${BUILD_MIGRATOR:-true}"

# ── Step 1: Build images ─────────────────────────────────────
step "1/4 Building Docker images"

if [ "$BUILD_ALL" = "true" ]; then
  info "Building main-api..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-main-api:latest \
    -t ${DOCKERHUB_USERNAME}/marketplace-main-api:${DEPLOY_TAG} \
    -f backend/main-service/Dockerfile backend/main-service

  info "Building payment-api..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-payment-api:latest \
    -t ${DOCKERHUB_USERNAME}/marketplace-payment-api:${DEPLOY_TAG} \
    -f backend/payment-service/Dockerfile backend/payment-service

  info "Building frontend..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-frontend:latest \
    -t ${DOCKERHUB_USERNAME}/marketplace-frontend:${DEPLOY_TAG} \
    -f frontend/Dockerfile frontend

  info "Building ai-service..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-ai-service:latest \
    -t ${DOCKERHUB_USERNAME}/marketplace-ai-service:${DEPLOY_TAG} \
    -f backend/ai-service/Dockerfile backend/ai-service

  info "Building tokenization-service..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-tokenization:latest \
    -t ${DOCKERHUB_USERNAME}/marketplace-tokenization:${DEPLOY_TAG} \
    -f backend/tokenization-service/Dockerfile backend/tokenization-service
fi

if [ "$BUILD_MIGRATOR" = "true" ]; then
  info "Building db-migrator..."
  docker build -t ${DOCKERHUB_USERNAME}/marketplace-db-migrator:latest \
    -t ${DOCKERHUB_USERNAME}/marketplace-db-migrator:${DEPLOY_TAG} \
    -f init_database.sql/Dockerfile.migrator \
    init_database.sql
  log "db-migrator built ✓"
fi

log "All images built."

# ── Step 2: Push to Docker Hub ───────────────────────────────
step "2/4 Pushing images to Docker Hub"

if [ "$BUILD_ALL" = "true" ]; then
  docker push ${DOCKERHUB_USERNAME}/marketplace-main-api:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-main-api:${DEPLOY_TAG}
  docker push ${DOCKERHUB_USERNAME}/marketplace-payment-api:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-payment-api:${DEPLOY_TAG}
  docker push ${DOCKERHUB_USERNAME}/marketplace-frontend:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-frontend:${DEPLOY_TAG}
  docker push ${DOCKERHUB_USERNAME}/marketplace-ai-service:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-ai-service:${DEPLOY_TAG}
  docker push ${DOCKERHUB_USERNAME}/marketplace-tokenization:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-tokenization:${DEPLOY_TAG}
fi

if [ "$BUILD_MIGRATOR" = "true" ]; then
  docker push ${DOCKERHUB_USERNAME}/marketplace-db-migrator:latest
  docker push ${DOCKERHUB_USERNAME}/marketplace-db-migrator:${DEPLOY_TAG}
fi

log "All images pushed to Docker Hub."

# ── Step 3: Deploy on VPS ────────────────────────────────────
step "3/4 Deploying on VPS ${VPS_HOST}"

ssh ${VPS_USER}@${VPS_HOST} << ENDSSH
  set -e
  echo "=== VPS: Pulling pinned images for commit ${SHORT_DEPLOY_TAG} ==="
  cd ${VPS_PROJECT_DIR}

  cd docker
  touch ${TAG_ENV_FILE}

  set_tag() {
    local key="\$1"
    local value="\$2"
    if grep -q "^\${key}=" ${TAG_ENV_FILE} 2>/dev/null; then
      sed -i "s/^\${key}=.*/\${key}=\${value}/" ${TAG_ENV_FILE}
    else
      echo "\${key}=\${value}" >> ${TAG_ENV_FILE}
    fi
  }

  load_image_tags() {
    set -a
    [ -f ${TAG_ENV_FILE} ] && . ./${TAG_ENV_FILE}
    set +a
  }

  if [ "${BUILD_ALL}" = "true" ]; then
    docker pull ${DOCKERHUB_USERNAME}/marketplace-main-api:${DEPLOY_TAG}
    docker pull ${DOCKERHUB_USERNAME}/marketplace-payment-api:${DEPLOY_TAG}
    docker pull ${DOCKERHUB_USERNAME}/marketplace-frontend:${DEPLOY_TAG}
    docker pull ${DOCKERHUB_USERNAME}/marketplace-ai-service:${DEPLOY_TAG}
    docker pull ${DOCKERHUB_USERNAME}/marketplace-tokenization:${DEPLOY_TAG}

    set_tag MAIN_API_IMAGE_TAG ${DEPLOY_TAG}
    set_tag PAYMENT_API_IMAGE_TAG ${DEPLOY_TAG}
    set_tag FRONTEND_IMAGE_TAG ${DEPLOY_TAG}
    set_tag AI_SERVICE_IMAGE_TAG ${DEPLOY_TAG}
    set_tag TOKENIZATION_IMAGE_TAG ${DEPLOY_TAG}
  fi

  if [ "${BUILD_MIGRATOR}" = "true" ]; then
    docker pull ${DOCKERHUB_USERNAME}/marketplace-db-migrator:${DEPLOY_TAG}
    set_tag DB_MIGRATOR_IMAGE_TAG ${DEPLOY_TAG}
  fi

  load_image_tags

  echo ""
  echo "=== VPS: Restarting stack with pinned tags ==="

  if [ "${BUILD_MIGRATOR}" = "true" ]; then
    docker rm -f marketplace-db-migrator 2>/dev/null || true
  fi

  if [ "${BUILD_ALL}" = "true" ]; then
    docker compose -f docker-compose.prod.yml --env-file .env up -d --remove-orphans
  elif [ "${BUILD_MIGRATOR}" = "true" ]; then
    docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps db-migrator
  fi

  echo ""
  echo "=== VPS: Waiting for db-migrator to finish (max 60s) ==="
  WAITED=0
  while [ "${BUILD_MIGRATOR}" = "true" ] && docker ps --filter "name=marketplace-db-migrator" --filter "status=running" | grep -q "db-migrator"; do
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

  if [ "${BUILD_MIGRATOR}" = "true" ]; then
    echo "=== VPS: Migration logs ==="
    docker logs marketplace-db-migrator 2>&1 | tail -30 || true
  fi

  echo ""
  echo "=== VPS: Service status ==="
  docker ps --format 'NAME:{{.Names}}  STATUS:{{.Status}}' | grep marketplace

  echo ""
  echo "=== VPS: Active pinned tags ==="
  cat ${TAG_ENV_FILE}

  echo ""
  echo "=== VPS: Health checks ==="
  curl -sf http://127.0.0.1:3001/health > /dev/null && echo "OK: main-api :3001" || echo "FAIL: main-api :3001"
  curl -sf http://127.0.0.1:3002/health > /dev/null && echo "OK: payment-api :3002" || echo "FAIL: payment-api :3002"
  curl -sf http://127.0.0.1:3000 > /dev/null && echo "OK: frontend :3000" || echo "FAIL: frontend :3000"

  echo ""
  echo "Deploy complete on VPS!"
ENDSSH

log "VPS deployment done."

# ── Step 4: Summary ──────────────────────────────────────────
step "4/4 Deploy Summary"
echo ""
echo "  ✅ Images built & pushed to Docker Hub"
echo "  ✅ VPS pulled pinned images for commit ${SHORT_DEPLOY_TAG}"
echo "  ✅ Active image tags stored in docker/${TAG_ENV_FILE}"
echo "  ✅ Services restarted with updated code + schema"
echo ""
echo "  🌐 Site: https://kienai.id.vn"
echo ""
echo "  📋 To check migration history on VPS:"
echo "     ssh root@${VPS_HOST}"
echo "     docker exec marketplace-postgres psql -U postgres -d marketplace_db \\"
echo "       -c 'SELECT * FROM schema_migrations ORDER BY version;'"
echo ""
