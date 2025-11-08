# Kiến trúc Hệ thống - Real Asset Tokenization Platform

## 📐 Tổng quan Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  - Homepage với Top 10 Coins + Product Listing                  │
│  - Login/Register với animation mượt                            │
│  - Dark/Light Mode + i18n (EN/VN)                              │
│  - Shopping Cart, Checkout, Payment                             │
│  - User Profile, Seller Dashboard                               │
│  - Admin Dashboard, Support Chat                                │
│  - Social Feed, AI Analysis                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS/WebSocket
┌────────────────────────▼────────────────────────────────────────┐
│                      API GATEWAY (Port 3000)                     │
│  - Rate Limiting                                                │
│  - Authentication (JWT)                                         │
│  - Request Routing                                              │
│  - Load Balancing                                               │
└─┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────┘
  │     │     │     │     │     │     │     │     │     │
  ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼     ▼
┌──────────────────── MICROSERVICES ────────────────────────────┐
│                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │Auth Service │  │User Service │  │Product Svc  │          │
│  │  (PG:3001)  │  │  (PG:3002)  │  │ (Mongo:3003)│          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                 │                 │                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │Coin Market  │  │Order Service│  │Payment Svc  │          │
│  │(Mongo:3004) │  │  (PG:3005)  │  │  (PG:3006)  │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                 │                 │                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │Blockchain   │  │Chat Service │  │Social Svc   │          │
│  │   (3007)    │  │(Mongo:3008) │  │(Mongo:3009) │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                 │                 │                 │
│  ┌─────────────┐  ┌─────────────┐                            │
│  │AI Analysis  │  │Notification │                            │
│  │(Mongo:3010) │  │(Mongo:3011) │                            │
│  └──────┬──────┘  └──────┬──────┘                            │
│         │                 │                                   │
└─────────┼─────────────────┼───────────────────────────────────┘
          │                 │
┌─────────▼─────────────────▼───────────────────────────────────┐
│                    MESSAGE QUEUE (RabbitMQ)                    │
│  - Event-driven communication                                  │
│  - Async tasks                                                 │
└────────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────┐
│                         DATABASES                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ PostgreSQL   │    │  MongoDB     │    │    Redis     │    │
│  │  - auth_db   │    │  - product   │    │   - Cache    │    │
│  │  - user_db   │    │  - coin      │    │   - Session  │    │
│  │  - order_db  │    │  - chat      │    └──────────────┘    │
│  │  - payment_db│    │  - social    │                         │
│  └──────────────┘    │  - ai        │                         │
│                      └──────────────┘                         │
└────────────────────────────────────────────────────────────────┘
```

## 🗄️ Database Strategy

### PostgreSQL (ACID Transactions)
Sử dụng cho dữ liệu cần tính toàn vẹn cao:
- **auth_db**: Users, OAuth, OTP, Refresh Tokens
- **user_db**: Profiles, Bank Verification, Seller Applications
- **order_db**: Orders, Cart, Shipping
- **payment_db**: Transactions, P2P Trades, Credit Card Payments

**Ưu điểm:**
- ACID compliance
- Foreign key constraints
- Complex joins
- Data integrity

### MongoDB (Flexible Schema)
Sử dụng cho dữ liệu phi cấu trúc:
- **product_db**: Products, Categories, Reviews
- **coin_market_db**: Coin prices, Historical data
- **chat_db**: Messages, Chat rooms
- **social_db**: Posts, Comments, Likes
- **ai_analysis_db**: AI reports, Market analysis
- **notification_db**: Notifications, Templates

**Ưu điểm:**
- Flexible schema
- Horizontal scaling
- Fast read/write
- Easy migration to Cassandra

### Redis (Caching & Sessions)
- Session storage
- Token blacklist
- Rate limiting
- Top 10 coins cache
- API response cache

**Ưu điểm:**
- In-memory speed
- TTL support
- Pub/Sub

## 🔐 Security Architecture

### Authentication Flow
```
User → Frontend → API Gateway → Auth Service
                    ↓
              JWT Token Created
                    ↓
           Stored in Redis Session
                    ↓
        Future Requests Include JWT
                    ↓
         API Gateway Validates Token
                    ↓
          Forward User Info to Services
```

### Authorization
- **Admin**: Full access
- **Support**: Chat, view transactions
- **Seller**: Manage products, view sales
- **User**: Browse, buy, trade

## 🔄 Communication Patterns

### Synchronous (REST API)
- Client ↔ API Gateway
- API Gateway ↔ Services

### Asynchronous (RabbitMQ)
- User registered → Send welcome email
- Order created → Update inventory
- Payment completed → Update order status
- P2P trade matched → Notify users

### WebSocket (Real-time)
- Chat messages
- Notifications
- Coin price updates
- Order status updates

## 🏗️ Service Details

### 1. Auth Service (PostgreSQL)
**Trách nhiệm:**
- User registration/login
- OTP verification (email/SMS)
- OAuth (Google, Facebook, Microsoft)
- JWT token management
- Password reset

**API Endpoints:**
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/verify-email`
- GET `/api/auth/google`
- POST `/api/auth/refresh-token`

