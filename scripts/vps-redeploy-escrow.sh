#!/bin/bash
# =============================================================
# vps-redeploy-escrow.sh
#
# Redeploy EscrowCore on Hardhat VPS local chain, then:
#   1. Grant OPERATOR_ROLE to payment-service wallet
#   2. Auto-update ESCROW_CONTRACT_LOCALHOST in payment-service .env
#   3. Restart payment-service container
#
# Run on VPS:
#   bash scripts/vps-redeploy-escrow.sh
# =============================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅  $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️   $1${NC}"; }
info() { echo -e "  ℹ️   $1"; }
header() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }

header "EscrowCore Redeploy (Hardhat VPS)"

# ── 1. Compute OPERATOR_ADDRESS from ADMIN_PRIVATE_KEY ──────────────────────
# The operator is the wallet address derived from ADMIN_PRIVATE_KEY in payment-service .env
PAYMENT_ENV="/opt/marketplace/backend/payment-service/.env"
if [ ! -f "$PAYMENT_ENV" ]; then
  PAYMENT_ENV="$(pwd)/backend/payment-service/.env"
fi

ADMIN_PRIVATE_KEY=$(grep '^ADMIN_PRIVATE_KEY=' "$PAYMENT_ENV" 2>/dev/null | head -1 | cut -d= -f2-)

if [ -z "$ADMIN_PRIVATE_KEY" ]; then
  warn "ADMIN_PRIVATE_KEY not found in $PAYMENT_ENV"
  warn "Will grant OPERATOR_ROLE to Hardhat Account #1 (default)"
  OPERATOR_ADDRESS=""
else
  info "Found ADMIN_PRIVATE_KEY in $PAYMENT_ENV"
  # Derive address using cast (foundry) if available, else skip
  if command -v cast &>/dev/null; then
    OPERATOR_ADDRESS=$(cast wallet address --private-key "$ADMIN_PRIVATE_KEY" 2>/dev/null || echo "")
    if [ -n "$OPERATOR_ADDRESS" ]; then
      ok "Operator address derived: $OPERATOR_ADDRESS"
    fi
  fi
fi

# ── 2. Deploy EscrowCore ────────────────────────────────────────────────────
header "Deploying EscrowCore to Hardhat local"

cd /opt/marketplace/contracts 2>/dev/null || cd "$(pwd)/contracts"

# Make sure hardhat node is running
if ! curl -sf http://localhost:8545 -d '{"jsonrpc":"2.0","method":"net_version","id":1}' > /dev/null 2>&1; then
  warn "Hardhat node not responding at :8545 — start it first"
  exit 1
fi

ok "Hardhat node is running"

# Run deploy script
OPERATOR_ADDRESS="$OPERATOR_ADDRESS" npx hardhat run scripts/deploy-hardhat.ts --network localhost 2>&1 | tee /tmp/deploy_output.txt

# Extract contract address from output
NEW_ESCROW=$(grep 'EscrowCore deployed:' /tmp/deploy_output.txt | awk '{print $NF}')
if [ -z "$NEW_ESCROW" ]; then
  NEW_ESCROW=$(grep 'ESCROW_CONTRACT_LOCALHOST=' /tmp/deploy_output.txt | head -1 | cut -d= -f2-)
fi

if [ -z "$NEW_ESCROW" ]; then
  warn "Could not extract new escrow address from deploy output"
  cat /tmp/deploy_output.txt
  exit 1
fi

ok "New EscrowCore: $NEW_ESCROW"

# ── 3. Update .env files ────────────────────────────────────────────────────
header "Updating .env files"

update_env() {
  local FILE="$1"
  local KEY="$2"
  local VAL="$3"
  if [ -f "$FILE" ]; then
    if grep -q "^${KEY}=" "$FILE"; then
      sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" "$FILE"
      ok "Updated $KEY in $(basename $FILE)"
    else
      echo "${KEY}=${VAL}" >> "$FILE"
      ok "Added $KEY to $(basename $FILE)"
    fi
  else
    warn "$FILE not found — skipping"
  fi
}

PAYMENT_ENV_PATHS=(
  "/opt/marketplace/backend/payment-service/.env"
  "$(pwd)/../backend/payment-service/.env"
)

for ENV_FILE in "${PAYMENT_ENV_PATHS[@]}"; do
  update_env "$ENV_FILE" "ESCROW_CONTRACT_LOCALHOST" "$NEW_ESCROW"
  update_env "$ENV_FILE" "ESCROW_CONTRACT_ADDRESS" "$NEW_ESCROW"
done

# ── 4. Restart payment-service ─────────────────────────────────────────────
header "Restarting payment-service"

if command -v docker &>/dev/null; then
  if docker ps --format '{{.Names}}' | grep -q 'payment-service'; then
    docker restart marketplace-payment-service 2>/dev/null || docker restart payment-service 2>/dev/null || warn "Could not restart container — restart manually"
    ok "payment-service restarted"
  else
    warn "payment-service container not found — restart manually: docker restart <container>"
  fi
else
  warn "Docker not found — restart payment-service manually"
fi

# ── 5. Summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══ Done! ══${NC}"
echo ""
echo -e "  New escrow contract: ${BOLD}$NEW_ESCROW${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo -e "  1. MetaMask → Settings → Networks → Hardhat VPS → reset account (clear tx history)"
echo -e "  2. Thử thanh toán lại — StackOverflow sẽ không còn nữa"
echo ""
