#!/bin/bash
# =============================================================
# vps-setup-hardhat-payment.sh
#
# Chạy trên VPS để thiết lập toàn bộ Hardhat local payment:
#   1. Seed token_whitelist cho chain 31337 (ETH native)
#   2. Giảm giá sản phẩm về mức thấp để test
#   3. Update seller payout_wallet → Hardhat Account #1
#   4. Seed token_whitelist cho Polygon Amoy (song song)
#   5. In hướng dẫn MetaMask
#
# Usage trên VPS:
#   chmod +x scripts/vps-setup-hardhat-payment.sh
#   ssh root@103.20.96.79 "cd /opt/marketplace && bash scripts/vps-setup-hardhat-payment.sh"
# =============================================================

set -e

VPS_IP="103.20.96.79"
MAIN_DB="marketplace-postgres"
PAYMENT_DB="marketplace-payment-postgres"
DB_PASS="${POSTGRES_PASSWORD:-@Kien2909}"
DB_USER="postgres"

MAIN_DB_NAME="marketplace_db"
PAYMENT_DB_NAME="payment_db"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}══ $1 ══${NC}"; }
ok()     { echo -e "  ${GREEN}✅  $1${NC}"; }
warn()   { echo -e "  ${YELLOW}⚠️   $1${NC}"; }
info()   { echo -e "  ℹ️   $1"; }

header "VPS Hardhat Payment Setup"

# ─── 1. Giảm giá sản phẩm để test ─────────────────────────────────────────
header "BƯỚC 1: Giảm giá sản phẩm cho testnet testing"

docker exec -i $MAIN_DB psql -U $DB_USER -d $MAIN_DB_NAME << 'SQL'
-- Backup giá gốc vào cột mới (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='products' AND column_name='original_price_usd'
  ) THEN
    ALTER TABLE products ADD COLUMN original_price_usd DECIMAL(12,6);
  END IF;
END $$;

-- Lưu giá gốc (chỉ lần đầu)
UPDATE products
SET original_price_usd = base_price_usd
WHERE original_price_usd IS NULL AND status = 'active';

-- Giảm giá xuống mức rất thấp để test
UPDATE products
SET base_price_usd = CASE
    WHEN base_price_usd >= 1000 THEN 0.01
    WHEN base_price_usd >= 100  THEN 0.005
    WHEN base_price_usd >= 10   THEN 0.002
    ELSE                             0.001
END
WHERE status = 'active';

-- Xác nhận
SELECT COUNT(*) as updated_products,
       MIN(base_price_usd) as min_price,
       MAX(base_price_usd) as max_price
FROM products WHERE status = 'active';
SQL

ok "Đã giảm giá sản phẩm (gốc đã backup vào original_price_usd)"

# ─── 2. Seed token_whitelist cho Hardhat Local (chain 31337) ───────────────
header "BƯỚC 2: Seed token whitelist cho Hardhat (chain 31337)"

docker exec -i $PAYMENT_DB psql -U $DB_USER -d $PAYMENT_DB_NAME << 'SQL'
-- Xóa các token cũ không hợp lệ cho chain 31337
UPDATE token_whitelist SET is_active = FALSE
WHERE chain_id = 31337;

-- Insert ETH native cho Hardhat
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active, metadata)
VALUES (
  'ETH',
  '0x0000000000000000000000000000000000000000',
  31337,
  18,
  TRUE,
  '{"name": "Ether (Hardhat Local)", "type": "native", "description": "Native ETH on Hardhat VPS chain"}'
)
ON CONFLICT (token_address, chain_id)
DO UPDATE SET is_active = TRUE, metadata = EXCLUDED.metadata;

-- Kiểm tra kết quả
SELECT symbol, token_address, chain_id, decimals, is_active
FROM token_whitelist
WHERE chain_id = 31337
ORDER BY symbol;
SQL

ok "Đã seed ETH token cho Hardhat chain 31337"

# ─── 3. Seed token_whitelist cho Polygon Amoy (chain 80002) ─────────────────
header "BƯỚC 3: Seed token whitelist cho Polygon Amoy (chain 80002)"

docker exec -i $PAYMENT_DB psql -U $DB_USER -d $PAYMENT_DB_NAME << 'SQL'
-- MATIC native trên Amoy
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES
  ('MATIC', '0x0000000000000000000000000000000000001010', 80002, 18, TRUE),
  ('ETH',   '0x0000000000000000000000000000000000000000', 80002, 18, TRUE)