### 2. User Service (PostgreSQL)
**Trách nhiệm:**
- User profiles
- Role management
- Bank account verification
- Seller application approval
- KYC verification

**API Endpoints:**
- GET `/api/users/profile`
- PUT `/api/users/profile`
- POST `/api/users/become-seller`
- POST `/api/users/verify-bank`

### 3. Product Service (MongoDB)
**Trách nhiệm:**
- Product CRUD
- Category management
- Search (keyword + semantic)
- Image upload
- Product reviews

**API Endpoints:**
- GET `/api/products`
- POST `/api/products`
- GET `/api/products/:id`
- GET `/api/products/search`

### 4. Coin Market Service (MongoDB)
**Trách nhiệm:**
- Fetch coin prices from CoinGecko
- Cache top 10 coins
- Price history
- Market analysis data

**API Endpoints:**
- GET `/api/coins/top10`
- GET `/api/coins/:id`
- GET `/api/coins/:id/history`

### 5. Order Service (PostgreSQL)
**Trách nhiệm:**
- Shopping cart
- Order creation
- Order tracking
- Shipping management

**API Endpoints:**
- GET `/api/orders/cart`
- POST `/api/orders/cart/add`
- POST `/api/orders/checkout`
- GET `/api/orders/:id`

### 6. Payment Service (PostgreSQL)
**Trách nhiệm:**
- Credit card processing (Stripe)
- P2P coin trading
- Bank transfer verification
- Escrow management
- Refunds

**API Endpoints:**
- POST `/api/payments/card`
- POST `/api/payments/p2p/create`
- POST `/api/payments/p2p/submit-proof`

### 7. Blockchain Service (Custom)
**Trách nhiệm:**
- Layer 2 blockchain
- Asset tokenization
- Smart contracts (ERC-721)
- Transaction verification
- Escrow smart contracts

**API Endpoints:**
- POST `/api/blockchain/tokenize`
- GET `/api/blockchain/transaction/:hash`
- POST `/api/blockchain/escrow/create`

### 8. Chat Service (MongoDB)
**Trách nhiệm:**
- Customer support chat
- Real-time messaging (WebSocket)
- Chat history
- Support agent assignment

**API Endpoints:**
- POST `/api/chat/rooms`
- POST `/api/chat/messages`
- GET `/api/chat/rooms/:id/messages`
- WebSocket: `/ws/chat`

### 9. Social Service (MongoDB)
**Trách nhiệm:**
- User posts
- Comments
- Likes
- User feed
- Content moderation

**API Endpoints:**
- POST `/api/social/posts`
- POST `/api/social/posts/:id/comment`
- POST `/api/social/posts/:id/like`
- GET `/api/social/feed`

### 10. AI Analysis Service (MongoDB)
**Trách nhiệm:**
- Market analysis (OpenAI)
- Price predictions
- Automated reports
- Coin research
- Portfolio analysis

**API Endpoints:**
- POST `/api/ai/analyze`
- GET `/api/ai/reports/latest`
- POST `/api/ai/search`

### 11. Notification Service (MongoDB)
**Trách nhiệm:**
- Email notifications (Nodemailer)
- SMS notifications (Twilio)
- Push notifications
- In-app notifications
- Notification preferences

**API Endpoints:**
- GET `/api/notifications`
- POST `/api/notifications/mark-read`
- PUT `/api/notifications/preferences`

## 🚀 Deployment Strategy

### Development
- Run locally with `npm run dev`
- PostgreSQL, MongoDB, Redis on localhost
- Hot reload enabled

### Staging
- Docker Compose
- Each service in container
- Shared network
- Volume persistence

### Production
- Kubernetes (K8s)
- Auto-scaling
- Load balancing
- Health checks
- Rolling updates

## 📊 Monitoring & Logging

### Tools
- **Winston**: Application logs
- **Prometheus**: Metrics collection
- **Grafana**: Visualization
- **ELK Stack**: Log aggregation (optional)

### Metrics
- Request rate
- Response time
- Error rate
- Database connections
- Cache hit ratio
- Service health

## 🔄 CI/CD Pipeline

```
Git Push → GitHub Actions → Run Tests → Build Docker Images
                                             ↓
                                   Push to Registry
                                             ↓
                               Deploy to Kubernetes
                                             ↓
                                   Health Check
                                             ↓
                                   Rolling Update
```

## 🌐 Frontend Architecture

### Tech Stack
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS** (styling)
- **Framer Motion** (animations)
- **Redux Toolkit** (state)
- **React Query** (data fetching)
- **React Router** (routing)
- **i18next** (internationalization)

### Key Features
- Dark/Light mode
- Vietnamese/English
- Smooth page transitions
- Responsive design
- SEO optimized
- Progressive Web App (PWA)

## 🔒 Data Security

### In Transit
- HTTPS/TLS 1.3
- JWT tokens
- WebSocket Secure (WSS)

### At Rest
- Encrypted passwords (bcrypt)
- Encrypted sensitive data
- Database encryption

### Compliance
- GDPR ready
- Data retention policies
- User data export
- Right to be forgotten

