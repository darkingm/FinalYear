# Giải Thích Chi Tiết Blockchain Service

## Tổng Quan

Blockchain Service là một microservice cho phép ứng dụng tương tác **TRỰC TIẾP** với các blockchain networks như Ethereum, BSC, Polygon, Bitcoin, v.v. Service này không phải là mock hay simulation, mà thực sự kết nối và thực hiện các giao dịch trên blockchain thật.

## Kiến Trúc

### 1. Provider Pattern (Mẫu Nhà Cung Cấp)

Service sử dụng **Provider Pattern** để hỗ trợ nhiều loại blockchain khác nhau:

```
BaseProvider (Interface)
    ├── EVMProvider (cho Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche)
    └── BitcoinProvider (cho Bitcoin network)
```

**Tại sao cần Provider Pattern?**
- Mỗi blockchain có cách hoạt động khác nhau:
  - **EVM chains** (Ethereum, BSC, Polygon): Sử dụng accounts, nonce, gas
  - **Bitcoin**: Sử dụng UTXO model, không có accounts

### 2. MultiChainService - Điều Phối Viên

`MultiChainService` là service trung tâm quản lý các providers:

```typescript
// Khi cần tương tác với một network
const provider = MultiChainService.getProvider('ethereum_mainnet');
// Provider sẽ được cache để tái sử dụng
```

**Chức năng:**
- Tự động chọn provider phù hợp (EVM hoặc Bitcoin)
- Cache providers để tối ưu hiệu suất
- Quản lý kết nối RPC

### 3. Các Service Chính

#### A. BalanceService - Lấy Số Dư

**Cách hoạt động:**
1. Nhận request: `getBalance(networkId, address)`
2. Lấy provider từ MultiChainService
3. Gọi RPC endpoint của blockchain:
   - **EVM**: `eth_getBalance(address)` qua ethers.js
   - **Bitcoin**: Query BlockCypher API hoặc Bitcoin RPC
4. Trả về số dư đã format

**Ví dụ thực tế:**
```typescript
// User muốn xem số dư ETH
const balance = await BalanceService.getBalance('ethereum_mainnet', '0x123...');
// Service sẽ:
// 1. Kết nối đến Ethereum RPC (Infura, Alchemy, hoặc public RPC)
// 2. Gọi eth_getBalance('0x123...')
// 3. Nhận kết quả: 1000000000000000000 wei
// 4. Convert sang ETH: 1.0 ETH
// 5. Trả về cho user
```

#### B. TransferService - Gửi Coin/Token

**Cách hoạt động (EVM):**
1. Nhận request với: `networkId`, `fromAddress`, `toAddress`, `amount`, `privateKey`
2. Lấy provider (EVMProvider)
3. Tạo wallet từ privateKey: `new ethers.Wallet(privateKey, provider)`
4. Lấy nonce: `provider.getTransactionCount(address)`
5. Lấy gas price: `provider.getFeeData()`
6. Tạo transaction object:
   ```typescript
   {
     to: toAddress,
     value: ethers.parseEther(amount), // Convert ETH sang wei
     gasLimit: 21000,
     gasPrice: gasPrice,
     nonce: nonce
   }
   ```
7. Ký transaction: `wallet.signTransaction(tx)`
8. Gửi lên blockchain: `wallet.sendTransaction(tx)`
9. Đợi confirmation: `txResponse.wait()`
10. Lưu transaction vào database

**Ví dụ thực tế:**
```typescript
// User muốn gửi 0.1 ETH từ ví A sang ví B
await TransferService.transferNative(
  'ethereum_mainnet',
  '0xAAA...', // from
  '0xBBB...', // to
  '0.1',      // amount
  '0xPRIVATE_KEY...' // private key (đã decrypt)
);

// Service sẽ:
// 1. Kết nối đến Ethereum RPC
// 2. Tạo transaction với nonce, gas price
// 3. Ký transaction bằng private key
// 4. Broadcast lên Ethereum network
// 5. Nhận txHash: 0xabc123...
// 6. Đợi block confirmation
// 7. Transaction được ghi vào blockchain vĩnh viễn
```

