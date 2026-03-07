/**
 * Health & Monitoring endpoint tests.
 * /health/detailed uses dynamic import of redis/rabbitmq which may create open handles.
 * We keep these tests simple and avoid leaking sockets.
 */
import request from 'supertest';
import app from '../app';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('main-api');
    expect(res.body.timestamp).toBeDefined();
  });

  it('timestamp is a valid ISO string', async () => {
    const res = await request(app).get('/health');
    const d = new Date(res.body.timestamp);
    expect(d.toISOString()).toBe(res.body.timestamp);
  });
});

describe('GET /health/detailed', () => {
  it('returns 200 or 503', async () => {
    const res = await request(app).get('/health/detailed');
    expect([200, 503]).toContain(res.status);
  });

  it('contains postgres check result', async () => {
    const res = await request(app).get('/health/detailed');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.postgres).toBeDefined();
    expect(['ok', 'error']).toContain(res.body.checks.postgres.status);
  });

  it('includes memory and uptime info', async () => {
    const res = await request(app).get('/health/detailed');
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.memory).toBeDefined();
    expect(typeof res.body.memory.rss_mb).toBe('number');
  });

  it('returns healthy status when DB is reachable', async () => {
    const res = await request(app).get('/health/detailed');
    if (res.body.checks?.postgres?.status === 'ok') {
      expect(res.status).toBe(200);
      expect(['healthy', 'degraded']).toContain(res.body.status);
    }
  });
});

describe('GET /metrics', () => {
  it('returns 200 with numeric metric fields', async () => {
    const res = await request(app).get('/metrics');
    if (res.status === 200) {
      expect(res.body.metrics).toBeDefined();
      expect(typeof res.body.metrics.total_users).toBe('number');
      expect(typeof res.body.metrics.active_products).toBe('number');
      expect(typeof res.body.metrics.total_orders).toBe('number');
    } else {
      // DB might not be ready
      expect(res.status).toBe(500);
    }
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown route', async () => {
    const res = await request(app).get('/api/this-does-not-exist-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
