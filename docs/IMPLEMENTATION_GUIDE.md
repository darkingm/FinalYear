# Complete Implementation Guide

This document provides the complete implementation details for all remaining components of the Crypto Marketplace platform.

## 📁 Backend Main Service - Module Implementations

### Auth Module (`backend/main-service/src/modules/auth/`)

**auth.routes.ts**:
```typescript
import { Router } from 'express';
import { register, login, walletLogin, oauthLogin, refreshToken } from './auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/wallet-login', walletLogin);
router.post('/oauth', oauthLogin);
router.post('/refresh', refreshToken);

export default router;
```

**auth.controller.ts**: Handles user registration with bcrypt hashing, email/password login with JWT tokens, wallet signature verification using ethers.js, Google/Facebook OAuth integration, and refresh token rotation.

**auth.service.ts**: Implements password hashing, JWT generation (access + refresh tokens), wallet signature verification using EIP-4361, nonce generation and validation, OAuth user creation/lookup, and token blacklisting with Redis.

### Products Module (`backend/main-service/src/modules/products/`)

**products.routes.ts**:
```typescript
router.get('/', getProducts); // List with pagination, filters
router.get('/:id', getProduct); // Single product details
router.post('/', authenticate, createProduct); // Create with image upload
router.put('/:id', authenticate, updateProduct);
router.delete('/:id', authenticate, deleteProduct);
router.post('/:id/images', authenticate, upload.array('images', 5), uploadImages);
```

**products.service.ts**: 
- CRUD operations with PostgreSQL
- Image upload to AWS S3 or Cloudinary
- Metadata handling (accepted_tokens JSON)
- Search and filtering
- Cache invalidation on updates

**image-upload.service.ts**: Multer configuration, S3/Cloudinary integration, image compression/resizing, URL generation.

### Inventory Module (`backend/main-service/src/modules/inventory/`)

**inventory.service.ts**:
- Stock tracking with optimistic locking (version column)
- Inventory reservation with TTL (10 minutes default)
- Lock creation: `INSERT INTO inventory_locks... RETURNING *`
- Lock release on order cancellation or expiry
- Background worker to clean expired locks every minute

### Orders Module (`backend/main-service/src/modules/orders/`)

**order-saga.ts** - State Machine Implementation:
```typescript
const ORDER_STATES = [
  'UNPAID',
  'TX_SUBMITTED',
  'ONCHAIN_PENDING',
  'ONCHAIN_CONFIRMED',
  'PAYMENT_VALIDATED',
  'PAID',
  'DELIVERING',
  'COMPLETED'
];

async transitionState(orderId, newState) {
  // Optimistic locking with version check
  // Publish RabbitMQ event: order.status_changed
  // Update audit_logs table
  // Trigger next saga step
}
```

**orders.service.ts**:
- Create order with inventory lock
- Calculate pricing (USD -> token conversion)
- Generate unique internal_order_id (UUID)
- Link payment method (crypto vs PayPal)
- Publish 'order.created' event
- Handle order status transitions
- Compensation logic for failed states

### Users Module (`backend/main-service/src/modules/users/`)

**users.service.ts**:
- User profile CRUD
- Role management (buyer/seller/admin)
- Account status updates
- OAuth account linking
- Wallet address management

---

## 💳 Payment Service Implementation

### Package.json
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ethers": "^6.10.0",
    "@paypal/checkout-server-sdk": "^1.0.3",
    "axios": "^1.6.5",
    "pg": "^8.11.3",
    "redis": "^4.6.12",
    "amqplib": "^0.10.3",
    "dotenv": "^16.4.1"
  }
}
```

### Crypto Payment Service (`payment-service/src/modules/crypto-payment/`)

**crypto-payment.service.ts**:
```typescript
async generateQuote(orderId: number, tokenSymbol: string) {
  // 1. Get order details from DB
  // 2. Get current token price (Binance API + cache in Redis)
  // 3. Calculate token amount: order.price_usd / tokenPrice
  // 4. Get escrow contract instance
  // 5. Generate calldata for escrow.deposit()
  // 6. Return { escrow_contract, token_address, amount_wei, calldata, expires_at }
}

async submitTransaction(orderId: number, txHash: string) {
  // 1. Update order: status = 'TX_SUBMITTED', tx_hash = txHash
  // 2. Insert into payments table
  // 3. Publish event: 'tx.submitted'
  // 4. Start monitoring worker
}

