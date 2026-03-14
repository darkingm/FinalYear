#!/usr/bin/env bash
# =============================================================================
#  Web3Market — Database Migration Script
#  Usage: bash migrate.sh
#  Chạy trên VPS sau khi SSH vào (với quyền sudo nếu cần Docker).
#
#  An toàn: KHÔNG xóa dữ liệu cũ.
#           Tất cả statements dùng IF NOT EXISTS / ON CONFLICT DO NOTHING.
#           Có thể chạy nhiều lần, lần sau chỉ thêm những gì còn thiếu.
# =============================================================================
set -euo pipefail

# ── Màu sắc terminal ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${CYAN}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════════╗"
echo "  ║        Web3Market — DB Migration (Phase 4)          ║"
echo "  ╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Phát hiện container Postgres ──────────────────────────────────────────
info "Tìm container Postgres..."

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'postgres|marketplace-postgres' | head -1 || true)
if [[ -z "$CONTAINER" ]]; then
    fail "Không tìm thấy container Postgres đang chạy. Chạy 'docker ps' để kiểm tra."
fi
log "Container: $CONTAINER"

# ── 2. Lấy thông tin database từ container env ────────────────────────────────
PGUSER=$(docker exec "$CONTAINER" printenv POSTGRES_USER 2>/dev/null || echo "postgres")
PGDB=$(docker  exec "$CONTAINER" printenv POSTGRES_DB   2>/dev/null || echo "marketplace_db")

info "Database: ${PGDB} | User: ${PGUSER}"

# ── 3. Tìm vị trí file schema.sql trên host ───────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"
SEED_FILE="$SCRIPT_DIR/seed.sql"

if [[ ! -f "$SCHEMA_FILE" ]]; then
    fail "Không tìm thấy $SCHEMA_FILE"
fi
log "Schema: $SCHEMA_FILE"

# ── 4. Copy files vào container (an toàn hơn bind mount) ─────────────────────
info "Copy schema vào container..."
docker cp "$SCHEMA_FILE" "$CONTAINER":/tmp/schema.sql
log "Đã copy schema.sql"

if [[ -f "$SEED_FILE" ]]; then
    docker cp "$SEED_FILE" "$CONTAINER":/tmp/seed.sql
    log "Đã copy seed.sql"
    HAS_SEED=true
else
    warn "seed.sql không tồn tại, bỏ qua seed data."
    HAS_SEED=false
fi

# ── 5. Chạy schema migration ──────────────────────────────────────────────────
echo ""
info "Chạy schema migration (có thể mất 10-30 giây)..."

if docker exec -i "$CONTAINER" \
    psql -U "$PGUSER" -d "$PGDB" \
    -v ON_ERROR_STOP=0 \
    -f /tmp/schema.sql 2>&1 | tee /tmp/schema_output.txt; then
    log "Schema migration hoàn thành."
else
    warn "Schema migration có một số warnings (không phải lỗi nghiêm trọng nếu bảng đã tồn tại)."
fi

# Kiểm tra kết quả verification query ở cuối file
if grep -q "total_tables" /tmp/schema_output.txt 2>/dev/null; then
    echo ""
    echo -e "${GREEN}${BOLD}=== KẾT QUẢ MIGRATION ===${NC}"
    grep -A3 "total_tables" /tmp/schema_output.txt | tail -4
fi

# ── 6. Chạy seed data (chỉ khi bảng còn trống) ───────────────────────────────
if [[ "$HAS_SEED" == "true" ]]; then
    echo ""
    # Kiểm tra số lượng sản phẩm hiện tại
    PRODUCT_COUNT=$(docker exec "$CONTAINER" \
        psql -U "$PGUSER" -d "$PGDB" -tAq \
        -c "SELECT COUNT(*) FROM products;" 2>/dev/null || echo "0")
    PRODUCT_COUNT="${PRODUCT_COUNT//[[:space:]]/}"

    if [[ "$PRODUCT_COUNT" -eq 0 ]]; then
        info "Bảng products trống → chạy seed data..."
        if docker exec -i "$CONTAINER" \
            psql -U "$PGUSER" -d "$PGDB" \
            -v ON_ERROR_STOP=0 \
            -f /tmp/seed.sql 2>&1 | tail -5; then
            log "Seed data hoàn thành."
        else
            warn "Seed data có warnings (bình thường nếu data đã tồn tại)."
        fi
    else
        warn "Bảng products đã có $PRODUCT_COUNT sản phẩm → bỏ qua seed để tránh duplicate."
    fi
fi

# ── 7. Xóa file tạm trong container ──────────────────────────────────────────
docker exec "$CONTAINER" rm -f /tmp/schema.sql /tmp/seed.sql 2>/dev/null || true

# ── 8. Hiển thị tóm tắt ──────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Migration hoàn tất!${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════${NC}"
echo ""

# In danh sách bảng
info "Danh sách bảng trong DB:"
docker exec "$CONTAINER" \
    psql -U "$PGUSER" -d "$PGDB" \
    -c "\dt" 2>/dev/null | grep "public" | awk '{print "  ✓ " $3}' || true

echo ""
info "Kiểm tra nhanh số bản ghi:"
docker exec "$CONTAINER" \
    psql -U "$PGUSER" -d "$PGDB" -tAq \
    -c "SELECT
            'users='     || (SELECT COUNT(*) FROM users),
            'products='  || (SELECT COUNT(*) FROM products),
            'orders='    || (SELECT COUNT(*) FROM orders),
            'reviews='   || (SELECT COUNT(*) FROM reviews),
            'nfts='      || (SELECT COUNT(*) FROM product_nfts)
        ;" 2>/dev/null | tr ',' '\n' | awk '{print "  " $0}' || true

echo ""
log "Done. Kiểm tra thêm: docker exec -it $CONTAINER psql -U $PGUSER -d $PGDB"
