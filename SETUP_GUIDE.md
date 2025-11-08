# Hướng dẫn Cài đặt và Chạy Dự án

## Yêu cầu Hệ thống

- Node.js 20+
- PostgreSQL 16+ (port 5432, password: 1)
- MongoDB 7+ (port 27017)
- Redis 7+ (port 6379)
- Docker & Docker Compose (tùy chọn)

## Cài đặt Nhanh

### 1. Clone và Cài đặt Dependencies

```bash
cd C:\Users\kien\Documents\FYP

# Install shared dependencies
cd shared
npm install
npm run build

# Install root dependencies
cd ..
npm install

# Install all services (tự động)
npm run install:all
```

### 2. Cấu hình Environment Variables

Tạo file `.env` trong thư mục gốc (copy từ `env.example`):

```bash
cp env.example .env
```

**Lưu ý quan trọng:** 
- PostgreSQL password mặc định là: `1`
- MongoDB không cần password (local)
- Điền API keys cho các service OAuth, payment nếu muốn sử dụng

### 3. Khởi tạo Database

```bash
# PostgreSQL - chạy script init
psql -U postgres -f scripts/init-postgres.sql

# MongoDB sẽ tự động tạo databases khi chạy services
```

### 4. Chạy Dự án

#### Option A: Chạy với Docker (Khuyến nghị)

```bash
# Build và start tất cả services
docker-compose up -d

# Xem logs
docker-compose logs -f

# Stop tất cả
docker-compose down
```

#### Option B: Chạy Local (Development)

Mở nhiều terminal và chạy từng service:

```bash
# Terminal 1 - API Gateway
cd services/api-gateway
npm run dev

# Terminal 2 - Auth Service  
cd services/auth-service
npm run dev

# Terminal 3 - User Service
cd services/user-service
npm run dev

# Terminal 4 - Coin Market Service
cd services/coin-market-service
npm run dev

# Terminal 5 - Product Service
cd services/product-service
npm run dev

# Terminal 6 - Frontend
cd frontend
npm run dev
```

## URLs Sau Khi Chạy

- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:3000
- **Auth Service**: http://localhost:3001
- **User Service**: http://localhost:3002
- **Product Service**: http://localhost:3003
- **Coin Market Service**: http://localhost:3004
- **Order Service**: http://localhost:3005
- **Payment Service**: http://localhost:3006
- **Blockchain Service**: http://localhost:3007
- **Chat Service**: http://localhost:3008
- **Social Service**: http://localhost:3009
- **AI Service**: http://localhost:3010
- **Notification Service**: http://localhost:3011

## API Endpoints Chính

### Authentication
- `POST /api/v1/auth/register` - Đăng ký
- `POST /api/v1/auth/login` - Đăng nhập
- `POST /api/v1/auth/verify-email` - Xác minh email
- `GET /api/v1/auth/google` - Đăng nhập Google
- `GET /api/v1/auth/facebook` - Đăng nhập Facebook

### Coins
- `GET /api/v1/coins/top10` - Lấy top 10 đồng coin
- `GET /api/v1/coins/search?q=bitcoin` - Tìm kiếm coin
- `GET /api/v1/coins/:coinId` - Chi tiết coin
- `GET /api/v1/coins/:coinId/history` - Lịch sử giá

### Products
- `GET /api/v1/products` - Danh sách sản phẩm
- `GET /api/v1/products/:id` - Chi tiết sản phẩm
- `POST /api/v1/products` - Tạo sản phẩm (cần auth)
- `GET /api/v1/products/search?q=keyword` - Tìm kiếm

### Users
- `GET /api/v1/users/profile` - Profile người dùng
- `PUT /api/v1/users/profile` - Cập nhật profile
- `POST /api/v1/users/become-seller` - Đăng ký seller

## Testing

### Test API với curl

```bash
# Health check
curl http://localhost:3000/health

# Get top 10 coins
curl http://localhost:3000/api/v1/coins/top10

# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test@123",
    "fullName": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123"
  }'
```

## Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Reset password if needed
ALTER USER postgres WITH PASSWORD '1';
```

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Start MongoDB if not running
mongod
```

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
redis-server
```

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F
```

## Development Tips

### Hot Reload
Tất cả services đều có hot reload khi chạy với `npm run dev`

### Database Migrations
```bash
cd services/auth-service
npm run migrate
```

### Clear Cache
```bash
# Clear Redis cache
redis-cli FLUSHALL
```

### Reset Database
```bash
# PostgreSQL
psql -U postgres -f scripts/init-postgres.sql

# MongoDB
mongosh
use coin_market_db
db.dropDatabase()
```

## Production Deployment

### Build for Production
```bash
npm run build
```

### Docker Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

## Support

Nếu gặp vấn đề, check logs:
```bash
# Docker logs
docker-compose logs -f [service-name]

# Service logs
tail -f services/*/logs/*.log
```

