# Dùng ví MetaMask với tài khoản test (Hardhat / Anvil)

Để thanh toán bằng **token ảo** trên node local (Hardhat/Anvil), cần cấu hình MetaMask và app như sau.

## 1. Thêm mạng Localhost vào MetaMask

1. Mở **MetaMask** → menu (≡) → **Settings** → **Networks** → **Add network** / **Add a network manually**.
2. Điền:
   - **Network name:** `Localhost 8545`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337` (Hardhat mặc định)
   - **Currency symbol:** `ETH`
3. **Save**.

## 2. Import tài khoản test vào MetaMask

Các tài khoản Hardhat/Anvil (có sẵn ETH ảo):

| Account | Address | Private Key (dùng để Import) |
|---------|---------|------------------------------|
| #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

**Cách import:**

1. MetaMask → icon tài khoản (góc trên) → **Import Account**.
2. Chọn **Private Key**, dán một private key ở bảng trên (ví dụ Account #0).
3. **Import** → tài khoản mới sẽ hiện.

**Cảnh báo:** Các private key này là **public** (dùng cho test). Không dùng trên Mainnet hoặc mạng thật; tiền gửi vào sẽ mất.

## 3. Cấu hình app để dùng Localhost

### Backend (payment-service)

- Trong `.env`:
  - `ESCROW_CONTRACT_ADDRESS` = địa chỉ contract escrow bạn deploy trên local (ví dụ từ Hardhat).
  - `LOCALHOST_RPC_URL=http://127.0.0.1:8545` (mặc định, có thể bỏ qua nếu dùng cổng 8545).

### Frontend

- Trong `.env.local` (hoặc `.env`):
  - `NEXT_PUBLIC_ESCROW_CONTRACT_LOCALHOST` = **cùng** địa chỉ escrow (để thanh toán trên chain 31337).

### Database: token trên Localhost (31337)

Để thanh toán bằng token trên local, cần có bản ghi token trên chain **31337** trong `token_whitelist` (địa chỉ token = contract ERC20 bạn deploy trên Hardhat, ví dụ mock USDC):

```sql
-- Thay TOKEN_ADDRESS bằng địa chỉ mock USDC/ERC20 bạn deploy trên Hardhat
INSERT INTO token_whitelist (symbol, token_address, chain_id, decimals, is_active)
VALUES ('USDC', 'TOKEN_ADDRESS', 31337, 6, true)
ON CONFLICT (token_address, chain_id) DO NOTHING;
```

## 4. Seller nhận tiền (user_id 3)

Nếu seller là tài khoản test (ví dụ Account #1) để nhận tiền từ escrow:

```sql
-- set-seller-wallet.sql: đổi thành địa chỉ Hardhat (ví dụ Account #1)
UPDATE users
SET wallet_address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    updated_at = NOW()
WHERE user_id = 3;
```

## 5. Cách thanh toán

1. Chạy node: `npx hardhat node` (hoặc `anvil`).
2. Deploy escrow + mock token (nếu chưa có), cập nhật `.env` và `token_whitelist` như trên.
3. MetaMask: chọn mạng **Localhost 8545** và tài khoản đã import (ví dụ Account #0).
4. Vào app → kết nối ví → tạo đơn → chọn token (USDC trên Localhost) → Lấy báo giá → Thanh toán bằng MetaMask.

Không cần “đổi ví” trong code; chỉ cần **thêm mạng Localhost** và **import tài khoản test** trong MetaMask như bước 1–2.
