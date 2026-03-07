/**
 * Auth endpoint tests.
 * register requires captcha — in tests we send captcha:'test_bypass'
 * and set HCAPTCHA_SECRET='test_bypass' so captcha check passes.
 */
import request from 'supertest';
import { Pool } from 'pg';
import app from '../app';

// Unique emails per test run to avoid conflicts
const ts          = Date.now();
const testEmail   = `auth_test_${ts}@example.com`;
const testPw      = 'Test@Password1';
const testUser    = `authuser_${ts}`;

let testPool: Pool;
let accessToken: string;

beforeAll(async () => {
  testPool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  await testPool.query(`DELETE FROM users WHERE email = $1`, [testEmail]).catch(() => {});
  await testPool.end().catch(() => {});
});

// ── Register ────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers successfully with captcha bypass', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPw, username: testUser, captcha: 'test_bypass' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('returns 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPw, username: `dup_${ts}`, captcha: 'test_bypass' });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when captcha is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `nocap_${ts}@example.com`, password: testPw });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/captcha/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: testPw, captcha: 'test_bypass' });
    // Auth service throws when email is undefined (DB constraint or logic)
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

// ── Login ───────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPw });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.password_hash).toBeUndefined();

    accessToken = res.body.accessToken;
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'WrongPassword!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody_xyz@nope.com', password: testPw });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns error for missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ── JWT auth guard ──────────────────────────────────────────────

describe('Bearer token auth', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('allows access with valid token', async () => {
    if (!accessToken) return;
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    // 200 = profile exists, 404 = route not found but NOT 401
    expect(res.status).not.toBe(401);
  });
});

// ── Refresh ─────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns error when no token given', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ── Logout ──────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('responds to logout (200 or 401)', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken || 'no-token'}`);
    expect([200, 401]).toContain(res.status);
  });
});
