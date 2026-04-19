# Payment System Design — Crypto + PayPal + QR Deposit
*Ngày: 2026-03-17 | Hệ thống: NFT/Digital Goods E-Commerce*

---

## 1. TỔNG QUAN HỆ THỐNG

```
Người dùng → Checkout Page → [Chọn phương thức]
                ├── Crypto (MetaMask) → EscrowCore Smart Contract → Seller nhận tiền
                ├── PayPal            → PayPal Sandbox/Live       → Platform nhận
                └── QR Deposit        → Địa chỉ ví user           → User nạp vào ví
```

Hệ thống gồm 3 module thanh toán **độc lập**, mỗi cái có flow riêng:

---

## 2. MODULE 1: CRYPTO PAYMENT (MetaMask + Smart Contract)

### 2.1 Flow End-to-End

```
[User] → Chọn Network (Hardhat/Amoy/BSC)
       → Chọn Token (ETH/MATIC/BNB/USDT)
       → GET /api/payments/crypto/quote
              ↓ backend tính amount_wei
       → [Nếu ERC-20] Approve token cho EscrowCore
       → [Nếu native] Trực tiếp call depositNative
       → Submit TX hash qua guarded payment session
       → TxMonitor worker poll on-chain
       → Khi confirmed → UPDATE orders.status = 'PAID'
       → Seller nhận tiền từ EscrowCore
```

### 2.2 Lỗi Hiện Tại và Fix

| # | Lỗi | Nguyên nhân | Fix |
|---|-----|-------------|-----|
| 1 | **Payment-api crash** (Restarting loop) | `connectRedis()` throw → `process.exit(1)` | ✅ DONE: Redis optional at startup |
| 2 | **ESCROW_CONTRACT_LOCALHOST sai** | `0x5fbdb2315678b000000000000000000000000000` (truncated) | Fix trong `.env` VPS |
| 3 | **ESCROW_CONTRACT_POLYGON_AMOY sai** | `0xcde08be019048000000000000000000000000000` (truncated) | Fix trong `.env` VPS |
| 4 | **Giá hiển thị 0** | API không trả về → frontend không có fallback | Thêm skeleton loading + retry |
| 5 | **Redis WRONGPASS** | Password không khớp giữa Redis container và service | ✅ Đã fix Redis password |
| 6 | **Hardhat healthcheck timeout** | Quá chậm npm install | ✅ DONE: start_period 300s |

### 2.3 Variables cần set đúng trong VPS `.env`

```env
# Escrow contracts (địa chỉ đầy đủ, không truncate)
ESCROW_CONTRACT_LOCALHOST=0x5FbDB2315678afecb367f032d93F642f64180aa3
ESCROW_CONTRACT_POLYGON_AMOY=0xCDE08Be0190482691b3288C27240378497d74E79
BLOCKCHAIN_PRIVATE_KEY=<private_key_của_operator>
```

### 2.4 docker-compose.prod.yml — Variables cần chuyển sang ${VAR}

```yaml
# THAY (hardcoded truncated) → (từ .env)
ESCROW_CONTRACT_LOCALHOST: ${ESCROW_CONTRACT_LOCALHOST}
ESCROW_CONTRACT_POLYGON_AMOY: ${ESCROW_CONTRACT_POLYGON_AMOY}
PAYPAL_CLIENT_ID: ${PAYPAL_CLIENT_ID}   # Bị truncate hiện tại!
```

### 2.5 Checkout Page — Các điểm cần hoàn thiện

```
[Step 1: Chọn phương thức]
  ├── Crypto (MetaMask)
  └── PayPal ← THÊM MỚI

[Step 2 Crypto: Chọn Network]
  ├── Hardhat VPS (31337) — FREE TEST ← UI OK
  ├── Polygon Amoy (80002) ← UI OK
  └── BNB Testnet (97) ← UI OK

[Step 2 PayPal: PayPal Buttons] ← XÂY MỚI

[Step 3 Crypto: Chọn Token + Số lượng]
  - Hiện/thị amount_token từ quote ← fix null check
  - Loading skeleton khi đang fetch quote ← thêm mới

[Step 4 Crypto: Submit TX]
  - Approve ERC-20 (nếu cần) ← đã có
  - Call depositNative / deposit ← đã có
  - Submit hash ← đã có
  - Polling trạng thái ← đã có
```

---

## 3. MODULE 2: PAYPAL INTEGRATION

### 3.1 Flow

```
[User] → Checkout → Chọn PayPal
       → POST /api/payments/paypal/create-order  (backend)
              ↓ PayPal API tạo order
       → Redirect user đến PayPal approval_url
       → User approve trên PayPal
       → PayPal redirect về /orders/:id?paypal_token=XXX&PayerID=YYY
       → Frontend gọi POST /api/payments/paypal/capture
       → Order status = 'PAID'
```