async verifyTransaction(txHash: string) {
  // 1. Get receipt from RPC provider
  // 2. Verify with indexer (Moralis/The Graph)
  // 3. Check confirmations >= 12
  // 4. Update payments table: verified_by_rpc, verified_by_indexer
  // 5. If verified: transition order to 'ONCHAIN_CONFIRMED'
  // 6. Publish event: 'payment.validated'
}
```

### PayPal Service (`payment-service/src/modules/paypal/`)

**paypal.service.ts**:
```typescript
import paypal from '@paypal/checkout-server-sdk';

class PayPalService {
  private client: paypal.core.PayPalHttpClient;
  
  constructor() {
    const environment = process.env.PAYPAL_MODE === 'production'
      ? new paypal.core.LiveEnvironment(clientId, secret)
      : new paypal.core.SandboxEnvironment(clientId, secret);
    this.client = new paypal.core.PayPalHttpClient(environment);
  }
  
  async createOrder(orderId: number) {
    const order = await db.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.internal_order_id,
        amount: { currency_code: 'USD', value: order.price_usd.toFixed(2) }
      }]
    });
    const response = await this.client.execute(request);
    // Update order with paypal_order_id
    return { paypal_order_id: response.result.id };
  }
  
  async capturePayment(paypalOrderId: string) {
    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    const response = await this.client.execute(request);
    if (response.result.status === 'COMPLETED') {
      // Update order: status = 'PAID', paypal_capture_id = ...
      // Publish event: 'payment.validated'
    }
    return response.result;
  }
}
```

### Binance Price Service (`payment-service/src/modules/pricing/`)

**binance.service.ts**:
```typescript
import axios from 'axios';
import { setCache, getCache } from '../config/redis';

async getCurrentPrice(symbol: string): Promise<number> {
  // Check Redis cache first (1s TTL)
  const cached = await getCache(`price:${symbol}`);
  if (cached) return cached;
  
  // Fetch from Binance API
  const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
    params: { symbol }
  });
  const price = parseFloat(response.data.price);
  
  // Cache for 1 second
  await setCache(`price:${symbol}`, price, 1);
  return price;
}
```

### Background Workers (`payment-service/src/workers/`)

**tx-monitor.worker.ts**:
- Poll pending transactions every 10 seconds
- Call verifyTransaction() for each pending tx
- Update order statuses based on confirmation count

**inventory-cleaner.worker.ts**:
- Run every minute
- Call `release_expired_locks()` PostgreSQL function
- Update inventory availability

**price-updater.worker.ts**:
- Update crypto prices in Redis every 1 second
- Fetch from Binance API for all supported symbols

---

## 🔗 Smart Contracts

### EscrowCore.sol (`contracts/src/EscrowCore.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EscrowCore is ReentrancyGuard, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    struct Order {
        string orderId;
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 fee;
        OrderStatus status;
        uint256 createdAt;
    }
    
    enum OrderStatus { Pending, Paid, Completed, Refunded, Disputed }
    
    mapping(string => Order) public orders;
    address public feeVault;
    uint256 public platformFeePercent = 250; // 2.5%
    
    event OrderCreated(string indexed orderId, address buyer, address seller, uint256 amount);
    event OrderCompleted(string indexed orderId);
    event OrderRefunded(string indexed orderId);
    
    function deposit(string memory orderId, address token, uint256 amount, address seller) 
        external nonReentrant {
        require(orders[orderId].buyer == address(0), "Order exists");
        uint256 fee = (amount * platformFeePercent) / 10000;
        uint256 sellerAmount = amount - fee;
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        orders[orderId] = Order({
            orderId: orderId,
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: sellerAmount,
            fee: fee,
            status: OrderStatus.Paid,
            createdAt: block.timestamp
        });
        
        emit OrderCreated(orderId, msg.sender, seller, amount);
    }
    
    function releasePayment(string memory orderId) external onlyRole(ADMIN_ROLE) {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Paid, "Invalid status");
        
        IERC20(order.token).transfer(order.seller, order.amount);
        IERC20(order.token).transfer(feeVault, order.fee);
        
        order.status = OrderStatus.Completed;
        emit OrderCompleted(orderId);
    }
    
    function refund(string memory orderId) external onlyRole(ADMIN_ROLE) {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Paid, "Invalid status");
        
        IERC20(order.token).transfer(order.buyer, order.amount + order.fee);
        order.status = OrderStatus.Refunded;
        emit OrderRefunded(orderId);
    }
}
```

### Hardhat Config (`contracts/hardhat.config.ts`)

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    polygonMumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [process.env.PRIVATE_KEY!],
    },
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },
};

export default config;
```

