# TokenAsset - Cryptocurrency Trading Platform

TokenAsset is a comprehensive microservices-based cryptocurrency trading platform with features including user authentication, product marketplace, order management, payment processing, blockchain integration, AI analysis, and social features.

## 🏗️ Architecture

This project follows a microservices architecture with the following services:

- **API Gateway** (Port 3000) - Central entry point for all client requests
- **Auth Service** (Port 3001) - User authentication, registration, OTP, OAuth
- **User Service** (Port 3002) - User profiles, seller applications, bank verification
- **Product Service** (Port 3003) - Product listings and management
- **Coin Market Service** (Port 3004) - Cryptocurrency market data
- **Order Service** (Port 3005) - Order processing and management
- **Payment Service** (Port 3006) - Payment gateway integration
- **Blockchain Service** (Port 3007) - Blockchain interactions
- **Chat Service** (Port 3008) - Real-time messaging
- **Social Service** (Port 3009) - Social features and feeds
- **AI Analysis Service** (Port 3010) - AI-powered market analysis

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
cd services/auth-service
npm install
cd ../..

cd services/user-service
npm install
cd ../..

cd services/api-gateway
npm install
cd ../..

# Repeat for other services as needed
```

### Step 3: Setup PostgreSQL Databases

Make sure PostgreSQL is running on port **5433**. Create the required databases:

```sql
-- Connect to PostgreSQL
psql -U postgres -p 5433

-- Create databases
CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE order_db;
CREATE DATABASE payment_db;

-- Exit
\q
```

### Step 4: Initialize Database Tables

Run the initialization SQL scripts:

```bash
# For Auth Service
psql -U postgres -p 5433 -d auth_db -f services/auth-service/src/database/init.sql

# For User Service
psql -U postgres -p 5433 -d user_db -f services/user-service/src/database/init.sql
```

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

# PostgreSQL (Port 5433!)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB_AUTH=auth_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

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

#### User Service
```bash
# Create .env file in services/user-service/
cp services/user-service/.env.example services/user-service/.env
```

Edit `services/user-service/.env`:
```env
NODE_ENV=development
USER_SERVICE_PORT=3002

# PostgreSQL (Port 5433!)
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB_USER=user_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

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
USER_SERVICE_URL=http://localhost:3002

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

You need to start each service in a separate terminal window:

#### Terminal 1 - API Gateway
```bash
cd services/api-gateway
npm run dev
```

#### Terminal 2 - Auth Service
```bash
cd services/auth-service
npm run dev
```

#### Terminal 3 - User Service
```bash
cd services/user-service
npm run dev
```

#### Terminal 4 - Frontend
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

# Check User Service
curl http://localhost:3002/health
```

### Step 8: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

## 🔧 Troubleshooting

### PostgreSQL Connection Issues

If you see "Connection refused" errors:

1. Verify PostgreSQL is running on port 5433:
   ```bash
   netstat -an | findstr 5433
   ```

2. Check PostgreSQL service status:
   ```bash
   # Windows
   sc query postgresql-x64-14
   
   # Or check in Services app
   ```

3. Verify database exists:
   ```bash
   psql -U postgres -p 5433 -l
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
   psql -U postgres -p 5433 -d auth_db -f services/auth-service/src/database/init.sql
   psql -U postgres -p 5433 -d user_db -f services/user-service/src/database/init.sql
   ```

2. Verify tables were created:
   ```bash
   psql -U postgres -p 5433 -d auth_db
   \dt
   ```

### Registration/Login Not Working

1. Check all services are running (API Gateway, Auth Service, User Service)
2. Verify PostgreSQL databases are created and tables exist
3. Check browser console for errors
4. Check service logs for error messages
5. Ensure JWT secrets match between services
6. Verify CORS settings allow frontend origin

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
