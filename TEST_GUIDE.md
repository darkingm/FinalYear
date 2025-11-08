# 🧪 HƯỚNG DẪN KIỂM TRA DỰ ÁN

## 📋 CHECKLIST KIỂM TRA

### Bước 1: Kiểm tra cài đặt
```bash
# Kiểm tra Node.js
node --version  # Phải >= 18.x

# Kiểm tra npm
npm --version   # Phải >= 9.x

# Kiểm tra Docker
docker --version
docker-compose --version

# Kiểm tra PostgreSQL
psql --version

# Kiểm tra MongoDB
mongosh --version
```

---

## 🚀 KHỞI ĐỘNG DỰ ÁN

### Option 1: Sử dụng Docker (KHUYẾN NGHỊ)

```bash
# Bước 1: Vào thư mục dự án
cd C:\Users\kien\Documents\FYP

# Bước 2: Copy file .env
copy env.example .env

# Bước 3: Khởi động tất cả services
docker-compose up -d

# Bước 4: Kiểm tra status
docker-compose ps

# Bước 5: Xem logs
docker-compose logs -f

# Hoặc xem log từng service
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
docker-compose logs -f product-service
```

### Option 2: Chạy thủ công (Development)

#### Terminal 1: PostgreSQL
```bash
# Đã cài sẵn, kiểm tra:
psql -U postgres
# Password: 1
```

#### Terminal 2: MongoDB
```bash
# Đã cài sẵn, kiểm tra:
mongosh
```

#### Terminal 3: Redis
```bash
docker run -d -p 6379:6379 redis:alpine
```

#### Terminal 4: RabbitMQ
```bash
docker run -d -p 5672:5672 -p 15672:15672 rabbitmq:management-alpine
```

#### Terminal 5-15: Backend Services
```bash
# Cửa sổ 5: API Gateway
cd services/api-gateway
npm install
npm run dev

# Cửa sổ 6: Auth Service
cd services/auth-service
npm install
npm run dev

# Cửa sổ 7: User Service
cd services/user-service
npm install
npm run dev

# Cửa sổ 8: Product Service
cd services/product-service
npm install
npm run dev

# Cửa sổ 9: Coin Market Service
cd services/coin-market-service
npm install
npm run dev

# Cửa sổ 10: Order Service
cd services/order-service
npm install
npm run dev

# Cửa sổ 11: Payment Service
cd services/payment-service
npm install
npm run dev

# Cửa sổ 12: Blockchain Service
cd services/blockchain-service
npm install
npm run dev

# Cửa sổ 13: Chat Service
cd services/chat-service
npm install
npm run dev

# Cửa sổ 14: Social Service
cd services/social-service
npm install
npm run dev

# Cửa sổ 15: AI Analysis Service
cd services/ai-analysis-service
npm install
npm run dev
```

#### Terminal 16: Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ✅ KIỂM TRA SERVICES

### 1. Health Check - Kiểm tra tất cả services

```bash
# API Gateway (Port 3000)
curl http://localhost:3000/health

# Auth Service (Port 3001)
curl http://localhost:3001/health

# User Service (Port 3002)
curl http://localhost:3002/health

# Product Service (Port 3003)
curl http://localhost:3003/health

# Coin Market Service (Port 3004)
curl http://localhost:3004/health

# Order Service (Port 3005)
curl http://localhost:3005/health

# Payment Service (Port 3006)
curl http://localhost:3006/health

# Blockchain Service (Port 3007)
curl http://localhost:3007/health

# Chat Service (Port 3008)
curl http://localhost:3008/health

# Social Service (Port 3009)
curl http://localhost:3009/health

# AI Analysis Service (Port 3010)
curl http://localhost:3010/health
```

**Kết quả mong đợi:**
```json
{
  "status": "OK",
  "service": "service-name"
}
```

---

## 🧪 TEST TỪNG SERVICE

### 1. AUTH SERVICE

#### A. Đăng ký User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!@#",
    "fullName": "Test User"
  }'