**Cách hoạt động (Bitcoin):**
1. Lấy UTXOs (Unspent Transaction Outputs) của địa chỉ
2. Tạo PSBT (Partially Signed Bitcoin Transaction)
3. Thêm inputs (UTXOs) và outputs (recipient + change)
4. Tính phí (fee)
5. Ký transaction bằng private key
6. Finalize và extract transaction hex
7. Broadcast lên Bitcoin network qua BlockCypher API

#### C. SwapService - Hoán Đổi Token

**Cách hoạt động:**
1. User muốn swap: 1 ETH → USDT
2. Service gọi **1inch API** (DEX Aggregator) để lấy quote:
   ```
   GET https://api.1inch.io/v5.0/1/quote
   ?fromTokenAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeeE (ETH)
   &toTokenAddress=0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
   &amount=1000000000000000000 (1 ETH in wei)
   ```
3. 1inch trả về:
   - Số USDT nhận được: 2500 USDT
   - Gas estimate: 150000
   - Price impact: 0.1%
   - Router address: 0x1111... (1inch router)
4. Service lấy swap transaction data:
   ```
   GET https://api.1inch.io/v5.0/1/swap
   ?fromTokenAddress=...
   &toTokenAddress=...
   &amount=...
   &fromAddress=0xUSER...
   &slippage=1
   ```
5. 1inch trả về transaction data:
   ```json
   {
     "tx": {
       "to": "0x1111...", // 1inch router
       "data": "0xabc123...", // Encoded function call
       "value": "1000000000000000000", // ETH amount
       "gas": "150000",
       "gasPrice": "20000000000"
     },
     "toTokenAmount": "2500000000" // USDT in smallest unit
   }
   ```
6. Nếu là token (không phải native), cần approve trước:
   ```typescript
   tokenContract.approve(routerAddress, amount)
   ```
7. Gửi transaction swap:
   ```typescript
   wallet.sendTransaction({
     to: routerAddress,
     data: swapData.tx.data,
     value: swapData.tx.value,
     gasLimit: swapData.tx.gas
   })
   ```
8. Transaction được gửi lên blockchain
9. 1inch router tự động:
   - Nhận ETH từ user
   - Tìm best route qua các DEX (Uniswap, Sushiswap, etc.)
   - Swap ETH → USDT
   - Gửi USDT về cho user

**Ví dụ thực tế:**
```
User: Swap 1 ETH → USDT trên Ethereum
Service flow:
1. Get quote từ 1inch: 1 ETH = 2500 USDT
2. User approve
3. Execute swap transaction
4. Transaction hash: 0xdef456...
5. Đợi confirmation (12-15 giây)
6. User nhận 2500 USDT trong ví
```

## Kết Nối Blockchain Thực Tế

### RPC Endpoints

Service kết nối đến **real blockchain nodes** qua RPC:

**EVM Chains:**
- **Ethereum**: `https://mainnet.infura.io/v3/YOUR_KEY` hoặc `https://eth.llamarpc.com`
- **BSC**: `https://bsc-dataseed.binance.org`
- **Polygon**: `https://polygon-rpc.com`
- **Arbitrum**: `https://arb1.arbitrum.io/rpc`

**Bitcoin:**
- BlockCypher API: `https://api.blockcypher.com/v1/btc/main`
- Hoặc Bitcoin Core RPC: `http://localhost:8332`

### Libraries Sử Dụng

1. **ethers.js v6**: Tương tác với EVM chains
   - Tạo wallets
   - Gửi transactions
   - Đọc smart contracts
   - Query blockchain data

2. **bitcoinjs-lib**: Tương tác với Bitcoin
   - Tạo addresses
   - Tạo và ký transactions
   - Xử lý UTXOs

3. **axios**: Gọi APIs (1inch, BlockCypher)

