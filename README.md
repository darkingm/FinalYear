# Real Asset Tokenization Platform / Nền tảng Token hóa Tài sản Thật

## 📋 Tổng quan Dự án

Nền tảng Web Application cho phép token hóa và giao dịch tài sản thật bằng cryptocurrency. Hệ thống được xây dựng theo kiến trúc microservices với khả năng mở rộng cao.

## 🏗️ Kiến trúc Microservices

### Services & Databases

| Service | Database | Port | Mô tả |
|---------|----------|------|-------|
| **API Gateway** | - | 3000 | Kong API Gateway với rate limiting, authentication |
| **Auth Service** | PostgreSQL | 3001 | OTP, Google, Facebook, Microsoft OAuth |
| **User Service** | PostgreSQL | 3002 | User profiles, roles (Admin/Support/User/Seller), bank verification |
| **Product Service** | MongoDB | 3003 | Product listing, search, semantic search |
| **Coin Market Service** | MongoDB | 3004 | Top 10 coin prices, market data caching |
| **Order Service** | PostgreSQL | 3005 | Shopping cart, order management |
| **Payment Service** | PostgreSQL | 3006 | Credit card, P2P trading, bank verification |
| **Blockchain Service** | Custom DB | 3007 | Layer 2 blockchain for transactions |
| **Chat Service** | MongoDB | 3008 | Customer support chat, real-time messaging |
| **Social Service** | MongoDB | 3009 | Posts, comments, user social interactions |
| **AI Analysis Service** | MongoDB | 3010 | AI market analysis, automated reports |
| **Notification Service** | MongoDB | 3011 | Email, SMS, push notifications |

### Database Strategy

- **PostgreSQL**: Transactional data (auth, users, orders, payments) - ACID compliance
- **MongoDB**: Flexible schema data (products, social, chat, market data) - easy to migrate to Cassandra later
- **Custom Blockchain DB**: Immutable transaction ledger

## 🚀 Tech Stack

### Backend
- **Runtime**: Node.js 20.x + TypeScript
- **Framework**: Express.js / NestJS
- **API Gateway**: Kong / Express Gateway
- **Message Queue**: RabbitMQ / Kafka
- **Cache**: Redis
- **Blockchain**: Custom Layer 2 (Ethereum-compatible)

### Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **State Management**: Redux Toolkit / Zustand
- **i18n**: react-i18next (Vietnamese + English)
- **UI Components**: Headless UI, Radix UI

### DevOps
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes (ready)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## 🎨 Features / Tính năng

### 🏠 Homepage
- ✅ Top 10 cryptocurrency prices (real-time)
- ✅ 22+ recommended products with images, prices
- ✅ Keyword & semantic search
- ✅ Dark/Light mode toggle
- ✅ Language switcher (EN/VN)
- ✅ Beautiful footer with contact info
- ✅ Smooth animations

### 🔐 Authentication
- ✅ Email/Password with OTP
- ✅ Google OAuth
- ✅ Facebook OAuth
- ✅ Microsoft Authentication
- ✅ Smooth page transition animations (no reload lag)

### 👤 User Features
- ✅ Profile management
- ✅ Toggle balance/coin visibility
- ✅ Seller registration
- ✅ Bank account verification
- ✅ Transaction history
- ✅ Shopping cart

### 🛒 E-commerce
- ✅ Product listing with coin prices
- ✅ Add to cart
- ✅ Multi-step checkout
- ✅ Payment: Credit card, Coin, P2P
- ✅ Order tracking

### 💰 P2P Trading
- ✅ Buy/Sell coins peer-to-peer
- ✅ Bank account verification
- ✅ Escrow system
- ✅ Transaction verification

### 🔗 Blockchain Integration
- ✅ Custom Layer 2 solution
- ✅ Transparent transaction ledger
- ✅ Smart contracts for escrow
- ✅ Immutable records

### 👥 Social Features
- ✅ Create posts
- ✅ Comment on posts
- ✅ User interactions

### 💬 Customer Support
- ✅ Live chat with support team
- ✅ Support dashboard
- ✅ Chat history

### 🤖 AI Analysis
- ✅ Market analysis reports
- ✅ Coin volume & market cap analysis
- ✅ Automated insights
- ✅ Search AI assistance

### 👨‍💼 Admin Panel
- ✅ User management
- ✅ Seller approval
- ✅ Transaction monitoring
- ✅ Product moderation
- ✅ Analytics dashboard

### 🛡️ Roles & Permissions
- **Admin**: Full system access
- **Support**: Customer chat, view transactions
- **Seller**: Post products, manage shop
- **User**: Browse, buy, trade coins

## 📦 Installation

### Prerequisites
- Node.js 20+
- PostgreSQL (password: 1, default port 5432)
- MongoDB (default port 27017)
- Docker & Docker Compose
- Redis

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd FYP

# Install dependencies for all services
npm run install:all

# Setup environment variables
cp .env.example .env

# Start all services with Docker
docker-compose up -d

# Start frontend
cd frontend
npm run dev
```

## 🐳 Docker Commands

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Rebuild specific service
docker-compose up -d --build [service-name]
```

## ☸️ Kubernetes Deployment

```bash
# Apply all configurations
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services

# Scale service
kubectl scale deployment [service-name] --replicas=3
```

## 🔧 Configuration

### Database Connections
```
PostgreSQL: localhost:5432, password: 1
MongoDB: localhost:27017
Redis: localhost:6379
```

### Environment Variables
See `.env.example` for full configuration

## 📱 Future: Mobile App
- React Native
- Same backend APIs
- Shared business logic

## 🤝 Contributing
Please read CONTRIBUTING.md for development guidelines

## 📄 License
MIT License

## 📞 Contact
- Email: support@tokenasset.com
- Phone: +84 123 456 789
- Address: Ho Chi Minh City, Vietnam