```

**Kết quả:** Nhận email OTP (hoặc log trong console)

#### B. Verify OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

#### C. Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

**Lưu access_token để dùng cho các request sau!**

---

### 2. USER SERVICE

#### A. Lấy Profile
```bash
curl http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### B. Cập nhật Profile
```bash
curl -X PUT http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Updated Name",
    "bio": "My bio",
    "phone": "0123456789"
  }'
```

#### C. Đăng ký Seller
```bash
curl -X POST http://localhost:3000/api/v1/sellers/apply \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopName": "My Shop",
    "shopDescription": "Best shop ever",
    "businessType": "individual",
    "businessAddress": "123 Main St",
    "phoneNumber": "0123456789",
    "bankName": "Vietcombank",
    "bankAccountNumber": "1234567890",
    "bankAccountName": "Test User"
  }'
```

---

### 3. PRODUCT SERVICE

#### A. Lấy danh sách Products
```bash
curl http://localhost:3000/api/v1/products
```

#### B. Tìm kiếm Product
```bash
curl "http://localhost:3000/api/v1/products/search?q=laptop"
```

#### C. Tạo Product (Seller only)
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MacBook Pro",
    "description": "Latest model",
    "price": 2000,
    "priceInCrypto": 0.05,
    "cryptoSymbol": "BTC",
    "category": "electronics",
    "condition": "new",
    "stock": 10,
    "images": ["image1.jpg"]
  }'
```

---

### 4. COIN MARKET SERVICE

#### A. Lấy Top 10 Coins
```bash
curl http://localhost:3000/api/v1/coins/top
```

#### B. Lấy chi tiết Coin
```bash
curl http://localhost:3000/api/v1/coins/bitcoin
```

---

### 5. ORDER SERVICE

#### A. Thêm vào Cart
```bash
curl -X POST http://localhost:3000/api/v1/cart/add \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID",
    "quantity": 1
  }'
```

#### B. Xem Cart
```bash
curl http://localhost:3000/api/v1/cart \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### C. Checkout
```bash
curl -X POST http://localhost:3000/api/v1/orders/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shippingAddress": {
      "fullName": "Test User",
      "phone": "0123456789",
      "address": "123 Main St",
      "city": "Ho Chi Minh",
      "country": "Vietnam"
    },
    "paymentMethod": "stripe"
  }'
```

---

### 6. PAYMENT SERVICE

#### A. Tạo Payment Intent (Stripe)
```bash
curl -X POST http://localhost:3000/api/v1/payments/create-intent \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID",
    "amount": 2000
  }'
```

#### B. Tạo P2P Trade
```bash
curl -X POST http://localhost:3000/api/v1/payments/p2p/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID",
    "amount": 2000,
    "currency": "USD",
    "cryptoAmount": 0.05,
    "cryptoSymbol": "BTC"
  }'
```

---

### 7. BLOCKCHAIN SERVICE

#### A. Tạo Wallet
```bash
curl -X POST http://localhost:3000/api/v1/blockchain/wallets/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID"
  }'
```

#### B. Mint Token (Tokenize Asset)
```bash
curl -X POST http://localhost:3000/api/v1/blockchain/tokens/mint \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PRODUCT_ID",
    "ownerId": "USER_ID",
    "ownerAddress": "0x...",
    "name": "MacBook Pro NFT",
    "symbol": "MBP",
    "assetDescription": "MacBook Pro tokenized",
    "assetValue": 2000,
    "assetImages": ["image.jpg"]
  }'
```

#### C. Transfer Token
```bash
curl -X POST http://localhost:3000/api/v1/blockchain/tokens/transfer \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "TOKEN_ID",
    "fromAddress": "0x...",
    "toAddress": "0x...",
    "fromUserId": "USER_ID_1",
    "toUserId": "USER_ID_2"
  }'
```

---

### 8. CHAT SERVICE

#### A. Tạo Support Ticket
```bash
curl -X POST http://localhost:3000/api/v1/chat/tickets/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Need help",
    "priority": "MEDIUM"
  }'
```

