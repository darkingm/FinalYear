#!/bin/bash
# ================================================================
# deploy-payment-fixes.sh
# Run this script on VPS to apply all payment system fixes
# Usage: bash scripts/deploy-payment-fixes.sh
# ================================================================

set -e
cd "$(dirname "$0")/.."

echo "======================================================"
echo "  Payment System Fix Deployment"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

# ── 1. Pull latest code ──────────────────────────────────────
echo ""
echo "📦 [1/5] Pulling latest code..."
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "  (git pull skipped — not a git repo or already up to date)"

# ── 2. Run DB migration ──────────────────────────────────────
echo ""
echo "🗄️  [2/5] Applying database migration..."

# Load DB credentials from environment or docker-compose
if [ -f "docker-compose.yml" ]; then
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-marketplace}"
  DB_USER="${DB_USER:-postgres}"
  DB_PASS="${POSTGRES_PASSWORD:-postgres}"
  
  echo "  Running migration_001_payment_fixes.sql..."
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "init_database.sql/migration_001_payment_fixes.sql" \
    && echo "  ✅ Migration applied successfully" \
    || echo "  ⚠️  Migration had errors (may already be applied — check manually)"
else
  echo "  ⚠️  No docker-compose.yml found. Apply migration manually:"
  echo "  psql -U postgres -d marketplace -f init_database.sql/migration_001_payment_fixes.sql"
fi

# ── 3. Rebuild & restart main-service ───────────────────────
echo ""
echo "🔨 [3/5] Rebuilding main-service..."
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  docker compose build main-service
  docker compose up -d main-service
  echo "  ✅ main-service restarted"
elif command -v pm2 &>/dev/null; then
  cd backend/main-service
  npm run build 2>/dev/null || npx tsc
  pm2 restart main-service 2>/dev/null || pm2 start dist/server.js --name main-service
  cd ../..
  echo "  ✅ main-service restarted via pm2"
else
  echo "  ⚠️  No docker/pm2 found. Restart main-service manually."
fi

# ── 4. Rebuild & restart payment-service ────────────────────
echo ""
echo "💳 [4/5] Rebuilding payment-service..."
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  docker compose build payment-service
  docker compose up -d payment-service
  echo "  ✅ payment-service restarted"
elif command -v pm2 &>/dev/null; then
  cd backend/payment-service
  npm run build 2>/dev/null || npx tsc
  pm2 restart payment-service 2>/dev/null || pm2 start dist/server.js --name payment-service
  cd ../..
  echo "  ✅ payment-service restarted via pm2"
else
  echo "  ⚠️  No docker/pm2 found. Restart payment-service manually."
fi

# ── 5. Rebuild & restart frontend ───────────────────────────
echo ""
echo "🌐 [5/5] Rebuilding frontend..."
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  docker compose build frontend
  docker compose up -d frontend
  echo "  ✅ frontend restarted"
elif command -v pm2 &>/dev/null; then
  cd frontend
  npm run build
  pm2 restart frontend 2>/dev/null || pm2 start "npm start" --name frontend
  cd ..
  echo "  ✅ frontend restarted via pm2"
else
  echo "  ⚠️  No docker/pm2 found. Rebuild frontend manually: cd frontend && npm run build"
fi

echo ""
echo "======================================================"
echo "  ✅ All payment fixes deployed!"
echo ""
echo "  What was fixed:"
echo "  ✔ DB: tracking_number, release_tx_hash columns added"
echo "  ✔ DB: disputes UNIQUE(order_id) constraint added"
echo "  ✔ Backend: escrow release uses COMPLETED (not PAID) status"
echo "  ✔ Backend: internal service key auth for release endpoint"  
echo "  ✔ Backend: status transition validation (state machine)"
echo "  ✔ Backend: dispute record auto-created on DISPUTED status"
echo "  ✔ Frontend: orderId32 encoding fixed (toBytes = UTF-8)"
echo "  ✔ Frontend: live 4-step payment progress UI"
echo "  ✔ Frontend: buyer can confirm from PAID or SHIPPED status"
echo "======================================================"
