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

## 🗄️ Database Strategy (Thực tế)

### PostgreSQL (ACID Transactions)
Sử dụng cho dữ liệu cần tính toàn vẹn cao:

**Auth Service:**
- **auth_db** (Port 5432):
  - Users: id, email, username, password, fullName, role (ADMIN/SUPPORT/USER/SELLER), isEmailVerified, lastLoginAt
  - RefreshTokens: Token management, revocation tracking
  - OTP: Email/SMS verification
  - OAuthProviders: Google, Facebook, Microsoft integration

- **user_db** (Port 5433):
  - UserProfiles: Full user profiles, seller info, bank verification, KYC
  - Wallets: Multi-coin wallets (BTC, ETH, etc.)
  - Transactions: User transaction history
  - FavoriteProducts: Product bookmarks

**Order Service:**
- **order_db** (Port 5432):
  - Orders: Order details, shipping, tracking
  - OrderItems: Line items per order
  - Cart: Shopping cart items
  - Vouchers: Discount codes, usage tracking
  - Payments: Payment records, transaction IDs
  - P2PTrade: Peer-to-peer cryptocurrency trades

**Ưu điểm:**
- ACID compliance
- Foreign key constraints
- Complex joins
- Data integrity
- Scalability with read replicas

### MongoDB (Flexible Schema)
Sử dụng cho dữ liệu phi cấu trúc và high-throughput reads:

**Product Service:**
- **product_db**:
  - Products: title, description, images, priceInCoins, priceInUSD, coinSymbol, quantity, status, tokenized, tokenAddress
  - Categories: Product categories and subcategories
  - Shops: Seller shop profiles, ratings, business hours
  - Coins: Cryptocurrency metadata (CoinGecko data)
  - PriceHistory: Historical price data for analytics

**Chat Service:**
- **chat_db**:
  - ChatRooms: Support and customer service rooms
  - Messages: Chat message history with WebSocket support
  - SocialPosts: User posts, comments, likes
  - Notifications: Real-time notifications

**AI Analysis Service:**
- **ai_analysis_db**:
  - AnalysisReports: AI-generated market analysis
  - PriceForecasts: Predictive analytics
  - CoinResearch: Detailed coin research reports

**Ưu điểm:**
- Flexible schema
- Horizontal scaling via sharding
- Fast read/write for high-throughput data
- TTL indexes for automatic cleanup
- Aggregation pipeline for complex queries

### Redis (Caching & Sessions)
- Session storage (JWT tokens, user sessions)
- Token blacklist (revoked tokens)
- Rate limiting (API requests per user)
- Price cache (Top 10 coins, real-time prices)
- API response cache (product listings, search results)
- Distributed locks (prevent duplicate orders)

**Ưu điểm:**
- In-memory speed (microseconds)
- TTL support (automatic expiration)
- Pub/Sub (real-time notifications)
- Atomic operations (safe concurrent writes)

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

## 🏗️ Service Details - Cấu trúc Thực tế

### 1. Auth Service (PostgreSQL - auth_db + user_db)
**Trách nhiệm:**
- User registration/login
- OTP verification (email/SMS)
- OAuth (Google, Facebook, Microsoft)
- JWT token management
- Password reset
- User profile management
- Bank verification
- KYC verification

**Database:**
- **auth_db**: Users, RefreshTokens, OTP, OAuthProviders
- **user_db**: UserProfiles, Wallets, Transactions, FavoriteProducts

**API Endpoints:**
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/verify-email`
- GET `/api/auth/google`
- POST `/api/auth/refresh-token`
- GET `/api/users/profile`
- PUT `/api/users/profile`
- POST `/api/users/become-seller`
- POST `/api/users/verify-bank`

### 2. Product Service (MongoDB)
**Trách nhiệm:**
- Product CRUD
- Category management
- Search (keyword + semantic)
- Image upload
- Product reviews
- Coin price fetching from CoinGecko
- Real-time price updates

**Database:**
- **product_db**: Products, Categories, Shops, Coins, PriceHistory

**API Endpoints:**
- GET `/api/products`
- POST `/api/products`
- GET `/api/products/:id`
- GET `/api/products/search`
- GET `/api/coins/top10`
- GET `/api/coins/:id`
- GET `/api/coins/:id/history`

### 3. Order Service (PostgreSQL - order_db)
**Trách nhiệm:**
- Shopping cart management
- Order creation and processing
- Order tracking
- Shipping management
- Voucher management
- Payment integration

**Database:**
- **order_db**: Orders, OrderItems, Cart, Vouchers, VoucherUsage, Payments, P2PTrade

**API Endpoints:**
- GET `/api/orders/cart`
- POST `/api/orders/cart/add`
- POST `/api/orders/checkout`
- GET `/api/orders/:id`
- POST `/api/payments/card`
- POST `/api/payments/p2p/create`
- POST `/api/payments/p2p/submit-proof`
- GET `/api/vouchers/:code`

### 4. Blockchain Service (Custom)
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

### 5. Chat Service (MongoDB)
**Trách nhiệm:**
- Customer support chat
- Real-time messaging (WebSocket)
- Chat history
- Support agent assignment
- Social Posts
- Comments and likes

**Database:**
- **chat_db**: ChatRooms, Messages, SocialPosts, Notifications

**API Endpoints:**
- POST `/api/chat/rooms`
- POST `/api/chat/messages`
- GET `/api/chat/rooms/:id/messages`
- WebSocket: `/ws/chat`
- POST `/api/social/posts`
- POST `/api/social/posts/:id/comment`
- POST `/api/social/posts/:id/like`

### 6. AI Analysis Service (MongoDB)
**Trách nhiệm:**
- Market analysis (OpenAI)
- Price predictions
- Automated reports
- Coin research
- Portfolio analysis

**Database:**
- **ai_analysis_db**: AnalysisReports, PriceForecasts, CoinResearch

**API Endpoints:**
- POST `/api/ai/analyze`
- GET `/api/ai/reports/latest`
- POST `/api/ai/search`

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

