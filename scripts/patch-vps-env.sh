#!/bin/bash
# Patch VPS .env — adds only MISSING keys (never overwrites existing)
# Secrets are already in .env on VPS — this only adds new keys added by new features
# Run on VPS: bash /tmp/patch-vps-env.sh

ENV_FILE="/root/services/FinalYear/docker/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi

add_if_missing() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "  · $key already set"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "  ✓ Added $key"
  fi
}

echo "=== Patching $ENV_FILE with new keys ==="

# ── New keys added by recent features ──────────────────────────────────
# (Cloudinary unsigned preset for dispute evidence upload)
add_if_missing "CLOUDINARY_EVIDENCE_PRESET"      "marketplace_evidence"
# (Inter-service auth — CRITICAL for payment flow)
add_if_missing "INTERNAL_SERVICE_KEY"             "FILL_IN_YOUR_SECRET_HERE"
add_if_missing "PAYMENT_SERVICE_URL"              "http://payment-api:3002"
# (Cloudinary public name for frontend)
add_if_missing "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" "deyjlti3v"
# (Optional services)
add_if_missing "GROQ_API_KEY"    ""
add_if_missing "MORALIS_API_KEY" ""

echo ""
echo "=== Reminder: Update these keys manually if still CHANGE_ME ==="
grep "=CHANGE_ME\|=FILL_IN" "$ENV_FILE" 2>/dev/null || echo "  No placeholder values found"

echo ""
echo "=== Done. Restart containers to apply: ==="
echo "  cd /root/services/FinalYear/docker"
echo "  docker compose -f docker-compose.prod.yml --env-file .env up -d"
