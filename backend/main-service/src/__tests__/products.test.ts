/**
 * Products endpoint tests.
 * API response shape: { success, data: Product[], pagination: {...} }
 */
import request from 'supertest';
import { Pool } from 'pg';
import app from '../app';

let testPool: Pool;
let sellerToken: string;
let testSellerId: number;

const sellerEmail = `seller_prod_${Date.now()}@example.com`;
const sellerPw = 'Seller@Pass123';

beforeAll(async () => {
  testPool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Register a seller user (bypass captcha by using test_bypass env)
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email: sellerEmail, password: sellerPw, username: `sp_${Date.now()}`, captcha: 'test_bypass' });

  sellerToken = regRes.body.accessToken;
  testSellerId = regRes.body.user?.user_id;

  if (testSellerId) {
    await testPool.query(`UPDATE users SET role='seller' WHERE user_id=$1`, [testSellerId]);
    await testPool.query(
      `INSERT INTO seller_profiles (user_id, display_name, payout_wallet)
       VALUES ($1, 'Test Seller', '0x0000000000000000000000000000000000000001')
       ON CONFLICT (user_id) DO NOTHING`,
      [testSellerId]
    );
  }
});

afterAll(async () => {
  if (testSellerId) {
    await testPool.query('DELETE FROM users WHERE user_id=$1', [testSellerId]).catch(() => { });
  }
  await testPool.end().catch(() => { });
});

// ── GET /api/products ───────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 200 with data array and pagination', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // API returns { success, data, pagination }
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('respects limit and page params', async () => {
    const res = await request(app).get('/api/products?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(5);
  });

  it('accepts category filter and returns only matching products', async () => {
    const res = await request(app).get('/api/products?category=electronics');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    (res.body.data as any[]).forEach((p) => {
      expect(p.category).toBe('electronics');
    });
  });

  it('accepts price range filter', async () => {
    const res = await request(app).get('/api/products?minPrice=10&maxPrice=500');
    expect(res.status).toBe(200);
    (res.body.data as any[]).forEach((p) => {
      expect(parseFloat(p.base_price_usd)).toBeGreaterThanOrEqual(10);
      expect(parseFloat(p.base_price_usd)).toBeLessThanOrEqual(500);
    });
  });

  it('accepts search query', async () => {
    const res = await request(app).get('/api/products?search=laptop');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns empty data array for non-matching search', async () => {
    const res = await request(app).get('/api/products?search=xyznoexist12345abc');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  it('handles invalid page param gracefully', async () => {
    const res = await request(app).get('/api/products?page=abc');
    expect([200, 400]).toContain(res.status);
  });

  it('has product fields: product_id, name, base_price_usd', async () => {
    const res = await request(app).get('/api/products?limit=3');
    expect(res.status).toBe(200);
    if ((res.body.data as any[]).length > 0) {
      const p = res.body.data[0];
      expect(p.product_id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.base_price_usd).toBeDefined();
    }
  });
});

// ── GET /api/products/:id ───────────────────────────────────────

describe('GET /api/products/:id', () => {
  it('returns 404 for non-existent product', async () => {
    const res = await request(app).get('/api/products/999999999');
    expect(res.status).toBe(404);
  });

  it('returns 400/404/500 for invalid id format', async () => {
    const res = await request(app).get('/api/products/not-a-number');
    expect([400, 404, 500]).toContain(res.status);
  });

  it('returns product data for existing id (from seed)', async () => {
    const listRes = await request(app).get('/api/products?limit=1');
    if ((listRes.body.data as any[])?.length > 0) {
      const pid = listRes.body.data[0].product_id;
      const res = await request(app).get(`/api/products/${pid}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.product_id).toBe(pid);
    }
  });
});

// ── POST /api/products ──────────────────────────────────────────

describe('POST /api/products', () => {
  it('rejects unauthenticated product creation with 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Test Product', base_price_usd: 99.99 });
    expect(res.status).toBe(401);
  });

  it('creates a product when authenticated as seller', async () => {
    if (!sellerToken) return;
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: `Widget_${Date.now()}`,
        description: 'Integration test product',
        category: 'electronics',
        base_price_usd: 49.99,
        stock: 10,
      });
    if (res.status !== 201) {
      console.error('Create product failed:', res.status, res.body);
    }
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product_id).toBeDefined();
  });
});

// ── PUT/DELETE auth guard ───────────────────────────────────────

describe('Protected product mutations', () => {
  it('PUT without token returns 401', async () => {
    const res = await request(app).put('/api/products/1').send({ name: 'Hack' });
    expect(res.status).toBe(401);
  });

  it('DELETE without token returns 401', async () => {
    const res = await request(app).delete('/api/products/1');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/products/tokens ────────────────────────────────────

describe('GET /api/products/tokens', () => {
  it('returns 200 with token list', async () => {
    const res = await request(app).get('/api/products/tokens');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
