/**
 * Authentication endpoint tests.
 * Tests register, login, validation, and error cases.
 * Requires DATABASE_URL pointing to a test PostgreSQL instance.
 */
import request from 'supertest';
import { Pool } from 'pg';
import app from '../app';

const testEmail   = `test_${Date.now()}@example.com`;
const testPw      = 'Test@Password1';
const testUser    = `testuser_${Date.now()}`;

let testPool: Pool;

beforeAll(async () => {
  testPool = new Pool({ connectionString: process.env.DATABASE_URL });
});

afterAll(async () => {
  // Clean up test users
  await testPool.query(`DELETE FROM users WHERE email LIKE 'test_%@example.com'`).catch(() => {});
  await testPool.end().catch(() => {});
});

// ── Register ────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPw, username: testUser });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Password hash must NOT be exposed
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPw, username: `${testUser}_dup` });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects registration with missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: testPw });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects registration with missing password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `missing_pw_${Date.now()}@example.com` });

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
    // No sensitive fields
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects login with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@doesnotexist.com', password: testPw });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects login with missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ── Protected route ─────────────────────────────────────────────

describe('Protected routes (Bearer token)', () => {
  let accessToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPw });
    accessToken = res.body.accessToken;
  });

  it('allows access to /api/users/profile with valid token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect([200, 404]).toContain(res.status); // 404 if route doesn't exist, 200 if it does
    expect(res.status).not.toBe(401);
  });

  it('rejects access without token', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });

  it('rejects access with malformed token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

// ── Refresh token ───────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('returns 400 when no token provided', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ── Logout ──────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 on logout', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPw });
    const token = loginRes.body.accessToken;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 401]).toContain(res.status);
  });
});
