# Web3 Cryptocurrency E-commerce Platform

A production-grade hybrid e-commerce marketplace supporting both Web3 cryptocurrency payments (MetaMask) and traditional PayPal payments, with multi-language support, real-time crypto prices, and comprehensive features.

## 🏗️ Architecture

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Framer Motion
- **Backend**: Node.js + Express.js (2 microservices: Main + Payment Service)
- **Database**: PostgreSQL
- **Message Queue**: RabbitMQ (event-driven architecture)
- **Caching**: Redis
- **Web3**: ethers.js v6, WalletConnect v2, MetaMask SDK
- **Smart Contracts**: Solidity + Hardhat
- **Payments**: PayPal REST API + Smart Contract escrow

## 🚀 Features

### Authentication
- ✅ Email/Password registration with CAPTCHA
- ✅ Google OAuth login
- ✅ Facebook OAuth login
- ✅ MetaMask wallet login (Sign-In with Ethereum - EIP-4361)

### Homepage
- ✅ Time-based greeting (Good Morning/Afternoon/Evening)
- ✅ Total balance in USDT with real-time conversion
- ✅ Individual coin holdings with logos
- ✅ Real-time cryptocurrency prices (Binance WebSocket)
- ✅ Smooth animations (Framer Motion)

### UX Features
- ✅ Dark/Light mode toggle
- ✅ Language switcher (Vietnamese/English) - instant toggle
- ✅ Responsive design

### E-commerce
- ✅ Product listing with image upload
- ✅ Seller can choose accepted payment methods (crypto tokens + PayPal)
- ✅ Dual payment flow (cryptocurrency or PayPal)
- ✅ Order tracking with state machine
- ✅ Inventory management with optimistic locking

### Payment Methods
- ✅ Cryptocurrency payments (USDT, USDC, DAI, etc.)
- ✅ PayPal integration
- ✅ Smart contract escrow for trustless transactions

## 📦 Project Structure

```
fyp-ecommerce/
├── frontend/              # Next.js 14 application
├── backend/
│   ├── main-service/      # Core marketplace API
│   └── payment-service/   # Payment processing
├── contracts/             # Smart contracts (Solidity)
├── docker/                # Docker Compose setup
└── docs/                  # Documentation
```

## 🛠️ Setup Instructions (Windows 11)

### Prerequisites

1. **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
2. **Docker Desktop**: Download from [docker.com](https://www.docker.com/products/docker-desktop)
3. **PostgreSQL**: Included in Docker Compose
4. **MetaMask**: Browser extension from [metamask.io](https://metamask.io/)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd FYP
```

2. **Install dependencies**

Frontend:
```bash
cd frontend
npm install
```

Backend - Main Service:
```bash
cd backend/main-service
npm install
```

Backend - Payment Service:
```bash
cd backend/payment-service
npm install
```

Smart Contracts:
```bash
cd contracts
npm install
```

3. **Configure environment variables**

Create `.env` files in each service (see `.env.example` files):

- `frontend/.env`
- `backend/main-service/.env`
- `backend/payment-service/.env`

4. **Start services with Docker**

```bash
cd docker
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- RabbitMQ (port 5672, management UI: 15672)
- Main API (port 3001)
- Payment API (port 3002)
- Frontend (port 3000)

5. **Initialize database**

The database schema will be automatically initialized from `init_database.sql` on first run.

6. **Deploy smart contracts (optional for development)**

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network polygon-mumbai
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Main API**: http://localhost:3001
- **Payment API**: http://localhost:3002
- **RabbitMQ Management**: http://localhost:15672 (user: marketplace, pass: secure_password)

## 🔑 Configuration

### Required API Keys

1. **Google OAuth**
   - Create app at [Google Cloud Console](https://console.cloud.google.com/)
   - Add to `frontend/.env`: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

2. **Facebook OAuth**
   - Create app at [Facebook Developers](https://developers.facebook.com/)
   - Add to `frontend/.env`: `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`

3. **hCaptcha**
   - Sign up at [hCaptcha](https://www.hcaptcha.com/)
   - Add to `frontend/.env`: `NEXT_PUBLIC_HCAPTCHA_SITEKEY`

4. **PayPal**
   - Create app at [PayPal Developer](https://developer.paypal.com/)
   - Add to `backend/payment-service/.env`: `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET`

5. **AWS S3** (for product images)
   - Create bucket at [AWS Console](https://aws.amazon.com/)
   - Add to `backend/main-service/.env`: `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## 🧪 Testing

Run tests for each service:

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend/main-service
npm test

cd backend/payment-service
npm test

# Smart contract tests
cd contracts
npx hardhat test
```

## 📚 Documentation

- [API Documentation](docs/API.md)
- [Web3 Payment Flows](docs/WEB3_FLOWS.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🔒 Security

- Non-custodial wallet architecture
- JWT authentication with refresh tokens
- Rate limiting (100 req/min per IP)
- SQL injection prevention (parameterized queries)
- XSS protection (DOMPurify)
- Smart contract audited (OpenZeppelin standards)

## 🤝 Contributing

This is a final year project (FYP). For questions or contributions, please contact the project maintainers.

## 📄 License

MIT License - see LICENSE file for details
