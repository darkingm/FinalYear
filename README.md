# Web3Market — Hybrid Web3 + E-commerce Platform

A production-grade marketplace combining traditional e-commerce, Web3 crypto payments, real-world-asset tokenization, NFT-backed credit, AI-assisted shopping, and peer-to-peer fiat ↔ crypto trading.

## 🏗️ Architecture

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, TailwindCSS, Framer Motion, RainbowKit + wagmi
- **Backend (4 services)**:
  - `main-service` — marketplace, auth, orders, products, P2P, RWA, NFT, KYC, coupons, admin (Node 22 + Express)
  - `payment-service` — crypto + PayPal payments, escrow projection (Node 22 + Express)
  - `tokenization-service` — RWA tokenization workflow (Node 22 + Express)
  - `ai-service` — shopping assistant, semantic product search (FastAPI + Groq)
- **Database**: PostgreSQL 15 (2 logical DBs: `marketplace_db`, `payment_db`)
- **Message Queue**: RabbitMQ 3 (topic exchange `marketplace`; required in production for order state projection)
- **Caching / Sessions**: Redis 7 (refresh-token rotation, access-token blacklist, hot caches)
- **Web3**: ethers.js v6, viem, wagmi, RainbowKit (MetaMask · Coinbase · WalletConnect)
- **Smart Contracts**: Solidity ^0.8.20 + Hardhat (12 contracts: EscrowCore, RWAFactory, CreditScoreSBT, etc.)
- **Payments**: PayPal REST API + Escrow smart contracts (BSC Testnet, Polygon Amoy, local Hardhat)
- **Infra**: Docker Compose (dev + prod), Nginx reverse proxy + Let's Encrypt SSL, GitHub Actions CI/CD → Docker Hub → VPS

## 🚀 Features

### Authentication
- Email/password + hCaptcha (enforced server-side on register AND login)
- Google + Facebook OAuth
- Wallet sign-in with EIP-4361 (Sign-In with Ethereum)
- Refresh-token rotation in Redis, access-token revocation on logout

### E-commerce
- Product listing with multi-image upload (Cloudinary), edit-in-place for sellers
- Multi-token pricing per product (USDT, USDC, DAI, ETH, BNB, MATIC, …) with live USDT estimate
- Dual checkout (crypto via escrow OR PayPal)
- Order state machine + inventory FOR-UPDATE locking, transactional cart checkout
- Coupons (per-seller scope), reviews, wishlist, addresses

### Web3 / RWA / NFT
- RWA tokenization workflow with on-chain factory + KYC gating
- NFT mint per shipped order (proof-of-purchase) and CreditScoreSBT for AI credit
- Multi-chain support (Hardhat local, BSC Testnet, Polygon Amoy)

### P2P fiat ↔ crypto
- Offer board (BUY/SELL), filters by token / fiat / payment method / amount
- Order flow: place → mark paid → upload proof → confirm → release / dispute
- In-order chat, admin dispute resolution
- 5 fiat currencies (USD, VND, EUR, GBP, SGD), 5 payment rails (Bank, PayPal, MoMo, ZaloPay, Wise)

### AI assistant
- Conversational product search + recommendation (Groq LLaMA models)
- Credit-gated usage tied to NFT ownership

### UX
- Dark/light theme, one-tap VI ↔ EN i18n, real-time Binance ticker bar, whale-tracker side panel

## 📦 Project Structure

```
FYP/
├── frontend/                        # Next.js 16 app
├── backend/
│   ├── main-service/                # Marketplace + auth + P2P + RWA + NFT
│   ├── payment-service/             # Crypto + PayPal payments
│   ├── tokenization-service/        # RWA tokenization workflow
│   └── ai-service/                  # FastAPI shopping assistant
├── contracts/                       # 12 Solidity contracts + Hardhat scripts
├── init_database.sql/migrations/    # SQL migrations (numbered)
├── docker/                          # docker-compose.yml + .prod.yml + nginx
└── docs/                            # Architecture + audit docs
```

## 🛠️ Setup Instructions (Windows 11)

### Prerequisites

