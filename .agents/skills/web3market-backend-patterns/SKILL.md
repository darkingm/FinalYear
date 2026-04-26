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
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware'; // optional role check

// Protect route:
router.get('/protected', authenticate, controller);

// Role-based:
router.post('/admin', authenticate, authorize('admin'), controller);

// Internal service key OR user JWT:
const authenticateOrInternalKey = (req, res, next) => {
  const internalKey = req.headers['x-internal-service-key'];
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  if (internalKey && expectedKey && internalKey === expectedKey) {
    return next();
  }
  return authenticate(req, res, () => authorize('admin')(req, res, next));
};
```

## Auth Endpoint Routing and Rate Limits

main-service owns these backend routes and they must be reachable behind production nginx:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/wallet-login
POST /api/auth/oauth
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

Do not let nginx route all `/api/auth/*` to NextAuth. Only the NextAuth-specific subpaths belong to the frontend. If `authLimiter` skips genuine internal Docker calls so NextAuth can call the backend, make sure the public NextAuth credentials endpoint has equivalent rate limiting or forwards a trustworthy real client IP for limiter keys.

`/api/auth/oauth` must require `X-Internal-Service-Key`; browsers must not call it directly. `INTERNAL_SERVICE_KEY` is a server secret, never a `NEXT_PUBLIC_*` value.

CAPTCHA policy: registration currently verifies hCaptcha in main-service. If credential login is protected by a CAPTCHA UI, the token must be sent through NextAuth and verified server-side before/while calling main-service; browser-only CAPTCHA checks do not stop direct requests.

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

const paymentApiUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-api:3002';

await axios.post(`${paymentApiUrl}/api/payments/crypto/release`,
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
  TX_SUBMITTED: [],
  TX_FAILED: [],
  ONCHAIN_CONFIRMED: ['SHIPPED', 'COMPLETED', 'DISPUTED'],
  PAID: ['SHIPPED', 'COMPLETED', 'DISPUTED'],
  PAID_PAYPAL: ['SHIPPED', 'COMPLETED', 'DISPUTED'],
  SHIPPED: ['COMPLETED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  // ...
};

const allowedNext = validTransitions[order.status] || [];
if (!allowedNext.includes(newStatus)) {
  throw new AppError(`Cannot transition from ${order.status} to ${newStatus}`, 400);
}
```

### Seller permission checks
`orders.seller_id` stores `seller_profiles.seller_id`. It is not a user id.

```sql
-- Correct seller order ownership check
SELECT o.*, sp.user_id AS seller_user_id
FROM orders o
LEFT JOIN seller_profiles sp ON o.seller_id = sp.seller_id
WHERE o.order_id = $1
  AND (o.buyer_id = $2 OR sp.user_id = $2);
```

Never write `WHERE o.seller_id = $userId` unless you have already resolved the authenticated user's `seller_id` from `seller_profiles`.

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

If buyer confirmation is already done on-chain through `buyerConfirmDelivery(orderId32)`, main-service should only store `release_tx_hash` and update status. Do not call payment-service `/release` again.

## Crypto Payment Route Limiters

Payment-service intentionally applies rate limits per route, not to the entire `/api/payments/crypto` router:

| Route type | Limiter | Purpose |
|---|---|---|
| `POST /session`, `/session-batch`, legacy `/quote` | `invoiceLimiter` | Demo-friendly invoice creation, default `10` per 5 minutes via `PAYMENT_INVOICE_RATE_LIMIT_MAX` |
| `GET /status/:orderId`, `/session/:id/status` | `statusLimiter` | Polling/read-only status checks |
| quote submit, tx submit, verify, release, refund, admin ops | `strictLimiter` | Sensitive write/action endpoints |

Do not wrap the whole crypto router with `strictLimiter`; polling will consume the invoice quota and checkout will show false rate-limit errors.

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

### 5. Comparing seller profile id to user id
```typescript
// WRONG: orders.seller_id is seller_profiles.seller_id
where o.seller_id = userId

// Correct: join seller_profiles and compare sp.user_id to the auth user
where sp.user_id = userId
```

### 6. Query without error handling for optional operations
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
