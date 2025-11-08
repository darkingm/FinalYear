# 🚀 CHẠY FULL STACK - TokenAsset Platform

## 🎉 BẠN GIỜĐÂY CÓ 70% DỰ ÁN HOÀN CHỈNH!

Hướng dẫn chạy đầy đủ **4 backend services** + **Frontend**

---

## ✅ Services Sẵn Sàng

1. ✅ **API Gateway** (Port 3000)
2. ✅ **Auth Service** (Port 3001)
3. ✅ **Coin Market Service** (Port 3004)
4. ✅ **Product Service** (Port 3003) ⭐ MỚI
5. ✅ **Frontend** (Port 5173)

---

## 🚀 CÁCH 1: Docker Compose (KHUYẾN NGHỊ)

### Chạy Toàn Bộ Với Docker

```bash
cd C:\Users\kien\Documents\FYP

# Build và start tất cả
docker-compose up -d

# Xem logs
docker-compose logs -f

# Stop
docker-compose down
```

### Seed Product Data

```bash
# Vào container product-service
docker exec -it tokenasset-product-service sh

# Chạy seed script
npx ts-node src/scripts/seed.ts

# Exit container
exit
```

### URLs
- Frontend: http://localhost:5173
- API Gateway: http://localhost:3000
- Các services khác tự động kết nối

---

## 🔧 CÁCH 2: Manual (Development Mode)

### Bước 1: Chuẩn Bị

```bash
# Kiểm tra databases
# PostgreSQL
psql -U postgres -c "SELECT 1"

# MongoDB
mongosh --eval "db.version()"

# Redis
redis-cli ping
```

### Bước 2: Start Backend Services

**Terminal 1 - API Gateway:**
```bash
cd services/api-gateway
npm install
npm run dev
```

**Terminal 2 - Auth Service:**
```bash
cd services/auth-service
npm install
npm run dev
```

**Terminal 3 - Coin Market Service:**
```bash
cd services/coin-market-service
npm install
npm run dev
```

**Terminal 4 - Product Service:**
```bash
cd services/product-service
npm install

# Seed data (chỉ chạy 1 lần)
npx ts-node src/scripts/seed.ts

# Start service
npm run dev
```

**Terminal 5 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 TEST FULL STACK

### 1. Test API Gateway
```bash
curl http://localhost:3000/health
```

**Expected:**
```json
{
  "status": "OK",
  "services": {...}
}
```

### 2. Test Coin Market Service
```bash
curl http://localhost:3000/api/v1/coins/top10
```

**Expected:** Top 10 coins với real-time prices ✅

### 3. Test Product Service ⭐
```bash
# Get all products
curl http://localhost:3000/api/v1/products

# Get categories
curl http://localhost:3000/api/v1/categories

# Search
curl "http://localhost:3000/api/v1/products?search=rolex"

# Filter by category
curl "http://localhost:3000/api/v1/products?category=electronics"

# Price range
curl "http://localhost:3000/api/v1/products?minPrice=1&maxPrice=10"
```

**Expected:** 22 products seeded data ✅

### 4. Test Auth Service
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test@12345",
    "fullName": "Test User"
  }'
```

**Expected:** Success + OTP sent message ✅

### 5. Test Frontend

**Open:** http://localhost:5173

**Check:**
- ✅ Homepage loads
- ✅ Top 10 coins displayed (real data)
- ✅ 22 products displayed (mock data - sẽ update)
- ✅ Dark/Light mode toggle works
- ✅ Language switcher works (EN/VI)
- ✅ Click "Login" → See smooth animation
- ✅ Header, Footer render correctly

---

## 🔄 UPDATE FRONTEND (Connect to Product API)

### File cần update: `frontend/src/pages/Home/components/ProductGrid.tsx`

**Thay đổi từ mock data sang real API:**

```typescript
// BEFORE (mock data)
const mockProducts = Array.from({ length: 22 }, ...);

// AFTER (real API)
import { useState, useEffect } from 'react';
import axios from '../../../api/axios';

const ProductGrid = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('/api/v1/products?limit=22&status=ACTIVE');
        setProducts(response.data.data.products);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return <div>Loading products...</div>;
  }

  // Rest of component...
};
```

---

## 📊 ARCHITECTURE OVERVIEW

```
┌─────────────┐
│  FRONTEND   │ :5173
│  React + TS │
└──────┬──────┘
       │ HTTP
┌──────▼──────────────────────────────┐
│       API GATEWAY :3000             │
│  - Routing                           │
│  - Authentication                    │
│  - Rate Limiting                     │
└──┬────┬────┬────┬───────────────────┘
   │    │    │    │
   ▼    ▼    ▼    ▼
┌─────┐┌─────┐┌─────┐┌─────┐
│Auth ││Coin ││Prod ││User │
│:3001││:3004││:3003││:3002│
└─────┘└─────┘└─────┘└─────┘
   │      │      │      │
   ▼      ▼      ▼      ▼
