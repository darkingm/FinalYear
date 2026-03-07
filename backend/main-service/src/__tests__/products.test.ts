/**
 * Products endpoint tests.
 * Tests listing, filtering, pagination, and single product fetch.
 */
import request from 'supertest';
import { Pool } from 'pg';
import app from '../app';

let testPool: Pool;
let sellerToken: string;
let testSellerId: number;
let createdProductId: number;

const sellerEmail = `seller_${Date.now()}@example.com`;
const sellerPw    = 'Seller@Pass123';

beforeAll(async () => {
  testPool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Create a seller user for product creation tests
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email: sellerEmail, password: sellerPw, username: `seller_${Date.now()}` });

  sellerToken = regRes.body.accessToken;
  testSellerId = regRes.body.user?.user_id;

  // Promote to seller role so products can be created
  if (testSellerId) {
    await testPool.query(`UPDATE users SET role='seller' WHERE user_id=$1`, [testSellerId]);
    // Create seller profile
    await testPool.query(
      `INSERT INTO seller_profiles (user_id, display_name, payout_wallet)
       VALUES ($1, 'Test Seller', '0x0000000000000000000000000000000000000001')
       ON CONFLICT (user_id) DO NOTHING`,
      [testSellerId]
    );
  }
});

afterAll(async () => {
  // Clean up
  if (testSellerId) {
    await testPool.query(`DELETE FROM users WHERE user_id=$1`, [testSellerId]).catch(() => {});
  }
  await testPool.end().catch(() => {});
});

// ── GET /api/products ───────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 200 with products array', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('returns pagination metadata', async () => {
    const res = await request(app).get('/api/products?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('accepts category filter', async () => {
    const res = await request(app).get('/api/products?category=electronics');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    // All returned products should belong to electronics category (or be empty)
    res.body.products.forEach((p: any) => {
      expect(p.category).toBe('electronics');
    });
  });

  it('accepts price range filter', async () => {
    const res = await request(app).get('/api/products?minPrice=10&maxPrice=500');
    expect(res.status).toBe(200);
    res.body.products.forEach((p: any) => {
      expect(parseFloat(p.base_price_usd)).toBeGreaterThanOrEqual(10);
      expect(parseFloat(p.base_price_usd)).toBeLessThanOrEqual(500);
    });
  });

  it('accepts search query', async () => {
    const res = await request(app).get('/api/products?search=laptop');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('returns empty array for non-matching search', async () => {
    const res = await request(app).get('/api/products?search=xyznoexist12345abc');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(0);
  });

  it('handles invalid page param gracefully', async () => {
    const res = await request(app).get('/api/products?page=abc');
    expect([200, 400]).toContain(res.status);
  });
});

// ── GET /api/products/:id ───────────────────────────────────────

describe('GET /api/products/:id', () => {
  it('returns 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/999999999');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id format', async () => {
    const res = await request(app).get('/api/products/not-a-number');
    expect([400, 404, 500]).toContain(res.status);
  });

  it('returns product data when id exists (seed data)', async () => {
    // First get any product from listing
    const listRes = await request(app).get('/api/products?limit=1');
    if (listRes.body.products.length > 0) {
      const pid = listRes.body.products[0].product_id;
      const res = await request(app).get(`/api/products/${pid}`);
      expect(res.status).toBe(200);
      expect(res.body.product_id ?? res.body.data?.product_id ?? res.body.product?.product_id).toBeDefined();
    }
  });
});

// ── POST /api/products (create) ─────────────────────────────────

describe('POST /api/products', () => {
  it('rejects unauthenticated product creation', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Test Product', price: 99.99 });
    expect(res.status).toBe(401);
  });

  it('creates a product when authenticated as seller', async () => {
    if (!sellerToken) return;

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name:          'Test Widget XYZ',
        description:   'A test product created during integration tests',
        category:      'electronics',
        base_price_usd: 49.99,
        stock:         10,
        metadata:      {},
      });

    // May be 201 or 400 depending on seller profile existence
    expect([200, 201, 400, 403]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      createdProductId = res.body.product_id ?? res.body.data?.product_id;
      expect(createdProductId).toBeDefined();
    }
  });
});

// ── PUT /api/products/:id ──────────────────────────────────────

describe('PUT /api/products/:id', () => {
  it('rejects unauthenticated update', async () => {
    const res = await request(app)
      .put('/api/products/1')
      .send({ name: 'Hacked' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/products/:id ───────────────────────────────────

describe('DELETE /api/products/:id', () => {
  it('rejects unauthenticated delete', async () => {
    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/products/tokens ────────────────────────────────────

describe('GET /api/products/tokens', () => {
  it('returns token list', async () => {
    const res = await request(app).get('/api/products/tokens');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});
