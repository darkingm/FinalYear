# API Documentation

## Base URLs

- **Main API**: `http://localhost:3001/api`
- **Payment API**: `http://localhost:3002/api`

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Auth Endpoints

### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "johndoe",
  "wallet_address": "0x..." (optional),
  "captcha": "hcaptcha_token"
}
```

**Response:**
```json
{
  "success": true,
  "user": { "user_id": 1, "email": "...", "username": "..." },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### POST /api/auth/wallet-login
Login with wallet signature.

**Request Body:**
```json
{
  "wallet_address": "0x...",
  "message": "Sign this message to login: ...",
  "signature": "0x..."
}
```

### POST /api/auth/oauth
OAuth login (Google/Facebook).

**Request Body:**
```json
{
  "provider": "google",
  "providerId": "google_user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "image": "https://..."
}
```

---

## Products Endpoints

### GET /api/products
List products with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `category` (string): Filter by category
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `acceptsCrypto` (boolean): Filter products accepting crypto
- `acceptsPayPal` (boolean): Filter products accepting PayPal
- `search` (string): Search in name/description

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "product_id": 1,
      "name": "iPhone 15 Pro",
      "description": "...",
      "base_price_usd": 999.99,
      "seller_id": 2,
      "metadata": {
        "images": ["https://..."],
        "category": "electronics",
        "accepted_tokens": {
          "crypto": ["USDT", "USDC"],
          "fiat": ["paypal"]
        }
      },
      "stock": 10,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

### GET /api/products/:id
Get single product details.

### POST /api/products
Create a new product (requires authentication).

**Request Body:**
```json
{
  "name": "Product Name",
  "description": "Detailed description",
  "base_price_usd": 99.99,
  "stock": 10,
  "metadata": {
    "images": ["url1", "url2"],
    "category": "electronics",
    "accepted_tokens": {
      "crypto": ["USDT", "USDC"],
      "fiat": ["paypal"]
    }
  }
}
```

### PUT /api/products/:id
Update product (requires authentication, must be product owner).

### DELETE /api/products/:id
Delete product (requires authentication, must be product owner).

---

## Orders Endpoints

### GET /api/orders
List user's orders.

**Query Parameters:**
- `status` (string): Filter by status
- `page`, `limit`: Pagination

### GET /api/orders/:id
Get order details.

### POST /api/orders
Create new order.

**Request Body:**
```json
{
  "product_id": 1,
  "quantity": 1,
  "payment_method": "crypto" // or "paypal"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": 123,
    "internal_order_id": "uuid",
    "status": "UNPAID",
    "price_usd": 999.99,
    "product_id": 1,
    "quantity": 1
  }
}
```

---

## Payment Endpoints (Payment API)

### POST /api/payments/crypto/quote
Get quote for crypto payment.

**Request Body:**
```json
{
  "order_id": 123,
  "token_symbol": "USDT"
}
```

**Response:**
```json
{
  "success": true,
  "quote": {
    "order_id": 123,
    "escrow_contract": "0x...",
    "token_address": "0x...",
    "amount_token": 999.50,
    "amount_wei": "999500000",
    "calldata": "0x...",
    "expires_at": 1234567890
  }
}
```

### POST /api/payments/crypto/submit
Submit transaction hash after user signs.

**Request Body:**
```json
{
  "order_id": 123,
  "tx_hash": "0x..."
}
```

### GET /api/payments/crypto/status/:orderId
Check payment status.

### POST /api/payments/paypal/create-order
Create PayPal order.

**Request Body:**
```json
{
  "order_id": 123
}
```

**Response:**
```json
{
  "success": true,
  "paypal_order_id": "PAYPAL-ORDER-ID"
}
```

### POST /api/payments/paypal/capture
Capture PayPal payment.

**Request Body:**
```json
{
  "paypal_order_id": "PAYPAL-ORDER-ID"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

**HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate email)
- `500` - Internal Server Error

---

## Rate Limiting

- **Anonymous requests**: 100 requests per 15 minutes
- **Authenticated requests**: 1000 requests per 15 minutes

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```
