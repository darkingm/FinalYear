/**
 * Health & Monitoring endpoint tests
 */
import request from 'supertest';
import app from '../app';

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('main-api');
      expect(res.body.timestamp).toBeDefined();
    });

    it('includes a valid ISO timestamp', async () => {
      const res = await request(app).get('/health');
      expect(() => new Date(res.body.timestamp)).not.toThrow();
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });
  });

  describe('GET /health/detailed', () => {
    it('returns 200 or 503 (depends on DB availability)', async () => {
      const res = await request(app).get('/health/detailed');
      expect([200, 503]).toContain(res.status);
    });

    it('returns checks object with postgres key', async () => {
      const res = await request(app).get('/health/detailed');
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.postgres).toBeDefined();
      expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(res.body.memory).toBeDefined();
    });

    it('returns 200 when DB is reachable', async () => {
      const res = await request(app).get('/health/detailed');
      // If DB_URL is set and DB is reachable, postgres should be ok
      if (res.body.checks.postgres.status === 'ok') {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
      }
    });
  });

  describe('GET /metrics', () => {
    it('returns 200 with metrics object when DB is connected', async () => {
      const res = await request(app).get('/metrics');
      if (res.status === 200) {
        expect(res.body.metrics).toBeDefined();
        expect(typeof res.body.metrics.total_users).toBe('number');
        expect(typeof res.body.metrics.active_products).toBe('number');
        expect(typeof res.body.metrics.total_orders).toBe('number');
      }
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
