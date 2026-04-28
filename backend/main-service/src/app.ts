import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { pool } from './config/database';
import { logger } from './utils/logger';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import productRoutes from './modules/products/products.routes';
import orderRoutes from './modules/orders/orders.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import adminRoutes from './modules/admin/admin.routes';
import p2pRoutes from './modules/p2p/p2p.routes';
import walletsRoutes from './modules/wallets/wallets.routes';
import { nftRouter } from './modules/nft/nft.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { sellerRouter } from './modules/seller/seller.routes';
import onchainRoutes from './modules/onchain/onchain.routes';
import rwaProxyRoutes from './modules/rwa/rwa-proxy.routes';
import kycRoutes from './modules/kyc/kyc.routes';


const app = express();
app.set('trust proxy', 1); // Behind nginx reverse proxy

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply general rate limiting to all requests
app.use(apiLimiter);

// Basic health – no DB call, always fast
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'main-api',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Detailed health – checks DB / Redis / RabbitMQ
app.get('/health/detailed', async (_req, res) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  const dbStart = Date.now();
  let pgClient: any;
  try {
    pgClient = await pool.connect();
    await pgClient.query('SELECT 1');
    checks.postgres = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err: any) {
    checks.postgres = { status: 'error', error: err.message };
    overall = 'unhealthy';
  } finally {
    if (pgClient) pgClient.release();
  }

  const redisStart = Date.now();
  try {
    const { redisClient } = await import('./config/redis');
    if (redisClient && redisClient.isOpen) {
      await redisClient.ping();
      checks.redis = { status: 'ok', latency_ms: Date.now() - redisStart };
    } else {
      checks.redis = { status: 'disconnected' };
      if (overall === 'healthy') overall = 'degraded';
    }
  } catch (err: any) {
    checks.redis = { status: 'error', error: err.message };
    if (overall === 'healthy') overall = 'degraded';
  }

  try {
    const { getChannel } = await import('./config/rabbitmq');
    const ch = getChannel();
    checks.rabbitmq = { status: ch ? 'ok' : 'disconnected' };
    if (!ch && overall === 'healthy') overall = 'degraded';
  } catch (err: any) {
    checks.rabbitmq = { status: 'error', error: err.message };
    if (overall === 'healthy') overall = 'degraded';
  }

  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const statusCode = overall === 'unhealthy' ? 503 : 200;

  res.status(statusCode).json({
    status: overall,
    service: 'main-api',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(uptime),
    memory: {
      rss_mb: Math.round(memUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    checks,
  });
});

// Metrics summary
app.get('/metrics', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)::int AS total_users,
        (SELECT COUNT(*) FROM products WHERE status='active')::int AS active_products,
        (SELECT COUNT(*) FROM orders)::int AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE status IN ('PAID','PAID_PAYPAL','completed','COMPLETED'))::int AS completed_orders,
        (SELECT COUNT(*) FROM orders WHERE status IN ('UNPAID','TX_SUBMITTED'))::int AS pending_orders
    `);
    const row = result.rows[0];
    res.json({
      service: 'main-api',
      timestamp: new Date().toISOString(),
      metrics: {
        total_users: row.total_users,
        active_products: row.active_products,
        total_orders: row.total_orders,
        completed_orders: row.completed_orders,
        pending_orders: row.pending_orders,
      },
    });
  } catch (err: any) {
    logger.error('Metrics error:', err);
    res.status(500).json({ error: 'Could not retrieve metrics' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/p2p', p2pRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/nft', nftRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/onchain', onchainRoutes);
app.use('/api/rwa', rwaProxyRoutes);
app.use('/api/kyc', kycRoutes);


app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

export default app;


