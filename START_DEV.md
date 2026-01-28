# 🚀 Quick Start Guide - Development Mode

## Prerequisites

- ✅ Node.js 18+
- ✅ Docker Desktop (for Windows 11)
- ✅ Git

---

## Option 1: Start với Docker (Recommended)

### Bước 1: Start Infrastructure Services Only

```powershell
cd docker
docker-compose -f docker-compose.dev.yml up -d
```

Chỉ start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- RabbitMQ (ports 5672, 15672)

**KHÔNG start** frontend/backend services → Chạy bằng `npm run dev` để có hot reload.

### Bước 2: Check Services Running

```powershell
docker ps
```

Hoặc truy cập:
- **RabbitMQ Management**: http://localhost:15672
  - Username: `marketplace`
  - Password: `rabbitmq123`

### Bước 3: Start Backend Main Service

```powershell
cd backend\main-service
npm install
npm run dev
```

Output:
```
[INFO] Main API server running on port 3001
[INFO] Database connected
[INFO] Redis connected
[INFO] RabbitMQ connected
```

### Bước 4: Start Backend Payment Service

```powershell
cd backend\payment-service
npm install
npm run dev
```

Output:
```
[INFO] Payment API server running on port 3002
[INFO] Database connected
[INFO] All workers started successfully
```

### Bước 5: Start Frontend

```powershell
cd frontend
npm install
npm run dev
```

Output:
```
Ready! http://localhost:3000
```

---

## Option 2: Start Manually (Without Docker)

### Install PostgreSQL

**Download**: https://www.postgresql.org/download/windows/

**Setup:**
```powershell
# Create database
psql -U postgres
CREATE DATABASE marketplace_db;
CREATE USER marketplace WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE marketplace_db TO marketplace;
\q

# Initialize schema
psql -U marketplace -d marketplace_db -f init_database.sql
```

### Install Redis

**Download**: https://github.com/microsoftarchive/redis/releases

**Start:**
```powershell
redis-server
```

### Install RabbitMQ

**Download**: https://www.rabbitmq.com/download.html

**Start:**
```powershell
# RabbitMQ sẽ auto-start sau khi cài
# Management UI: http://localhost:15672
```

---

## Environment Variables

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_MAIN_API_URL=http://localhost:3001
NEXT_PUBLIC_PAYMENT_API_URL=http://localhost:3002
NEXT_PUBLIC_BINANCE_WS_URL=wss://stream.binance.com:9443/ws
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=your_hcaptcha_site_key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret

# PayPal
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id

# Blockchain
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_ESCROW_CONTRACT_POLYGON=0x0000000000000000000000000000000000000000
```

### Backend Main Service (`.env`)

```env
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://marketplace:password123@localhost:5432/marketplace_db
REDIS_URL=redis://:redis123@localhost:6379
RABBITMQ_URL=amqp://marketplace:rabbitmq123@localhost:5672

JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

HCAPTCHA_SECRET=your_hcaptcha_secret
```

### Backend Payment Service (`.env`)

```env
NODE_ENV=development
PORT=3002

DATABASE_URL=postgresql://marketplace:password123@localhost:5432/marketplace_db
REDIS_URL=redis://:redis123@localhost:6379
RABBITMQ_URL=amqp://marketplace:rabbitmq123@localhost:5672

PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret
PAYPAL_MODE=sandbox

ESCROW_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

FRONTEND_URL=http://localhost:3000
```

---

## Troubleshooting

### Error: "Cannot connect to database"

```powershell
# Check PostgreSQL is running
docker ps | findstr postgres

# Or if manual install
Get-Service postgresql*
```

### Error: "Redis connection failed"

```powershell
# Check Redis is running
docker ps | findstr redis

# Test connection
redis-cli -a redis123 ping
```

### Error: "Wagmi config error"

✅ **Fixed!** Wagmi v2 API đã được update trong `frontend/lib/web3/config.ts`

### Error: "Cannot find module users.controller"

✅ **Fixed!** Đã tạo file `backend/main-service/src/modules/users/users.controller.ts`

---

## Quick Commands

```powershell
# Stop all Docker services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Restart a service
docker-compose -f docker-compose.dev.yml restart postgres

# Clear all data (WARNING: Deletes database!)
docker-compose -f docker-compose.dev.yml down -v
```

---

## Testing URLs

- **Frontend**: http://localhost:3000
- **Main API Health**: http://localhost:3001/health
- **Payment API Health**: http://localhost:3002/health
- **RabbitMQ Management**: http://localhost:15672

---

## Next Steps

1. ✅ Start infrastructure với Docker
2. ✅ Start backend services với `npm run dev`
3. ✅ Start frontend với `npm run dev`
4. 🌐 Open http://localhost:3000
5. 📝 Register a new account
6. 🔗 Connect MetaMask wallet
7. 💰 View your crypto balances
8. 🛒 Create a product listing

---

## Development Tips

### Hot Reload
- Frontend: Auto reload khi save file
- Backend: ts-node-dev tự restart khi save file

### Database Changes
```powershell
# Apply new migrations
psql -U marketplace -d marketplace_db -f your_migration.sql
```

### View Logs
```powershell
# Docker services
docker-compose -f docker-compose.dev.yml logs -f

# Backend logs
# Check terminal outputs hoặc logs/ folder
```

### Reset Database
```powershell
# Drop and recreate
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres
```

---

Good luck! 🚀