### 3.2 Hiện trạng Backend

- ✅ `paypal.service.ts` — đầy đủ: createOrder, capturePayment, webhook
- ✅ `paypal.routes.ts` — routes đã có
- ✅ `paypal.controller.ts` — controller đã có
- ⚠️ `PAYPAL_CLIENT_ID` bị truncate trong docker-compose!
- ❌ `PAYPAL_SECRET` chưa có trên VPS `.env`
- ❌ Frontend không có PayPal button/flow

### 3.3 PayPal Keys Status

| Key | Local `.env` | Docker Compose | VPS `.env` |
|-----|-------------|----------------|-----------|
| PAYPAL_CLIENT_ID | Có | **Bị truncate (22 chars)** | ❌ Chưa có |
| PAYPAL_SECRET | Có | `${PAYPAL_SECRET}` | ❌ Chưa có |
| PAYPAL_MODE | - | `sandbox` | ❌ Chưa có |
| PAYPAL_WEBHOOK_ID | Chưa có | Chưa có | ❌ Chưa có |

### 3.4 Frontend Components cần xây

```
1. PayPalButton component (frontend/components/payment/PayPalButton.tsx)
   - Dùng @paypal/react-paypal-js hoặc redirect flow
   - Call backend → lấy approval_url → redirect

2. Checkout page — Step 1: thêm tab "PayPal"
   - Nếu order.product_metadata.accepted_tokens.fiat includes 'paypal'

3. Orders page — handle ?paypal_token=XXX khi return từ PayPal
   - Tự động capture và show success
```

---

## 4. MODULE 3: QR DEPOSIT (Nạp tiền vào ví)

### 4.1 Flow

```
[User đăng nhập + có wallet MetaMask đã link]
→ /wallet hoặc /profile → tab "Nạp tiền / Deposit"
→ Hiện QR code = địa chỉ ví MetaMask của user
→ Hiện info từng mạng: Network name, Chain ID, Token list, RPC URL
→ User copy địa chỉ hoặc scan QR từ ví khác/sàn ngoài
→ (Optional) Theo dõi deposit history
```

### 4.2 DB Schema — Đã có sẵn!

```sql
-- users.wallet_address VARCHAR(42) UNIQUE  ← địa chỉ ví đã link
-- user_wallets table  ← multi-wallet support
-- wallet_deposits table ← lịch sử deposit
```

### 4.3 Chức năng Backend cần thêm

```
GET /api/wallet/deposit-info    → lấy ví user + network info
GET /api/wallet/deposits        → lịch sử nạp
POST /api/wallet/link           → link ví MetaMask mới
```

### 4.4 Frontend Components

```
/wallet page hoặc /profile?tab=wallet
  ├── WalletConnectSection   — Connect + link MetaMask ← dùng RainbowKit
  ├── DepositQRCard          — QR code + copy address ← dùng qrcode.react
  ├── NetworkInfoTable       — Bảng mạng + token info
  └── DepositHistoryTable    — Lịch sử nạp gần đây
```

---

## 5. CẤU TRÚC TRIỂN KHAI

### Phase 1 — Fix Infrastructure (Ngay bây giờ!)
```
1. Fix docker-compose: escrow contract addresses → ${VAR}
2. Thêm PAYPAL_CLIENT_ID, PAYPAL_SECRET đúng vào VPS .env
3. Thêm ESCROW_CONTRACT_* đúng vào VPS .env
4. CI/CD build xong → services up (Redis fix đã commit)
```

### Phase 2 — PayPal Frontend (½ ngày)
```
1. Thêm PayPal tab vào checkout page Step 1
2. Tạo PayPalCheckoutFlow component
3. Handle return URL trên orders page
4. Test với PayPal sandbox
```

### Phase 3 — QR Deposit (½ ngày)
```
1. Backend: wallet endpoints (link wallet, deposit info)
2. Frontend: /wallet page với QR code
3. Test với MetaMask kết nối
```

### Phase 4 — Polish & Testing (¼ ngày)
```
1. Loading states + error handling đầy đủ
2. Test toàn bộ flow crypto + paypal + qr
3. Fix giá hiển thị 0 (null safety)
```

---

## 6. CHECKLIST TRƯỚC KHI BẮT ĐẦU CODE

- [ ] Bạn cung cấp PAYPAL_CLIENT_ID đầy đủ (80 chars)
- [ ] Bạn cung cấp PAYPAL_SECRET
- [ ] Xác nhận địa chỉ EscrowCore trên Hardhat: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- [ ] Xác nhận địa chỉ EscrowCore trên Amoy: `0xCDE08Be0190482691b3288C27240378497d74E79`
- [ ] CI/CD build xong (check GitHub Actions)