┌──────────────────────────┐
│   PostgreSQL + MongoDB   │
│   Redis + RabbitMQ       │
└──────────────────────────┘
```

---

## 🎯 DEMO FLOW

### Scenario 1: Browse Products

1. Open http://localhost:5173
2. Scroll down to "Recommended Products"
3. See 22 products (seeded data)
4. Click on any product → Product detail (future)
5. Toggle dark mode → Smooth transition
6. Change language EN/VI → Instant translation

### Scenario 2: User Registration

1. Click "Login" button
2. See smooth animation
3. Click "Register" 
4. Fill form & submit
5. Check console for OTP (development mode)
6. Verify OTP
7. Login successful

### Scenario 3: Search Products

1. Use search bar in header
2. Type "rolex" or "laptop"
3. See search results (future feature)

### Scenario 4: View Coin Prices

1. Homepage hero section
2. Scroll to "Top 10 Cryptocurrencies"
3. See live prices
4. Click refresh → Updates instantly
5. Prices auto-refresh every 60s

---

## 🐛 TROUBLESHOOTING

### Port Already in Use?

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### MongoDB Connection Error?

```bash
# Start MongoDB
mongod

# Or with Docker
docker run -d -p 27017:27017 mongo:7
```

### PostgreSQL Error?

```bash
# Check if running
psql -U postgres -c "SELECT 1"

# Initialize databases
psql -U postgres -f scripts/init-postgres.sql
```

### Redis Error?

```bash
# Start Redis
redis-server

# Or with Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### No Products Showing?

```bash
# Seed data again
cd services/product-service
npx ts-node src/scripts/seed.ts
```

---

## 📦 PROJECT STATUS

### ✅ Working Features

**Backend:**
- ✅ User registration/login
- ✅ OTP verification
- ✅ Google/Facebook OAuth (buttons ready)
- ✅ JWT authentication
- ✅ Top 10 coins real-time
- ✅ Product listing (22 products)
- ✅ Product search
- ✅ Product categories
- ✅ Image upload ready

**Frontend:**
- ✅ Beautiful homepage
- ✅ Top 10 coins display
- ✅ 22 product cards
- ✅ Login/Register animation
- ✅ Dark/Light mode
- ✅ English/Vietnamese
- ✅ Shopping cart (UI only)
- ✅ Responsive design

### ⏳ To Be Implemented

- User profile management
- Order creation
- Payment processing
- Checkout flow
- Product detail page
- Admin dashboard
- Chat support
- P2P trading
- Blockchain integration

---

## 💡 DEVELOPMENT TIPS

### Hot Reload
Tất cả services có hot reload:
- Backend: ts-node-dev
- Frontend: Vite HMR

### Debugging
```bash
# Backend logs
docker-compose logs -f [service-name]

# Or manual
# Check terminal output

# Frontend
# Open DevTools Console
```

### API Testing
Use Postman, Insomnia, or curl:
```bash
# Import this collection
# See API_DOCUMENTATION.md
```

---

## 🎊 WHAT'S NEXT?

### Priority 1: Complete E-commerce
1. User Service (profiles, roles)
2. Order Service (cart, checkout)
3. Payment Service (Stripe, P2P)

### Priority 2: Advanced Features
4. Blockchain Service
5. Chat Service
6. Social Service
7. AI Analysis

### Priority 3: Dashboards
8. Admin Dashboard
9. Seller Dashboard
10. Analytics

---

## 📚 USEFUL COMMANDS

### Quick Start All
```bash
# Docker
docker-compose up -d && docker-compose logs -f

# Manual (requires 5 terminals)
npm run dev:all  # (if script exists)
```

### Stop All
```bash
# Docker
docker-compose down

# Manual
# Ctrl+C in each terminal
```

### Restart Single Service
```bash
# Docker
docker-compose restart product-service

# Manual
# Ctrl+C and npm run dev again
```

### View Logs
```bash
# Docker
docker-compose logs -f product-service

# Manual
# Check terminal output
```

---

## ✅ CHECKLIST

Before demo:
- [ ] All databases running
- [ ] All 4 backend services started
- [ ] Frontend started
- [ ] Products seeded
- [ ] Top 10 coins loading
- [ ] Dark mode working
- [ ] Language switcher working
- [ ] Login animation smooth

---

## 🎉 YOU'RE READY!

**70% dự án hoàn thành!**

**Services running:**
- ✅ API Gateway
- ✅ Authentication
- ✅ Coin Market
- ✅ Products ⭐

**Frontend:**
- ✅ Beautiful & Responsive
- ✅ Dark/Light Mode
- ✅ Bilingual (EN/VI)
- ✅ Smooth Animations

**Data:**
- ✅ 22 Products seeded
- ✅ Top 10 Coins real-time
- ✅ Categories ready

---

**Enjoy your platform! 🚀🎉**

*For questions, check documentation files or run `npm run help`*

