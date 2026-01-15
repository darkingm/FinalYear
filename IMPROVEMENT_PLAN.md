# Kế hoạch cải thiện hệ thống - Ecommerce với Coin Payment

## Tổng quan

Cải thiện toàn bộ hệ thống thành một nền tảng ecommerce hoàn chỉnh như Shopee, với tích hợp thanh toán bằng coin, chat realtime, và các tính năng nâng cao.

## Kiến trúc tổng quan

```
Frontend (React)
  ↓
API Gateway (Rate Limiting)
  ↓
Services (Microservices)
  ├── Auth Service (JWT, OAuth)
  ├── User Service (Profiles, Wallet)
  ├── Product Service (Products, Images)
  ├── Order Service (Cart, Orders, Vouchers)
  ├── Payment Service (Coin Payment, P2P)
  ├── Chat Service (Realtime Chat, WebSocket)
  ├── Coin Market Service (Realtime Prices, WebSocket)
  └── Blockchain Service (Swap, Wallet Integration)
```

## Các tính năng cần implement

### 1. Realtime Coin Prices
- WebSocket cho coin prices
- Update giá trong cart/checkout realtime
- Cache prices trong Redis với TTL ngắn

### 2. Database Redesign
- Cải thiện Order schema
- Thêm Voucher/Coupon system
- Product multiple images
- Order history tracking

### 3. Seller Features
- Dashboard cho seller
- Tạo/chỉnh sửa voucher
- Quản lý đơn hàng
- Analytics

### 4. User Dashboard
- Dashboard cá nhân
- Order history chi tiết
- Wallet management
- Statistics

### 5. Cart & Checkout
- Sửa lỗi Add to Cart
- Realtime price calculation
- Voucher application
- Multiple payment methods

### 6. P2P Trading
- Listing view như Binance
- Filter và search
- Order book view
- Trading history

### 7. Wallet Integration
- MetaMask integration
- Coinbase Wallet
- WalletConnect
- Multi-wallet support

### 8. Chat System
- Realtime chat user-seller
- Online status
- Typing indicators
- Message history

### 9. Swap Realtime
- Realtime swap quotes
- Price updates
- Transaction tracking

### 10. Remove Square
- Remove Square page
- Update navigation

## Implementation Plan

### Phase 1: Core Fixes (Priority High)
1. Fix Add to Cart
2. Fix Profile & Order History
3. Realtime coin prices cho checkout

### Phase 2: Database & Data
4. Database redesign
5. Seed data mẫu
6. Multiple product images

### Phase 3: Seller Features
7. Seller dashboard
8. Voucher system
9. Order management

### Phase 4: User Experience
10. User dashboard
11. Wallet integration
12. Chat realtime

### Phase 5: Trading & Payment
13. P2P listing view
14. Swap realtime
15. Payment improvements

### Phase 6: Cleanup
16. Remove Square
17. Final optimizations