ON CONFLICT (token_address, chain_id) DO UPDATE SET is_active = TRUE;

-- Xem kết quả
SELECT symbol, chain_id, is_active
FROM token_whitelist
WHERE chain_id IN (31337, 80002)
ORDER BY chain_id, symbol;
SQL

ok "Đã seed tokens cho Polygon Amoy"

# ─── 4. Update seller payout_wallet → Hardhat Account #1 ──────────────────
header "BƯỚC 4: Update seller wallets → Hardhat Account #1"

docker exec -i $MAIN_DB psql -U $DB_USER -d $MAIN_DB_NAME << 'SQL'
-- Hardhat Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
-- Đây là ví seller trong Hardhat local network
UPDATE seller_profiles
SET payout_wallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
WHERE payout_wallet IS NULL
   OR payout_wallet !~ '^0x[0-9a-fA-F]{40}$'
   OR payout_wallet = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa'
   OR payout_wallet = '0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb'
   OR payout_wallet = '0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc';

-- Xem kết quả
SELECT sp.seller_id, u.email, sp.payout_wallet
FROM seller_profiles sp
JOIN users u ON u.user_id = sp.seller_id
ORDER BY sp.seller_id;
SQL

ok "Đã update seller wallets"

# ─── 5. Update product accepted_tokens metadata ────────────────────────────
header "BƯỚC 5: Update product accepted_tokens"

docker exec -i $MAIN_DB psql -U $DB_USER -d $MAIN_DB_NAME << 'SQL'
UPDATE products
SET metadata = COALESCE(metadata, '{}'::jsonb) ||
    '{"accepted_tokens": {"crypto": ["ETH", "MATIC", "USDT"], "fiat": ["paypal"]}}'::jsonb
WHERE status = 'active'
  AND (metadata IS NULL
    OR metadata->>'accepted_tokens' IS NULL
    OR metadata->'accepted_tokens'->>'crypto' IS NULL);

SELECT COUNT(*) as products_with_tokens
FROM products
WHERE status = 'active'
  AND metadata->'accepted_tokens'->>'crypto' IS NOT NULL;
SQL

ok "Đã update product accepted_tokens"

# ─── 6. Print hướng dẫn ────────────────────────────────────────────────────
header "HƯỚNG DẪN METAMASK & PAYMENT FLOW"

echo -e ""
echo -e "${BOLD}Thêm Hardhat VPS vào MetaMask:${NC}"
echo -e "┌─────────────────────────────────────────┐"
echo -e "│ Network Name:  Hardhat VPS               │"
echo -e "│ RPC URL:       http://$VPS_IP:8545   │"
echo -e "│ Chain ID:      31337                     │"
echo -e "│ Symbol:        ETH                       │"
echo -e "│ Explorer:      (để trống)                │"
echo -e "└─────────────────────────────────────────┘"
echo -e ""
echo -e "${BOLD}Import ví Buyer (Account #0 Hardhat):${NC}"
echo -e "  Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo -e "  PKey:    0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo -e "  Balance: 10,000 ETH (testnet, KHÔNG có giá trị thật)"
echo -e ""
echo -e "${BOLD}Luồng thanh toán:${NC}"
echo -e "  1. Mở https://kienai.id.vn → Login"
echo -e "  2. Chọn sản phẩm → Mua ngay"
echo -e "  3. Checkout → Chọn: Crypto (Web3)"
echo -e "  4. Chọn mạng: Hardhat VPS → Token: ETH"
echo -e "  5. Tạo hóa đơn → Click 'Ký & Thanh toán'"
echo -e "  6. MetaMask confirm → ✅ Done! (instant)"
echo -e ""
echo -e "${BOLD}Song song Polygon Amoy (khi có đủ MATIC):${NC}"
echo -e "  1. Faucet: https://faucet.polygon.technology/"
echo -e "  2. Checkout → Chọn mạng: Polygon Amoy → Token: MATIC"
echo -e ""

header "KIỂM TRA CONTAINER HARDHAT"
docker ps --filter "name=marketplace-hardhat" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || warn "Container hardhat chưa chạy — cần deploy lại docker-compose"

echo -e "\n${BOLD}${GREEN}✅ Setup hoàn tất! Payment dual-mode sẵn sàng.${NC}\n"