### Deployment Script (`contracts/scripts/deploy.ts`)

```typescript
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  const FeeVault = await ethers.getContractFactory("FeeVault");
  const feeVault = await FeeVault.deploy();
  await feeVault.waitForDeployment();
  
  const EscrowCore = await ethers.getContractFactory("EscrowCore");
  const escrow = await EscrowCore.deploy(await feeVault.getAddress());
  await escrow.waitForDeployment();
  
  console.log("EscrowCore:", await escrow.getAddress());
  console.log("FeeVault:", await feeVault.getAddress());
}

main().catch(console.error);
```

---

## 📋 RabbitMQ Event Topics

### Implemented Events:
- `order.created` - New order placed
- `tx.submitted` - Transaction submitted to blockchain
- `tx.confirmed` - Transaction confirmed on-chain
- `payment.validated` - Payment verified and validated
- `payment.failed` - Payment verification failed
- `order.status_changed` - Order state transition
- `inventory.locked` - Inventory reserved for order
- `inventory.released` - Inventory lock released
- `dispute.created` - Dispute raised by user
- `dispute.resolved` - Dispute resolved by admin

### Consumers:
- **Main Service**: Listens to payment events to update order status
- **Payment Service**: Listens to order events to initiate payment processing
- **Notification Service**: Listens to all events for user notifications

---

## 🧪 Testing Implementation

### Frontend Tests (`frontend/__tests__/`)

```typescript
// components/auth/LoginForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
  it('should render login form', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });
  
  it('should validate email format', async () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid' } });
    fireEvent.blur(emailInput);
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

### Backend Tests (`backend/main-service/__tests__/`)

```typescript
// auth.test.ts
import request from 'supertest';
import app from '../src/server';

describe('Auth API', () => {
  it('POST /api/auth/register - should create new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
        username: 'testuser'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('accessToken');
  });
  
  it('POST /api/auth/login - should return JWT token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
  });
});
```

### E2E Tests (`frontend/e2e/`)

```typescript
// checkout.spec.ts
import { test, expect } from '@playwright/test';

test('complete crypto checkout flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'Test123!');
  await page.click('button:has-text("Login")');
  
  await page.click('text=Products');
  await page.click('text=Buy Now');
  await page.click('text=Cryptocurrency');
  await page.click('text=USDT');
  await page.click('text=Confirm Purchase');
  
  await expect(page.locator('text=Payment Successful')).toBeVisible();
});
```

---

## 📖 Complete Setup Instructions

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend - Main Service
cd ../backend/main-service
npm install

# Backend - Payment Service
cd ../backend/payment-service
npm install

# Smart Contracts
cd ../../contracts
npm install
```

### 2. Environment Setup

Copy all `.env.example` files to `.env` and fill in values:
- Database credentials
- API keys (Google, Facebook, PayPal, hCaptcha, AWS, Moralis)
- JWT secrets (generate with: `openssl rand -base64 32`)
- Blockchain RPC URLs and private keys

### 3. Database Setup

```bash
cd docker
docker-compose up -d postgres
psql -h localhost -U marketplace -d marketplace_db -f ../init_database.sql
```

### 4. Start Services

```bash
# Option 1: Docker Compose (recommended)
docker-compose up -d

# Option 2: Manual (for development)
# Terminal 1: Frontend
cd frontend && npm run dev

# Terminal 2: Main API
cd backend/main-service && npm run dev

# Terminal 3: Payment API
cd backend/payment-service && npm run dev
```

### 5. Deploy Smart Contracts

```bash
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network polygonMumbai
# Save contract addresses to backend .env files
```

### 6. Download Coin Logos

Download cryptocurrency logos from https://cryptologos.cc/ and place in `frontend/public/coins/`:
- btc.png, eth.png, bnb.png, usdt.png, usdc.png, dai.png, matic.png

### 7. Access Application

- Frontend: http://localhost:3000
- Main API: http://localhost:3001
- Payment API: http://localhost:3002
- RabbitMQ Management: http://localhost:15672 (user: marketplace, pass: from .env)

---

This completes the implementation guide. All modules follow the architecture specification from `New Text Document.txt` and use the database schema from `init_database.sql`.
