#!/usr/bin/env bash
# =============================================================================
#  Web3Market — VPS Debug Script
#  Usage: bash /root/services/FinalYear/scripts/vps-debug.sh
#  In ra tất cả thông tin debug cần thiết trong 1 màn hình
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; NC='\033[0m'; BOLD='\033[1m'

section() { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${BLUE}══════════════════════════════════════════${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC} $*"; }
info() { echo -e "  ${CYAN}→${NC} $*"; }

COMPOSE_FILE="/root/services/FinalYear/docker/docker-compose.prod.yml"
CONTAINER_POSTGRES="marketplace-postgres"
CONTAINER_BACKEND="marketplace-backend"
CONTAINER_FRONTEND="marketplace-frontend"
PGUSER="postgres"
PGDB="marketplace_db"

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║     Web3Market — VPS Debug Report        ║"
echo "  ║     $(date '+%Y-%m-%d %H:%M:%S %Z')          ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─── 1. System Resources ──────────────────────────────────────────────────────
section "1. SYSTEM RESOURCES"
echo -e "  CPU cores: $(nproc)  |  Load: $(uptime | awk -F'load average:' '{print $2}')"
echo -e "  RAM:  $(free -h | awk '/^Mem/{printf "%s used / %s total", $3, $2}')"
echo -e "  Disk: $(df -h / | awk 'NR==2{printf "%s used / %s total (%s)", $3, $2, $5}')"

# ─── 2. Container Status ──────────────────────────────────────────────────────
section "2. CONTAINER STATUS"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || warn "Docker not running"

CONTAINERS=(marketplace-postgres marketplace-backend marketplace-frontend marketplace-payment portainer)
for c in "${CONTAINERS[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$c" 2>/dev/null || echo "not_found")
    RESTARTS=$(docker inspect --format='{{.RestartCount}}' "$c" 2>/dev/null || echo "–")
    if [[ "$STATUS" == "running" ]]; then
        ok "$c → running (restarts: $RESTARTS)"
    elif [[ "$STATUS" == "not_found" ]]; then
        info "$c → not deployed"
    else
        err "$c → $STATUS (restarts: $RESTARTS)"
    fi
done

# ─── 3. Database Quick Check ──────────────────────────────────────────────────
section "3. DATABASE STATUS"
if docker inspect "$CONTAINER_POSTGRES" &>/dev/null; then
    # Try to read actual DB user/name from env
    _U=$(docker exec "$CONTAINER_POSTGRES" printenv POSTGRES_USER 2>/dev/null || echo "$PGUSER")
    _D=$(docker exec "$CONTAINER_POSTGRES" printenv POSTGRES_DB   2>/dev/null || echo "$PGDB")

    QUERY="SELECT
        (SELECT COUNT(*) FROM users)    AS users,
        (SELECT COUNT(*) FROM products WHERE status='active') AS products_active,
        (SELECT COUNT(*) FROM orders)   AS orders,
        (SELECT COUNT(*) FROM reviews)  AS reviews,
        (SELECT COUNT(*) FROM product_nfts) AS nfts;"

    RESULT=$(docker exec "$CONTAINER_POSTGRES" psql -U "$_U" -d "$_D" -tAq -c "$QUERY" 2>/dev/null || echo "ERROR")

    if [[ "$RESULT" == "ERROR" ]]; then
        err "Cannot query database — container may be initializing"
    else
        IFS='|' read -ra COLS <<< "$RESULT"
        ok "users=${COLS[0]}  products(active)=${COLS[1]}  orders=${COLS[2]}  reviews=${COLS[3]}  nfts=${COLS[4]}"

        # Check missing tables
        TABLES=("reviews" "review_votes" "product_nfts" "user_credit_scores" "p2p_offers" "user_wallets")
        for t in "${TABLES[@]}"; do
            EXISTS=$(docker exec "$CONTAINER_POSTGRES" psql -U "$_U" -d "$_D" -tAq \
                -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$t');" 2>/dev/null || echo "f")
            if [[ "${EXISTS//[[:space:]]/}" == "t" ]]; then
                ok "table $t ✓"
            else
                err "table $t MISSING → run migrate.sh"
            fi
        done
    fi
else
    err "Postgres container not found"
fi

# ─── 4. Recent Backend Errors ─────────────────────────────────────────────────
section "4. BACKEND — Last 30 lines (errors highlighted)"
docker logs "$CONTAINER_BACKEND" --tail=30 2>&1 | grep -E --color=always 'ERROR|error|Error|WARN|warn|✓|→|$' || warn "Backend container not found"

# ─── 5. API Health Check ──────────────────────────────────────────────────────
section "5. API HEALTH CHECK"
# Find internal backend port
BACKEND_PORT="3001"
for port in 3001 3000 8080; do
    if curl -sf "http://localhost:$port/api/health" &>/dev/null; then
        BACKEND_PORT=$port; break
    fi
done

HEALTH=$(curl -sf "http://localhost:$BACKEND_PORT/api/health" 2>/dev/null || echo "FAIL")
if [[ "$HEALTH" == "FAIL" ]]; then
    err "http://localhost:$BACKEND_PORT/api/health — NOT REACHABLE"
else
    ok "Health endpoint OK → $HEALTH"
fi

# Test products API
PRODUCTS=$(curl -sf "http://localhost:$BACKEND_PORT/api/products?limit=1&status=active" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"total={d.get('total',d.get('pagination',{}).get('total','?'))}\")" 2>/dev/null || echo "FAIL")
if [[ "$PRODUCTS" == "FAIL" ]]; then
    err "/api/products — FAIL"
else
    ok "/api/products — $PRODUCTS"
fi

# ─── 6. Nginx Status ──────────────────────────────────────────────────────────
section "6. NGINX STATUS"
if systemctl is-active nginx &>/dev/null; then
    ok "nginx running"
    # Check for recent errors
    ERROR_COUNT=$(tail -100 /var/log/nginx/error.log 2>/dev/null | grep -c 'error' || echo "0")
    warn "Recent nginx errors: $ERROR_COUNT (tail /var/log/nginx/error.log for details)"
else
    err "nginx not running — systemctl start nginx"
fi

# ─── 7. Recent Crash Log (if any container exited) ────────────────────────────
section "7. CRASH DETECTION"
EXITED=$(docker ps -a --filter status=exited --format "{{.Names}}" 2>/dev/null)
if [[ -z "$EXITED" ]]; then
    ok "No crashed containers"
else
    for c in $EXITED; do
        err "CRASHED: $c"
        echo "  --- Last 10 lines before crash ---"
        docker logs "$c" --tail=10 2>&1 | sed 's/^/    /'
        echo ""
    done
fi

# ─── 8. Auto-fix suggestions ──────────────────────────────────────────────────
section "8. QUICK FIX COMMANDS"
cat <<'EOF'
  # Pull latest code + run DB migration:
  cd /root/services/FinalYear && git pull && bash init_database.sql/migrate.sh

  # Force restart all services:
  cd /root/services/FinalYear
  docker compose -f docker/docker-compose.prod.yml restart

  # Rebuild + redeploy (khi code đổi):
  docker compose -f docker/docker-compose.prod.yml up -d --build

  # Enter DB shell:
  docker exec -it marketplace-postgres psql -U postgres -d marketplace_db

  # Follow all logs live:
  docker compose -f docker/docker-compose.prod.yml logs -f --tail=20
EOF

echo ""
echo -e "${BOLD}${GREEN}Report done. $(date '+%H:%M:%S')${NC}"
