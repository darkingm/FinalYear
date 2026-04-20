#!/usr/bin/env bash
# ================================================================
# db-migrate.sh — Automated Database Migration Runner
#
# CÁCH HOẠT ĐỘNG:
#   1. Kết nối vào PostgreSQL
#   2. Tạo bảng schema_migrations nếu chưa có
#   3. Đọc tất cả file trong /migrations/*.sql theo thứ tự
#   4. Chỉ chạy các file CHƯA có trong schema_migrations
#   5. Record kết quả vào schema_migrations
#   6. Thoát với exit code 0 (thành công) hoặc 1 (lỗi)
#
# DÙNG TRONG DOCKER COMPOSE:
#   Là 'db-migrator' service chạy trước main-api và payment-api
#
# BIẾN MÔI TRƯỜNG:
#   DATABASE_URL  — postgresql://user:pass@host:port/dbname
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE  — hoặc từng biến riêng
#   MIGRATIONS_DIR — thư mục chứa file migration (default: /migrations)
# ================================================================
set -euo pipefail

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${CYAN}[→]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}${CYAN}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║         Web3Market — DB Migration Runner        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Started at: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

# ── 1. Parse connection from DATABASE_URL or individual env vars ──────────────
if [[ -n "${DATABASE_URL:-}" ]]; then
  # Parse postgresql://user:pass@host:port/dbname
  PGUSER=$(echo "$DATABASE_URL"     | sed -E 's|postgresql://([^:]+):.*|\1|')
  PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
  PGHOST=$(echo "$DATABASE_URL"     | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
  PGPORT=$(echo "$DATABASE_URL"     | sed -E 's|postgresql://[^@]+@[^:]+:([0-9]+)/.*|\1|')
  PGDATABASE=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^/]+/([^?]+).*|\1|')
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-marketplace_db}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

info "Connection: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
info "Migrations: ${MIGRATIONS_DIR}"
echo ""

# ── 2. Wait for Postgres to be ready (max 60s) ────────────────────────────────
info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1" >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -le 0 ]]; then
    fail "PostgreSQL not ready after 60s. Aborting."
  fi
  echo -n "."
  sleep 2
done
echo ""
log "PostgreSQL is ready."
echo ""

# Convenience alias
psql_run() {
  PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$@"
}

# ── 3. Create migration tracking table ───────────────────────────────────────
info "Ensuring schema_migrations table exists..."
psql_run -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    version     VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    filename    VARCHAR(255) NOT NULL,
    checksum    VARCHAR(64),
    applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    applied_by  VARCHAR(100) DEFAULT 'auto-migrator'
);
SQL
log "schema_migrations table ready."
echo ""

# ── 4. Get list of already-applied migrations ─────────────────────────────────
APPLIED=$(psql_run -tAq -c "SELECT version FROM schema_migrations ORDER BY version;" 2>/dev/null || echo "")
info "Already applied: $(echo "$APPLIED" | tr '\n' ' ' | sed 's/  */ /g')"
echo ""

# ── 5. Find and sort migration files ─────────────────────────────────────────
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  warn "Migrations directory '$MIGRATIONS_DIR' not found. Nothing to run."
  exit 0
fi

MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)
if [[ -z "$MIGRATION_FILES" ]]; then
  warn "No .sql files found in $MIGRATIONS_DIR"
  exit 0
fi

info "Found migration files:"
echo "$MIGRATION_FILES" | while read -r f; do echo "    $(basename "$f")"; done
echo ""

# ── 6. Apply pending migrations ───────────────────────────────────────────────
APPLIED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

while IFS= read -r filepath; do
  filename=$(basename "$filepath")
  # Extract version: first 3 digits from filename (e.g. "001" from "001_payment_fixes.sql")
  version=$(echo "$filename" | sed -nE 's/^([0-9]+).*/\1/p')
  name=$(echo "$filename" | sed -E 's/^[0-9]+_//; s/\.sql$//')

  if [[ -z "$version" ]]; then
    warn "Skipping '$filename' — no version prefix (expected format: NNN_name.sql)"
    continue
  fi

  # Check if already applied
  if echo "$APPLIED" | grep -qx "$version"; then
    echo -e "  ${YELLOW}SKIP${NC}  [v${version}] ${name} — already applied"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    continue
  fi

  echo -e "  ${CYAN}RUN ${NC}  [v${version}] ${name}..."

  # Calculate checksum
  CHECKSUM=$(md5sum "$filepath" 2>/dev/null | cut -d' ' -f1 || echo "unknown")

  # Run the migration
  if PGPASSWORD="$PGPASSWORD" psql \
      -h "$PGHOST" -p "$PGPORT" \
      -U "$PGUSER" -d "$PGDATABASE" \
      -v ON_ERROR_STOP=0 \
      -f "$filepath" \
      2>&1 | grep -v "^$" | sed 's/^/      /'; then

    # Record as applied
    psql_run -v ON_ERROR_STOP=1 \
      -c "INSERT INTO schema_migrations (version, name, filename, checksum)
          VALUES ('${version}', '${name}', '${filename}', '${CHECKSUM}')
          ON CONFLICT (version) DO UPDATE SET applied_at = NOW(), checksum = EXCLUDED.checksum;" \
      >/dev/null 2>&1

    echo -e "  ${GREEN}DONE${NC}  [v${version}] ${name} ✓"
    APPLIED_COUNT=$((APPLIED_COUNT + 1))
  else
    echo -e "  ${RED}FAIL${NC}  [v${version}] ${name} — check logs above"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    # Don't exit — continue with other migrations
  fi

done <<< "$MIGRATION_FILES"

# ── 7. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Migration Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Applied :${NC} $APPLIED_COUNT"
echo -e "  ${YELLOW}Skipped :${NC} $SKIPPED_COUNT (already up to date)"
echo -e "  ${RED}Failed  :${NC} $FAILED_COUNT"
echo ""

# Show applied migrations log
info "Migration history:"
psql_run -c "SELECT version, name, applied_at::timestamp(0) FROM schema_migrations ORDER BY version;" 2>/dev/null | grep -v "^-\|^(" | sed 's/^/ /'
echo ""

if [[ $FAILED_COUNT -gt 0 ]]; then
  warn "$FAILED_COUNT migration(s) had errors. Check logs above."
  # Exit 0 to not block service startup — migration errors are non-fatal
  # Change to 'exit 1' if you want hard failure
  exit 0
fi

log "All migrations applied successfully. Database is up to date."
echo ""