#### B. Gửi Message
```bash
curl -X POST http://localhost:3000/api/v1/chat/tickets/TICKET_ID/messages \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, I need help"
  }'
```

---

### 9. SOCIAL SERVICE

#### A. Tạo Post
```bash
curl -X POST http://localhost:3000/api/v1/social/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My first post!",
    "visibility": "PUBLIC"
  }'
```

#### B. Comment vào Post
```bash
curl -X POST http://localhost:3000/api/v1/social/posts/POST_ID/comments \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Nice post!"
  }'
```

#### C. Like Post
```bash
curl -X POST http://localhost:3000/api/v1/social/posts/POST_ID/like \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 10. AI ANALYSIS SERVICE

#### A. Lấy Market Analysis
```bash
curl http://localhost:3000/api/v1/analysis
```

#### B. Lấy Analysis của 1 Coin
```bash
curl http://localhost:3000/api/v1/analysis/bitcoin
```

#### C. Lấy Daily Report
```bash
curl http://localhost:3000/api/v1/reports/latest
```

---

## 🔍 KIỂM TRA LOGS

### Docker Logs
```bash
# Xem tất cả logs
docker-compose logs

# Xem logs real-time
docker-compose logs -f

# Xem log 1 service
docker-compose logs -f auth-service

# Xem 100 dòng log cuối
docker-compose logs --tail=100 auth-service
```

### Manual Logs
- Mỗi service sẽ in log ra console
- Kiểm tra từng terminal window
- Tìm từ khóa: "error", "failed", "exception"

---

## ⚠️ XỬ LÝ LỖI THƯỜNG GẶP

### 1. Port đã được sử dụng
```bash
# Tìm process đang dùng port
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

### 2. Database connection failed
```bash
# Kiểm tra PostgreSQL
psql -U postgres -c "SELECT 1"

# Kiểm tra MongoDB
mongosh --eval "db.version()"
```

### 3. Redis connection failed
```bash
# Restart Redis
docker restart redis
```

### 4. Module not found
```bash
# Cài lại dependencies
cd services/SERVICE_NAME
npm install
```

---

## 📊 KIỂM TRA DATABASE

### PostgreSQL
```bash
psql -U postgres
# Password: 1

# Xem databases
\l

# Kết nối database
\c auth_db

# Xem tables
\dt

# Query users
SELECT * FROM users LIMIT 5;
```

### MongoDB
```bash
mongosh

# Xem databases
show dbs

# Sử dụng database
use product_db

# Xem collections
show collections

# Query products
db.products.find().limit(5)
```

---

## 🌐 KIỂM TRA FRONTEND

```bash
# Mở browser
http://localhost:5173

# Các trang cần test:
- Homepage (/)
- Login (/auth)
- Products (/products)
- Cart (/cart)
- Checkout (/checkout)
- Profile (/profile)
- Seller Apply (/seller/apply)
- Admin Dashboard (/dashboard/admin)
- Support Dashboard (/dashboard/support)
```

---

## ✅ CHECKLIST CUỐI CÙNG

- [ ] Tất cả 11 services health check OK
- [ ] Frontend load thành công
- [ ] Đăng ký user thành công
- [ ] Login thành công
- [ ] Xem products thành công
- [ ] Thêm vào cart thành công
- [ ] Checkout thành công
- [ ] Tạo wallet blockchain thành công
- [ ] Mint token thành công
- [ ] Chat service hoạt động
- [ ] Social posts hoạt động
- [ ] AI analysis có data

---

## 🎯 KẾT QUẢ MONG ĐỢI

Nếu mọi thứ OK:
- ✅ 11 services chạy không lỗi
- ✅ Frontend hiển thị đẹp
- ✅ Login/Register hoạt động
- ✅ Top 10 coins hiển thị
- ✅ Products hiển thị
- ✅ Cart/Checkout hoạt động
- ✅ Blockchain tokenization hoạt động

**DỰ ÁN SẴN SÀNG DEMO!** 🚀


