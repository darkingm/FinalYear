#!/bin/bash
ENVFILE=/root/services/FinalYear/.env

echo "=== Verifying critical env vars ==="
PAYPAL_ID=$(grep '^PAYPAL_CLIENT_ID=' "$ENVFILE" | cut -d= -f2-)
PAYPAL_SEC=$(grep '^PAYPAL_SECRET=' "$ENVFILE" | cut -d= -f2-)
ESCROW_LOCAL=$(grep '^ESCROW_CONTRACT_LOCALHOST=' "$ENVFILE" | cut -d= -f2-)
ESCROW_AMOY=$(grep '^ESCROW_CONTRACT_POLYGON_AMOY=' "$ENVFILE" | cut -d= -f2-)
PAYPAL_MODE=$(grep '^PAYPAL_MODE=' "$ENVFILE" | cut -d= -f2-)

echo "PAYPAL_CLIENT_ID length: ${#PAYPAL_ID} chars (expected 80)"
echo "PAYPAL_SECRET length: ${#PAYPAL_SEC} chars (expected 76)"
echo "PAYPAL_MODE: $PAYPAL_MODE"
echo "ESCROW_LOCALHOST: $ESCROW_LOCAL"
echo "ESCROW_AMOY: $ESCROW_AMOY"

echo ""
if [ "${#PAYPAL_ID}" -ge 50 ] && [ -n "$ESCROW_LOCAL" ]; then
  echo "✅ All critical vars look correct"
else
  echo "❌ Some vars might be wrong or missing"
fi

# Now restart payment-api with new env
echo ""
echo "=== Restarting payment-api & main-api ==="
cd /root/services/FinalYear/docker
docker compose -f docker-compose.prod.yml --env-file /root/services/FinalYear/.env up -d --no-deps --force-recreate payment-api main-api 2>&1
sleep 10
echo ""
echo "=== Container status ==="
docker ps --format "N={{.Names}} S={{.Status}}" | grep -E "payment|main"
