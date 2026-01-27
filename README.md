# TokenAsset - Cryptocurrency Trading Platform

TokenAsset is a comprehensive microservices-based cryptocurrency trading platform with features including user authentication, product marketplace, order management, payment processing, blockchain integration, AI analysis, and social features.

## 🏗️ Architecture

This project follows a microservices architecture with the following services:

- **API Gateway** (Port 3000) - Central entry point for all client requests
- **Auth Service** (Port 3001) - User authentication, registration, OTP, OAuth, user profiles, seller applications, bank verification
- **Product Service** (Port 3003) - Product listings, management, and cryptocurrency market data
- **Order Service** (Port 3005) - Order processing, management, and payment gateway integration (VNPay, PayPal, Stripe)
- **Blockchain Service** (Port 3007) - Blockchain interactions, wallet management, token transfers, swaps
- **Chat Service** (Port 3008) - Real-time messaging, social features, posts, comments, and support tickets
- **AI Analysis Service** (Port 3010) - AI-powered market analysis and reports

**Note:** Some services have been merged for better efficiency:
- User Service functionality is now part of Auth Service
- Coin Market Service functionality is now part of Product Service
- Payment Service functionality is now part of Order Service
- Social Service functionality is now part of Chat Service

## 📋 Prerequisites

Before running this project, ensure you have the following installed:

### Required
- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher) - Running on port **5433**
- **Redis** (v7 or higher) - Running on default port 6379
- **RabbitMQ** (v3.12 or higher) - Running on default port 5672
- **MongoDB** (v6 or higher) - For some services

### Optional
- **Docker** & **Docker Compose** - For containerized deployment
- **Postman** - For API testing

## 🚀 Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd FYP
```

### Step 2: Install Dependencies

Install dependencies for all services:

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install service dependencies
cd services/api-gateway
npm install
cd ../..

cd services/auth-service
npm install
cd ../..

cd services/product-service
npm install
cd ../..

cd services/order-service
npm install
cd ../..

cd services/blockchain-service
npm install
cd ../..

cd services/chat-service
npm install
cd ../..

cd services/ai-analysis-service
npm install
cd ../..
```

### Step 3: Setup PostgreSQL Databases

Make sure PostgreSQL is running on port **5432** (or **5433** if configured differently). Create the required databases:

```sql
-- Connect to PostgreSQL
psql -U postgres -p 5432

-- Create databases
CREATE DATABASE auth_db;
CREATE DATABASE order_db;

-- Exit
\q
```

**Note:** User Service database is merged into auth_db, and Payment Service database is merged into order_db.

### Step 4: Initialize Database Tables

Run the initialization SQL scripts:

```bash
# For Auth Service (includes user tables)
psql -U postgres -p 5432 -d auth_db -f services/auth-service/init.sql

# For Order Service (includes payment tables)
psql -U postgres -p 5432 -d order_db -f services/order-service/database/init.sql
```

**Note:** MongoDB databases will be created automatically when services start.

### Step 5: Configure Environment Variables

Each service needs its own `.env` file. Copy the example files and update them:

#### Auth Service
```bash
# Create .env file in services/auth-service/
cp services/auth-service/.env.example services/auth-service/.env
```

Edit `services/auth-service/.env`:
```env
NODE_ENV=development
AUTH_SERVICE_PORT=3001

# PostgreSQL (Port 5432 or 5433)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB_AUTH=auth_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# User Database (merged into auth service)
POSTGRES_DB_USER=auth_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Email (Optional - for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@tokenasset.com

# Frontend
FRONTEND_URL=http://localhost:5173
```

#### Product Service
```bash
# Create .env file in services/product-service/
cp services/product-service/.env.example services/product-service/.env
```

Edit `services/product-service/.env`:
```env
NODE_ENV=development
PRODUCT_SERVICE_PORT=3003

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=product_db
MONGODB_DB_COIN=coin_market_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

#### Order Service
```bash
# Create .env file in services/order-service/
cp services/order-service/.env.example services/order-service/.env
```

Edit `services/order-service/.env`:
```env
NODE_ENV=development
ORDER_SERVICE_PORT=3005

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=order_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Payment Service (merged) - VNPay
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/payment/vnpay/return
VNPAY_IPN_URL=http://localhost:3005/api/v1/payments/vnpay/ipn

# Payment Service (merged) - PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox

# Payment Service (merged) - Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Frontend
FRONTEND_URL=http://localhost:5173
```

#### Blockchain Service
```bash
# Create .env file in services/blockchain-service/
cp services/blockchain-service/.env.example services/blockchain-service/.env
```

Edit `services/blockchain-service/.env`:
```env
NODE_ENV=development
BLOCKCHAIN_SERVICE_PORT=3007

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=blockchain_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

#### Chat Service
```bash
# Create .env file in services/chat-service/
cp services/chat-service/.env.example services/chat-service/.env
```

Edit `services/chat-service/.env`:
```env
NODE_ENV=development
CHAT_SERVICE_PORT=3008

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=chat_db
MONGODB_DB_SOCIAL=social_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

#### AI Analysis Service
```bash
# Create .env file in services/ai-analysis-service/
cp services/ai-analysis-service/.env.example services/ai-analysis-service/.env
```

Edit `services/ai-analysis-service/.env`:
```env
NODE_ENV=development
AI_SERVICE_PORT=3010

# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=ai_analysis_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