## Luồng Hoạt Động Tổng Thể

### 1. Tạo Ví (Create Wallet)

```
User Request → MultiChainService.createWallet()
    ↓
Generate private key (random)
    ↓
Create address từ private key:
  - EVM: ethers.Wallet.createRandom()
  - Bitcoin: bitcoinjs-lib keypair → address
    ↓
Encrypt private key
    ↓
Lưu vào database (MongoDB)
    ↓
Return address cho user
```

### 2. Kiểm Tra Số Dư

```
User Request → BalanceService.getBalance()
    ↓
Get provider từ MultiChainService
    ↓
Call RPC:
  - EVM: provider.getBalance(address)
  - Bitcoin: BlockCypher API
    ↓
Format và return balance
```

### 3. Gửi Coin

```
User Request → TransferService.transferNative()
    ↓
Decrypt private key từ database
    ↓
Create wallet: new ethers.Wallet(privateKey, provider)
    ↓
Get nonce, gas price từ blockchain
    ↓
Create transaction object
    ↓
Sign transaction (wallet.signTransaction)
    ↓
Send to blockchain (wallet.sendTransaction)
    ↓
Wait for confirmation (tx.wait())
    ↓
Save transaction to database
    ↓
Return txHash
```

### 4. Swap Token

```
User Request → SwapService.swap()
    ↓
Get quote from 1inch API
    ↓
Check approval (nếu là token)
    ↓
Approve nếu cần
    ↓
Get swap transaction data from 1inch
    ↓
Execute swap transaction
    ↓
Wait for confirmation
    ↓
Update balances
    ↓
Return result
```

## Bảo Mật

### Private Keys

- **Lưu trữ**: Encrypted trong database
- **Sử dụng**: Chỉ decrypt khi cần ký transaction
- **Không bao giờ**: Log hoặc expose private keys

### Transaction Signing

- Tất cả transactions được ký **offline** (trong service)
- Private key không bao giờ gửi lên blockchain
- Chỉ transaction đã ký được gửi lên network

## Database Models

### Wallet Model
```typescript
{
  userId: string,
  addresses: [{
    networkId: string, // 'ethereum_mainnet', 'bsc_mainnet', etc.
    address: string,
    encryptedPrivateKey: string,
    balance: string,
    tokenBalances: [...]
  }]
}
```

### Transaction Model
```typescript
{
  txHash: string,
  networkId: string,
  from: string,
  to: string,
  value: string,
  type: 'TRANSFER_NATIVE' | 'TRANSFER_TOKEN' | 'SWAP',
  status: 'PENDING' | 'CONFIRMED' | 'FAILED',
  blockNumber: number,
  gasUsed: number
}
```

## API Endpoints

### Wallet
- `POST /api/wallets` - Tạo wallet
- `GET /api/wallets/:userId` - Lấy wallet của user
- `GET /api/wallets/:networkId/:address/balance` - Lấy số dư

### Transfer
- `POST /api/transfers/native` - Gửi native coin
- `POST /api/transfers/token` - Gửi token

### Swap
- `GET /api/swaps/quote` - Lấy quote
- `POST /api/swaps` - Thực hiện swap

## Tóm Tắt

**Blockchain Service CÓ tương tác trực tiếp với blockchain:**
- ✅ Kết nối đến real RPC nodes
- ✅ Gửi transactions thật lên blockchain
- ✅ Đọc dữ liệu từ blockchain
- ✅ Sử dụng real DEX aggregators (1inch) cho swap
- ✅ Transactions được ghi vào blockchain vĩnh viễn

**Không phải:**
- ❌ Mock data
- ❌ Simulation
- ❌ Test network only (hỗ trợ cả mainnet và testnet)

**Lưu ý quan trọng:**
- Cần RPC endpoints hợp lệ (Infura, Alchemy, hoặc public RPCs)
- Cần private keys thật để ký transactions
- Mỗi transaction tốn gas fees thật
- Transactions không thể hoàn tác (irreversible)

