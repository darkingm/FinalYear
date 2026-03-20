---
name: web3market-backend-patterns
description: Use when building or editing backend API, services, middleware, or database queries in the Web3Market project — covers query patterns, auth middleware, error handling, RabbitMQ events, and service communication conventions.
---

# Web3Market — Backend API Patterns

## Service Architecture

| Service | Port | DB | Key modules |
|---|---|---|---|
| main-service | 3001 | marketplace_db | users, products, orders, disputes, reviews, auth |
| payment-service | 3002 | payment_db + marketplace_db | crypto payments, PayPal, escrow, blockchain listener |

Both services share Redis for caching/sessions and RabbitMQ for async events.

## Database Query Pattern

Each service has its own `query` utility wrapping the DB connection pool.

```typescript
// main-service
import { query } from '../../../config/database';

// payment-service (marketplace_db)
import { mainQuery } from '../../../config/main-database'; // connects to marketplace_db
import { query } from '../../../config/database';           // connects to payment_db
```

**Parameterized queries only** — never string interpolation in SQL:
```typescript
// ✅ CORRECT
await query('SELECT * FROM orders WHERE order_id = $1 AND user_id = $2', [orderId, userId]);

// ❌ NEVER — SQL injection risk
await query(`SELECT * FROM orders WHERE order_id = ${orderId}`);
```

## Error Handling Pattern

All controllers use `AppError` for business logic errors:
```typescript
import { AppError } from '../../../middleware/error-handler';

// In controller:
if (!order) throw new AppError('Order not found', 404);
if (!allowed) throw new AppError('Cannot transition from X to Y', 400);

// Error middleware catches and formats response automatically
```

## Auth Middleware

```typescript
import { authenticate } from '../../../middleware/auth';
import { requireRole } from '../../../middleware/roles'; // optional

// Protect route:
router.get('/protected', authenticate, controller);

// Role-based:
router.post('/admin', authenticate, requireRole('admin'), controller);

// Internal service key OR user JWT:
const authenticateOrInternalKey = (req, res, next) => {
  const internalKey = req.headers['x-internal-service-key'];
  if (internalKey && internalKey === process.env.INTERNAL_SERVICE_KEY) {
    req.user = { id: 0, role: 'system' };
    return next();
  }
  return authenticate(req, res, next);
};
```

## Request Validation (Zod)

```typescript
import { z } from 'zod';
import { validateRequest } from '../../../middleware/validate';

const mySchema = z.object({
  order_id: z.number().int().positive(),
  status: z.enum(['SHIPPED', 'COMPLETED', 'DISPUTED']),
  reason: z.string().optional(),
});

router.post('/route', authenticate, validateRequest(mySchema), handler);
```

## RabbitMQ Events

Publishing:
```typescript
import { publishEvent } from '../../../services/rabbitmq';

await publishEvent('order.status_updated', {
  order_id: orderId,
  status: newStatus,
  timestamp: Date.now(),
});
```

Common events:
| Event | Published by | Consumed by |
|---|---|---|
| `payment.confirmed` | payment-service | main-service → set order PAID |
| `payment.released` | payment-service | main-service → set order COMPLETED |
| `order.status_updated` | main-service | frontend (WebSocket relay) |
| `order.created` | main-service | payment-service |

## Internal Service Calls (main → payment)

Always use `INTERNAL_SERVICE_KEY`, never forward user tokens:

```typescript
import axios from 'axios';

const paymentApiUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:5001';

await axios.post(`${paymentApiUrl}/api/crypto-payment/release`, 
  { order_id: orderId },
  {
    headers: { 'X-Internal-Service-Key': process.env.INTERNAL_SERVICE_KEY },
    timeout: 30000, // blockchain tx can take time
  }
);
```

**Timeout must be ≥ 30s** for blockchain operations (mining takes time).

## Order Controller Patterns

### Status Update with Validation
```typescript
// Always validate transition before updating
const validTransitions: Record<string, string[]> = {
  UNPAID: ['CANCELLED'],
  PAID: ['SHIPPED', 'DISPUTED'],
  SHIPPED: ['COMPLETED', 'DISPUTED'],
  // ...
};

const allowedNext = validTransitions[order.status] || [];
if (!allowedNext.includes(newStatus)) {
  throw new AppError(`Cannot transition from ${order.status} to ${newStatus}`, 400);
}
```

