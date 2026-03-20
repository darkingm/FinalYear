#!/bin/bash
# Patch VPS .env with new/missing environment variables
# Reads existing .env, adds missing keys only (does NOT overwrite existing)
# Run: bash /tmp/patch-env.sh

ENV_FILE="/root/services/FinalYear/docker/.env"

add_if_missing() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "  · $key already set"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "  ✓ Added $key"
  fi
}

update_value() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    echo "  ✓ Updated $key"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
    echo "  ✓ Added $key"
  fi
}

echo "=== Patching $ENV_FILE ==="

# ── Cloudinary (new API key from user) ────────────────────────────────
update_value "CLOUDINARY_CLOUD_NAME"            "deyjlti3v"
update_value "CLOUDINARY_API_KEY"               "781815662721826"
update_value "CLOUDINARY_API_SECRET"            "0nEqYt8m-_A9qzwWo2bsEmM6gfU"
update_value "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" "deyjlti3v"

# ── New Cloudinary Preset for dispute evidence ─────────────────────────
add_if_missing "CLOUDINARY_EVIDENCE_PRESET" "marketplace_evidence"

# ── Services that might be missing ────────────────────────────────────
add_if_missing "SMTP_USER"        "kaitojpla@gmail.com"
add_if_missing "SMTP_PASSWORD"    "cltk gtwx cgek mofm"
add_if_missing "HCAPTCHA_SECRET"  "ES_9a13fd597b2c4cd5a3b0ded489fd5e17"
add_if_missing "GOOGLE_CLIENT_ID" "946575631331-1p51ll7tpqd0bo1impek2nggoqjrcoo8.apps.googleusercontent.com"
add_if_missing "GOOGLE_CLIENT_SECRET" "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"
add_if_missing "FACEBOOK_CLIENT_ID"   "1497732641781702"
add_if_missing "FACEBOOK_CLIENT_SECRET" "7bbce842d85baa3c21fca3101b42c832"
add_if_missing "PAYPAL_CLIENT_ID" "AYxcD1jBUgx2LMY2eoXyM7lhcTpzrR3X"
add_if_missing "PAYPAL_SECRET"    "EPxefifbE6-6hPXAsqdY8jGlxcTpYRwuAjhT2aRPxWChSK0QOwIhijGbgwfRNhS2TEN2FSwSG-Mf4hhN"
add_if_missing "PAYPAL_MODE"      "sandbox"
add_if_missing "GROQ_API_KEY"     ""
add_if_missing "BLOCKCHAIN_PRIVATE_KEY" "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
add_if_missing "MORALIS_API_KEY"  ""
add_if_missing "INTERNAL_SERVICE_KEY"  "internal-service-key-w3market-2026"
add_if_missing "PAYMENT_SERVICE_URL"   "http://payment-api:3002"

echo ""
echo "=== Restarting main-api to pick up new Cloudinary keys ==="
cd /root/services/FinalYear/docker
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml --env-file .env up -d --no-deps main-api 2>&1 | tail -5
sleep 8
curl -s http://127.0.0.1:3001/health && echo " main-api OK" || echo " main-api FAIL"

echo ""
echo "=== Done ==="
echo "Cloudinary API Key updated: 781815662721826"
echo "Cloudinary Preset: marketplace_evidence (unsigned)"