#### API Gateway
```bash
# Create .env file in services/api-gateway/
cp services/api-gateway/.env.example services/api-gateway/.env
```

Edit `services/api-gateway/.env`:
```env
NODE_ENV=development
API_GATEWAY_PORT=3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
PRODUCT_SERVICE_URL=http://localhost:3003
ORDER_SERVICE_URL=http://localhost:3005
BLOCKCHAIN_SERVICE_URL=http://localhost:3007
CHAT_SERVICE_URL=http://localhost:3008
AI_SERVICE_URL=http://localhost:3010

# CORS
CORS_ORIGIN=http://localhost:5173
```

#### Frontend
```bash
# Create .env file in frontend/
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Step 6: Start Services

You can start all services manually or use the provided batch script:

#### Option 1: Using Batch Script (Windows)
```bash
# Run the start-all.bat script
start-all.bat
```

This will automatically start all infrastructure services (Docker) and all microservices.

#### Option 2: Manual Start

Start each service in a separate terminal window:

#### Terminal 1 - Infrastructure (Docker)
```bash
docker-compose up -d postgres mongodb redis rabbitmq
```

#### Terminal 2 - API Gateway
```bash
cd services/api-gateway
npm run dev
```

#### Terminal 3 - Auth Service
```bash
cd services/auth-service
npm run dev
```

#### Terminal 4 - Product Service
```bash
cd services/product-service
npm run dev
```

#### Terminal 5 - Order Service
```bash
cd services/order-service
npm run dev
```

#### Terminal 6 - Blockchain Service
```bash
cd services/blockchain-service
npm run dev
```

#### Terminal 7 - Chat Service
```bash
cd services/chat-service
npm run dev
```

#### Terminal 8 - AI Analysis Service
```bash
cd services/ai-analysis-service
npm run dev
```

#### Terminal 9 - Frontend
```bash
cd frontend
npm run dev
```

### Step 7: Verify Services

Check if all services are running:

```bash
# Check API Gateway
curl http://localhost:3000/health

# Check Auth Service
curl http://localhost:3001/health

# Check Product Service
curl http://localhost:3003/health

# Check Order Service
curl http://localhost:3005/health

# Check Blockchain Service
curl http://localhost:3007/health

# Check Chat Service
curl http://localhost:3008/health

# Check AI Analysis Service
curl http://localhost:3010/health
```

### Step 8: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

## 🔧 Troubleshooting

### PostgreSQL Connection Issues

If you see "Connection refused" errors:

1. Verify PostgreSQL is running on port 5432 (or 5433 if configured):
   ```bash
   netstat -an | findstr 5432
   ```

2. Check PostgreSQL service status:
   ```bash
   # Windows
   sc query postgresql-x64-14
   
   # Or check in Services app
   ```

3. If using Docker, check container status:
   ```bash
   docker ps | findstr postgres
   ```

4. Verify database exists:
   ```bash
   psql -U postgres -p 5432 -l
   ```

### Redis Connection Issues

If Redis connection fails:

1. Check if Redis is running:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. Start Redis if not running:
   ```bash
   # Windows - if installed via MSI
   redis-server
   
   # Or start Redis service
   ```

### RabbitMQ Connection Issues

If RabbitMQ connection fails:

1. Check if RabbitMQ is running:
   ```bash
   # Windows
   rabbitmqctl status
   ```

2. Access RabbitMQ Management UI:
   ```
   http://localhost:15672
   Username: guest
   Password: guest
   ```

### Database Table Issues

If you get "relation does not exist" errors:

1. Make sure you ran the init.sql scripts:
   ```bash
   psql -U postgres -p 5432 -d auth_db -f services/auth-service/init.sql
   psql -U postgres -p 5432 -d order_db -f services/order-service/database/init.sql
   ```

2. Verify tables were created:
   ```bash
   psql -U postgres -p 5432 -d auth_db
   \dt
   ```

3. For MongoDB, databases are created automatically when services connect.

### Registration/Login Not Working

1. Check all services are running (API Gateway, Auth Service, Product Service, Order Service, etc.)
2. Verify PostgreSQL databases are created and tables exist
3. Check browser console for errors
4. Check service logs for error messages
5. Ensure JWT secrets match between API Gateway and Auth Service
6. Verify CORS settings allow frontend origin
7. Ensure Redis and RabbitMQ are running

## 📚 Additional Documentation

- [Docker Setup Guide](./DOCKER_SETUP.md) - How to run with Docker
- [API Testing Guide](./POSTMAN_TESTING.md) - How to test APIs with Postman
- [Architecture Documentation](./ARCHITECTURE.md) - Detailed system architecture

## 🛠️ Technology Stack

### Frontend
- React 18
- TypeScript
- Redux Toolkit
- Tailwind CSS
- Vite

### Backend
- Node.js
- Express.js
- TypeScript
- Sequelize (PostgreSQL ORM)
- Mongoose (MongoDB ODM)

### Databases
- PostgreSQL (User data, transactions)
- MongoDB (Products, chats, social data)
- Redis (Caching, sessions)

### Message Queue
- RabbitMQ (Event-driven communication)

### Authentication
- JWT (Access & Refresh tokens)
- Passport.js (OAuth - Google, Facebook, Microsoft)
- OTP (Email & SMS verification)

## 📝 License

This project is licensed under the MIT License.

## 👥 Contributors

- Your Name - Initial work

## 🤝 Support

For issues and questions, please create an issue in the repository.