### ON CONFLICT upsert pattern
```typescript
// Disputes table has UNIQUE(order_id) — use EXCLUDED for clean upsert
await query(`
  INSERT INTO disputes (order_id, raised_by, reason, status, created_at, updated_at)
  VALUES ($1, $2, $3, 'open', NOW(), NOW())
  ON CONFLICT (order_id) DO UPDATE
    SET reason = EXCLUDED.reason, status = 'open', updated_at = NOW()
`, [orderId, userId, reason]);
```

## Blockchain Integration (payment-service)

```typescript
import { ethers } from 'ethers';

// orderId encoding (MUST match frontend viem toBytes)
const orderId32 = ethers.keccak256(ethers.toUtf8Bytes(internal_order_id));

// Get escrow contract
const provider = new ethers.JsonRpcProvider(process.env.LOCALHOST_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const escrowContract = new ethers.Contract(contractAddress, ESCROW_ABI, wallet);

// Release funds
const tx = await escrowContract.releasePayment(orderId32);
await tx.wait(1); // wait for 1 confirmation
```

After successful release, update BOTH fields:
```sql
UPDATE orders SET status = 'COMPLETED', release_tx_hash = $1, updated_at = NOW()
WHERE order_id = $2
```

## Logger Pattern

```typescript
import { logger } from '../../../utils/logger';

logger.info('Payment released', { orderId, txHash: tx.hash });
logger.error('Release failed', { orderId, error: err.message });
logger.warn('Migrator table missing, skipping', err.message);
```

## Common Backend Mistakes

### 1. Forwarding user JWT to internal services
```typescript
// ❌ Security risk + breaks when user token expires
headers: { Authorization: req.headers.authorization }

// ✅ Internal key
headers: { 'X-Internal-Service-Key': process.env.INTERNAL_SERVICE_KEY }
```

### 2. Using `$3` in ON CONFLICT SET
```sql
-- ❌ Wrong — $3 is parameterized query value, not the EXCLUDED value
ON CONFLICT (order_id) DO UPDATE SET reason = $3

-- ✅ Correct — EXCLUDED refers to the row that was rejected
ON CONFLICT (order_id) DO UPDATE SET reason = EXCLUDED.reason
```

### 3. Wrong status after escrow release
```typescript
// ❌ Wrong — PAID means "in escrow", not "funds released"
await query("UPDATE orders SET status = 'PAID' WHERE order_id = $1", [id]);

// ✅ Correct — COMPLETED means escrow released to seller
await query("UPDATE orders SET status = 'COMPLETED', release_tx_hash = $1 WHERE order_id = $2", [txHash, id]);
```

### 4. Missing timeout on blockchain axios call
```typescript
// ❌ Default timeout (axios has no default) — hangs if blockchain is slow
await axios.post(url, data, { headers: {...} });

// ✅ Always set timeout for blockchain operations
await axios.post(url, data, { headers: {...}, timeout: 30000 });
```

### 5. Query without error handling for optional operations
```typescript
// ✅ Use .catch() for non-critical operations (dispute creation, logging)
await query(`INSERT INTO disputes...`).catch(err =>
  logger.warn('Failed to create dispute record:', err.message)
);
```

## Response Format Convention

```typescript
// Success
res.json({ message: 'OK', data: result });
res.status(201).json({ message: 'Created', order: newOrder });

// Error (handled by AppError middleware)
throw new AppError('Not found', 404);
// → { error: 'Not found', statusCode: 404 }
```

## Key Backend File Locations

| File | Purpose |
|---|---|
| `backend/main-service/src/config/database.ts` | DB pool setup |
| `backend/main-service/src/middleware/auth.ts` | JWT authenticate middleware |
| `backend/main-service/src/middleware/error-handler.ts` | AppError class + global handler |
| `backend/main-service/src/modules/orders/orders.controller.ts` | Full order lifecycle |
| `backend/payment-service/src/modules/crypto-payment/crypto-payment.service.ts` | Quote/submit/release |
| `backend/payment-service/src/modules/crypto-payment/crypto-payment.routes.ts` | Routes + authenticateOrInternalKey |
| `backend/payment-service/src/config/main-database.ts` | Connection to marketplace_db |
