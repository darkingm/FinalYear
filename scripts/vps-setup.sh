#!/bin/bash
# VPS Setup Script — chạy trực tiếp trên VPS
set -e

ENV_FILE="/root/services/FinalYear/docker/.env"
COMPOSE_DIR="/root/services/FinalYear/docker"
TAG_ENV_FILE="/root/services/FinalYear/docker/.image-tags.env"
INIT_DIR="/root/services/FinalYear/init_database.sql"

echo "================================================"
echo "  Web3Market VPS Setup — $(date '+%Y-%m-%d %H:%M')"
echo "================================================"

# ── 1. Patch .env ──────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Patching .env..."

add_if_missing() {
  local key="$1" val="$2"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "  ✓ Added $key"
  else
    echo "  · $key already set"
  fi
}

add_if_missing "DOCKERHUB_USERNAME"       "kaitojpla"
add_if_missing "INTERNAL_SERVICE_KEY"     "FILL_IN_YOUR_SECRET_HERE"
add_if_missing "PAYMENT_SERVICE_URL"      "http://payment-api:3002"
add_if_missing "REDIS_PASSWORD"           "FILL_IN_YOUR_REDIS_PASSWORD"
add_if_missing "RABBITMQ_USER"            "kaitojpla"
add_if_missing "RABBITMQ_PASSWORD"        "FILL_IN_YOUR_RABBITMQ_PASSWORD"
add_if_missing "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" "deyjlti3v"
add_if_missing "PAYPAL_CLIENT_ID"         "FILL_IN_PAYPAL_CLIENT_ID"
add_if_missing "PAYPAL_MODE"              "sandbox"

echo "  .env patched OK"

# ── 2. Create migrations dir ──────────────────────────────────────────────────
echo ""
echo "[2/5] Creating migrations directory..."
mkdir -p "$INIT_DIR/migrations"
echo "  ✓ $INIT_DIR/migrations/ ready"

# ── 3. Apply DB migrations ────────────────────────────────────────────────────
echo ""
echo "[3/5] Applying DB migrations to marketplace_db..."

docker exec marketplace-postgres psql -U postgres -d marketplace_db -v ON_ERROR_STOP=0 << 'ENDSQL'
-- ── schema_migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT 'manual'
);

-- ── Migration 001: payment_system_fixes ──────────────────────────────────
DO $$ BEGIN ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders ADD COLUMN release_tx_hash VARCHAR(128); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN evidence_urls JSONB DEFAULT '[]'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN buyer_wallet VARCHAR(42); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN seller_wallet VARCHAR(42); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE disputes ADD CONSTRAINT disputes_order_id_unique UNIQUE (order_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend orders status CHECK
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'UNPAID','TX_SUBMITTED','TX_FAILED','ONCHAIN_CONFIRMED',
  'PAID','PAID_PAYPAL','PROCESSING','SHIPPED','DELIVERED',
  'COMPLETED','CANCELLED','REFUNDED','DELIVERING','DISPUTED'
));

CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

INSERT INTO schema_migrations(version,name,filename,applied_by)
VALUES ('001','payment_system_fixes','001_payment_system_fixes.sql','manual-ssh')
ON CONFLICT(version) DO NOTHING;

-- ── Migration 002: dispute_system_improvements ───────────────────────────
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'normal'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN admin_note TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN resolved_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE disputes ADD COLUMN resolution_action VARCHAR(30); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_disputes_priority ON disputes(priority, status);
CREATE INDEX IF NOT EXISTS idx_disputes_created_at ON disputes(created_at DESC);

INSERT INTO schema_migrations(version,name,filename,applied_by)
VALUES ('002','dispute_system_improvements','002_dispute_system_improvements.sql','manual-ssh')
ON CONFLICT(version) DO NOTHING;

-- Verify
SELECT version, name, applied_by, applied_at::timestamp(0) AS applied_at
FROM schema_migrations ORDER BY version;
ENDSQL

echo "  ✓ Migrations applied"

# ── 4. Update nginx config (add payment API route) ────────────────────────────
echo ""
echo "[4/5] Checking nginx config..."

NGINX_CONF="/etc/nginx/conf.d/kienai.conf"
if ! grep -q "location /api/payments" "$NGINX_CONF" 2>/dev/null; then
  echo "  → Adding /api/payments route to nginx..."
  # Backup
  cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%s)"

  # Write full correct config
  cat > "$NGINX_CONF" << 'NGINX'
server {
    listen 80;
    server_name kienai.id.vn www.kienai.id.vn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name kienai.id.vn www.kienai.id.vn;

    ssl_certificate /etc/letsencrypt/live/kienai.id.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kienai.id.vn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20M;
    server_tokens off;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;

    # ── NextAuth (must come BEFORE /api/) ───────────────────────────────
    location ~ ^/api/auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # ── Payment API (/api/payments/...) ─────────────────────────────────
    location ~ ^/api/payments/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # ── Payment API (legacy /payment/ prefix) ───────────────────────────
    location /payment/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # ── Main API (all other /api/) ──────────────────────────────────────
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # ── Frontend (Next.js catch-all) ────────────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX
  echo "  ✓ nginx config updated"
else
  echo "  · nginx already has /api/payments route"
fi

nginx -t && systemctl reload nginx && echo "  ✓ nginx reloaded"

# ── 5. Restart services with new env vars ─────────────────────────────────────
echo ""
echo "[5/5] Restarting containers with updated env..."
cd "$COMPOSE_DIR"

# Remove old migrator container if exists
docker rm -f marketplace-db-migrator 2>/dev/null || true

# Restart main-api and payment-api to pick up new env vars
set -a
[ -f "$TAG_ENV_FILE" ] && . "$TAG_ENV_FILE"
set +a
docker compose -f docker-compose.prod.yml --env-file .env up -d --no-deps main-api payment-api frontend

sleep 10

echo ""
echo "=== Health checks ==="
curl -sf http://127.0.0.1:3001/health > /dev/null && echo "✅ main-api :3001 OK" || echo "❌ main-api :3001 FAIL"
curl -sf http://127.0.0.1:3002/health > /dev/null && echo "✅ payment-api :3002 OK" || echo "❌ payment-api :3002 FAIL"
curl -sf http://127.0.0.1:3000 > /dev/null && echo "✅ frontend :3000 OK" || echo "❌ frontend :3000 FAIL"

echo ""
echo "=== Container status ==="
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep marketplace

echo ""
echo "================================================"
echo "  ✅ VPS Setup complete!"
echo "  🌐 https://kienai.id.vn"
echo "================================================"