1. **Node.js 22+**: Download from [nodejs.org](https://nodejs.org/)
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

## 🧭 Grapuco Reindex

The project now uses one canonical reindex command so the local graph state is easier to inspect and recover:

```powershell
cd frontend
npm run reindex
```

What it does:
- runs `grapuco ingest` from the repo root, falling back to `npx -y @bitsness/grapuco-cli ingest` when the CLI is not installed globally
- writes the latest run result to `.grapuco/status.json`
- records the commit SHA that was indexed

Local hook behavior:
- `.git/hooks/post-commit` should call `scripts/grapuco-reindex.sh`
- if the hook is active, every local commit triggers a background reindex
- if indexing fails, check `.grapuco/status.json` for the last error

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

```
FYP
├─ .cursorrules
├─ backend
│  ├─ main-service
│  │  ├─ Dockerfile
│  │  ├─ logs
│  │  ├─ package-lock.json
│  │  ├─ package.json
│  │  ├─ scripts
│  │  │  ├─ METAMASK-LOCAL-ACCOUNTS.md
│  │  │  ├─ seed-products.js
│  │  │  └─ set-seller-wallet.sql
│  │  ├─ src
│  │  │  ├─ config
│  │  │  │  ├─ database.ts
│  │  │  │  ├─ env.ts
│  │  │  │  ├─ rabbitmq.ts
│  │  │  │  └─ redis.ts
│  │  │  ├─ middleware
│  │  │  │  ├─ auth.middleware.ts
│  │  │  │  └─ error-handler.ts
│  │  │  ├─ modules
│  │  │  │  ├─ auth
│  │  │  │  │  ├─ auth.controller.ts
│  │  │  │  │  ├─ auth.routes.ts
│  │  │  │  │  ├─ auth.service.ts
│  │  │  │  │  └─ wallet-auth.service.ts
│  │  │  │  ├─ inventory
│  │  │  │  │  ├─ inventory.controller.ts
│  │  │  │  │  └─ inventory.routes.ts
│  │  │  │  ├─ orders
│  │  │  │  │  ├─ orders.controller.ts
│  │  │  │  │  └─ orders.routes.ts
│  │  │  │  ├─ products
│  │  │  │  │  ├─ products.controller.ts
│  │  │  │  │  ├─ products.routes.ts
│  │  │  │  │  └─ products.service.ts
│  │  │  │  └─ users
│  │  │  │     ├─ users.controller.ts
│  │  │  │     ├─ users.repository.ts
│  │  │  │     ├─ users.routes.ts
│  │  │  │     └─ users.service.ts
│  │  │  ├─ server.ts
│  │  │  └─ utils
│  │  │     ├─ logger.ts
│  │  │     └─ queue-publisher.ts
│  │  └─ tsconfig.json
│  └─ payment-service
│     ├─ Dockerfile
│     ├─ logs
│     ├─ package-lock.json
│     ├─ package.json
│     ├─ src
│     │  ├─ config
│     │  │  ├─ database.ts
│     │  │  ├─ rabbitmq.ts
│     │  │  └─ redis.ts
│     │  ├─ middleware
│     │  │  └─ error-handler.ts
│     │  ├─ modules
│     │  │  ├─ crypto-payment
│     │  │  │  ├─ crypto-payment.controller.ts
│     │  │  │  ├─ crypto-payment.routes.ts
│     │  │  │  └─ crypto-payment.service.ts
│     │  │  ├─ paypal
│     │  │  │  ├─ paypal.controller.ts
│     │  │  │  ├─ paypal.routes.ts
│     │  │  │  └─ paypal.service.ts
│     │  │  └─ pricing
│     │  │     ├─ binance.service.ts
│     │  │     ├─ pricing.controller.ts
│     │  │     └─ pricing.routes.ts
│     │  ├─ server.ts
│     │  ├─ utils
│     │  │  └─ logger.ts
│     │  └─ workers
│     │     ├─ index.ts
│     │     ├─ inventory-cleaner.worker.ts
│     │     ├─ price-updater.worker.ts
│     │     └─ tx-monitor.worker.ts
│     └─ tsconfig.json
├─ contracts
│  ├─ artifacts
│  │  ├─ @openzeppelin
│  │  │  └─ contracts
│  │  │     ├─ access
│  │  │     │  ├─ AccessControl.sol
│  │  │     │  │  ├─ AccessControl.dbg.json
│  │  │     │  │  └─ AccessControl.json
│  │  │     │  └─ IAccessControl.sol
│  │  │     │     ├─ IAccessControl.dbg.json
│  │  │     │     └─ IAccessControl.json
│  │  │     ├─ interfaces
│  │  │     │  └─ IERC1363.sol
│  │  │     │     ├─ IERC1363.dbg.json
│  │  │     │     └─ IERC1363.json
│  │  │     ├─ token
│  │  │     │  └─ ERC20
│  │  │     │     ├─ IERC20.sol
│  │  │     │     │  ├─ IERC20.dbg.json
│  │  │     │     │  └─ IERC20.json
│  │  │     │     └─ utils
│  │  │     │        └─ SafeERC20.sol
│  │  │     │           ├─ SafeERC20.dbg.json
│  │  │     │           └─ SafeERC20.json
│  │  │     └─ utils
│  │  │        ├─ Context.sol
│  │  │        │  ├─ Context.dbg.json
│  │  │        │  └─ Context.json
│  │  │        ├─ introspection
│  │  │        │  ├─ ERC165.sol
│  │  │        │  │  ├─ ERC165.dbg.json
│  │  │        │  │  └─ ERC165.json
│  │  │        │  └─ IERC165.sol
│  │  │        │     ├─ IERC165.dbg.json
│  │  │        │     └─ IERC165.json
│  │  │        ├─ Pausable.sol
│  │  │        │  ├─ Pausable.dbg.json
│  │  │        │  └─ Pausable.json
│  │  │        └─ ReentrancyGuard.sol
│  │  │           ├─ ReentrancyGuard.dbg.json
│  │  │           └─ ReentrancyGuard.json
│  │  └─ contracts
│  │     └─ EscrowCore.sol
│  │        ├─ EscrowCore.dbg.json
│  │        └─ EscrowCore.json
│  ├─ cache
│  │  └─ solidity-files-cache.json
│  ├─ contracts
│  │  └─ EscrowCore.sol
│  ├─ hardhat.config.ts
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ scripts
│  │  └─ deploy.ts
│  ├─ tsconfig.json
│  └─ typechain-types
│     ├─ @openzeppelin
│     │  ├─ contracts
│     │  │  ├─ access
│     │  │  │  ├─ AccessControl.ts
│     │  │  │  ├─ IAccessControl.ts
│     │  │  │  └─ index.ts
│     │  │  ├─ index.ts
│     │  │  ├─ interfaces
│     │  │  │  ├─ IERC1363.ts
│     │  │  │  └─ index.ts
│     │  │  ├─ token
│     │  │  │  ├─ ERC20
│     │  │  │  │  ├─ IERC20.ts
│     │  │  │  │  ├─ index.ts
│     │  │  │  │  └─ utils
│     │  │  │  │     ├─ index.ts
│     │  │  │  │     └─ SafeERC20.ts
│     │  │  │  └─ index.ts
│     │  │  └─ utils
│     │  │     ├─ index.ts
│     │  │     ├─ introspection
│     │  │     │  ├─ ERC165.ts
│     │  │     │  ├─ IERC165.ts
│     │  │     │  └─ index.ts
│     │  │     ├─ Pausable.ts
│     │  │     └─ ReentrancyGuard.ts
│     │  └─ index.ts
│     ├─ common.ts
│     ├─ contracts
│     │  ├─ EscrowCore.ts
│     │  └─ index.ts
│     ├─ factories
│     │  ├─ @openzeppelin
│     │  │  ├─ contracts
│     │  │  │  ├─ access
│     │  │  │  │  ├─ AccessControl__factory.ts
│     │  │  │  │  ├─ IAccessControl__factory.ts
│     │  │  │  │  └─ index.ts
│     │  │  │  ├─ index.ts
│     │  │  │  ├─ interfaces
│     │  │  │  │  ├─ IERC1363__factory.ts
│     │  │  │  │  └─ index.ts
│     │  │  │  ├─ token
│     │  │  │  │  ├─ ERC20
│     │  │  │  │  │  ├─ IERC20__factory.ts
│     │  │  │  │  │  ├─ index.ts
│     │  │  │  │  │  └─ utils
│     │  │  │  │  │     ├─ index.ts
│     │  │  │  │  │     └─ SafeERC20__factory.ts
│     │  │  │  │  └─ index.ts
│     │  │  │  └─ utils
│     │  │  │     ├─ index.ts
│     │  │  │     ├─ introspection
│     │  │  │     │  ├─ ERC165__factory.ts
│     │  │  │     │  ├─ IERC165__factory.ts
│     │  │  │     │  └─ index.ts
│     │  │  │     ├─ Pausable__factory.ts
│     │  │  │     └─ ReentrancyGuard__factory.ts
│     │  │  └─ index.ts
│     │  ├─ contracts
│     │  │  ├─ EscrowCore__factory.ts
│     │  │  └─ index.ts
│     │  └─ index.ts
│     ├─ hardhat.d.ts
│     └─ index.ts
├─ docker
│  ├─ docker-compose.dev.yml
│  └─ docker-compose.yml
├─ docs
│  ├─ API.md
│  ├─ DEPLOYMENT.md
│  ├─ IMPLEMENTATION_GUIDE.md
│  ├─ init_database.sql
│  ├─ OAUTH_SETUP_GUIDE.md
│  ├─ PROJECT_SUMMARY.md
│  ├─ QUICK_FIX_SUMMARY.md
│  └─ WEB3_FLOWS.md
├─ frontend
│  ├─ .eslintrc.json
│  ├─ app
│  │  ├─ (auth)
│  │  │  ├─ layout.tsx
│  │  │  ├─ login
│  │  │  │  └─ page.tsx
│  │  │  └─ register
│  │  │     └─ page.tsx
│  │  ├─ api
│  │  │  └─ auth
│  │  ├─ checkout
│  │  │  ├─ layout.tsx
│  │  │  └─ [orderId]
│  │  │     ├─ loading.tsx
│  │  │     └─ page.tsx
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  ├─ orders
│  │  │  ├─ page.tsx
│  │  │  └─ [id]
│  │  │     └─ page.tsx
│  │  ├─ page-complete.tsx
│  │  ├─ page.tsx
│  │  ├─ products
│  │  │  ├─ create
│  │  │  │  └─ page.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ [id]
│  │  │     └─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  ├─ trading
│  │  │  └─ [symbol]
│  │  │     └─ page.tsx
│  │  └─ wallet
│  │     └─ page.tsx
│  ├─ components
│  │  ├─ charts
│  │  │  └─ CoinChart.tsx
│  │  ├─ home
│  │  │  ├─ CategoriesSection.tsx
│  │  │  ├─ CoinGrid.tsx
│  │  │  ├─ FeaturedProducts.tsx
│  │  │  ├─ HeroSection.tsx
│  │  │  ├─ HowItWorks.tsx
│  │  │  └─ StatsSection.tsx
│  │  ├─ layout
│  │  │  ├─ Footer.tsx
│  │  │  ├─ Header.tsx
│  │  │  └─ Sidebar.tsx
│  │  ├─ order
│  │  │  ├─ OrderStepper.tsx
│  │  │  └─ OrderTimeline.tsx
│  │  ├─ product
│  │  │  ├─ ImageGallery.tsx
│  │  │  ├─ ProductReviews.tsx
│  │  │  └─ RelatedProducts.tsx
│  │  ├─ providers.tsx
│  │  ├─ realtime
│  │  │  └─ PriceTicker.tsx
│  │  ├─ search
│  │  │  └─ SearchBar.tsx
│  │  ├─ ui
│  │  │  ├─ Badge.tsx
│  │  │  ├─ button.tsx
│  │  │  ├─ input.tsx
│  │  │  ├─ language-switcher.tsx
│  │  │  ├─ loading-spinner.tsx
│  │  │  ├─ Modal.tsx
│  │  │  ├─ Progress.tsx
│  │  │  ├─ Skeleton.tsx
│  │  │  └─ theme-toggle.tsx
│  │  └─ wallet
│  │     ├─ BalanceOverview.tsx
│  │     ├─ CoinCard.tsx
│  │     └─ LinkWalletSection.tsx
│  ├─ Dockerfile
│  ├─ lib
│  │  ├─ api
│  │  │  ├─ auth.ts
│  │  │  ├─ binance-detail.ts
│  │  │  ├─ binance.ts
│  │  │  ├─ client.ts
│  │  │  ├─ orders.ts
│  │  │  ├─ payments.ts
│  │  │  └─ products.ts
│  │  ├─ hooks
│  │  │  ├─ useAuth.ts
│  │  │  ├─ useCryptoPrice.ts
│  │  │  ├─ useCryptoPriceOptimized.ts
│  │  │  └─ useWallet.ts
│  │  ├─ i18n
│  │  │  ├─ config.ts
│  │  │  └─ locales
│  │  │     ├─ en.json
│  │  │     └─ vi.json
│  │  ├─ utils
│  │  │  ├─ cn.ts
│  │  │  ├─ coin-logos.ts
│  │  │  ├─ format.ts
│  │  │  └─ time-greeting.ts
│  │  └─ web3
│  │     ├─ chains.ts
│  │     ├─ config.ts
│  │     └─ contracts.ts
│  ├─ next-env.d.ts
│  ├─ next.config.mjs
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ postcss.config.js
│  ├─ public
│  │  ├─ assets
│  │  │  ├─ banners
│  │  │  ├─ logo
│  │  │  └─ users
│  │  ├─ coins
│  │  │  ├─ bnb.svg
│  │  │  ├─ btc.svg
│  │  │  ├─ dai.svg
│  │  │  ├─ eth.svg
│  │  │  ├─ matic.svg
│  │  │  ├─ README.md
│  │  │  ├─ usdc.svg
│  │  │  └─ usdt.svg
│  │  └─ placeholder-product.svg
│  ├─ tailwind.config.js
│  ├─ tsconfig.json
│  └─ types
│     └─ next-auth.d.ts
├─ New Text Document.txt
├─ README.md
├─ RESTART_AND_TEST.bat
├─ start-dev-docker.bat
└─ start-dev-local.bat

```
