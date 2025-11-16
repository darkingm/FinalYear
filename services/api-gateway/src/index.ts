import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import logger from './utils/logger';
import { redisClient } from './utils/redis';
import { serviceRegistry } from './config/services';

dotenv.config();

const app: Application = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting BEFORE body parsing to avoid issues
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing - After rate limit, before routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: serviceRegistry,
  });
});

// API Routes with Proxies

// Auth Service - No authentication required
app.use('/api/v1/auth', (req, res, next) => {
  // Log incoming request
  logger.info(`Auth request: ${req.method} ${req.path}`, { body: req.body });
  next();
}, createProxyMiddleware({
  target: serviceRegistry.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '/api/auth' },
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req: any, res) => {
    // Rewrite body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res: any) => {
    logger.error('Auth Service Proxy Error:', err);
    if (!res.headersSent) {
      res.status(503).json({ 
        success: false,
        error: 'Auth service unavailable', 
        details: err.message 
      });
    }
  },
}));

// User Service - Authentication required
app.use('/api/v1/users', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.user,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/users': '/api/users' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      // ✅ Thêm email và username
      proxyReq.setHeader('X-User-Email', req.user.email || '');
      proxyReq.setHeader('X-User-Username', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('User Service Proxy Error:', err);
    res.status(503).json({ error: 'User service unavailable' });
  },
}));

// Product Service - Public for listing, auth for management
app.use('/api/v1/products', createProxyMiddleware({
  target: serviceRegistry.product,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/products': '/api/products' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Product Service Proxy Error:', err);
    res.status(503).json({ error: 'Product service unavailable' });
  },
}));

// Coin Market Service - Public
app.use('/api/v1/coins', createProxyMiddleware({
  target: serviceRegistry.coinMarket,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/coins': '/api/coins' },
  onError: (err, req, res) => {
    logger.error('Coin Market Service Proxy Error:', err);
    res.status(503).json({ error: 'Coin market service unavailable' });
  },
}));

// Order Service - Authentication required
app.use('/api/v1/orders', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.order,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/orders': '/api/orders' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Order Service Proxy Error:', err);
    res.status(503).json({ error: 'Order service unavailable' });
  },
}));

// Payment Service - Authentication required
app.use('/api/v1/payments', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.payment,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/payments': '/api/payments' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Payment Service Proxy Error:', err);
    res.status(503).json({ error: 'Payment service unavailable' });
  },
}));

// Blockchain Service - Authentication required
app.use('/api/v1/blockchain', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.blockchain,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/blockchain': '/api/blockchain' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Blockchain Service Proxy Error:', err);
    res.status(503).json({ error: 'Blockchain service unavailable' });
  },
}));

// Chat Service - Authentication required
app.use('/api/v1/chat', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.chat,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/chat': '/api/chat' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Chat Service Proxy Error:', err);
    res.status(503).json({ error: 'Chat service unavailable' });
  },
}));

// Social Service - Authentication required
app.use('/api/v1/social', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.social,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/social': '/api/social' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Social Service Proxy Error:', err);
    res.status(503).json({ error: 'Social service unavailable' });
  },
}));

// AI Analysis Service - Authentication required
app.use('/api/v1/ai', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.ai,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/ai': '/api/ai' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('AI Analysis Service Proxy Error:', err);
    res.status(503).json({ error: 'AI analysis service unavailable' });
  },
}));

// Notification Service - Authentication required
app.use('/api/v1/notifications', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.notification,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/notifications': '/api/notifications' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Notification Service Proxy Error:', err);
    res.status(503).json({ error: 'Notification service unavailable' });
  },
}));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to Redis (optional)
    try {
      await redisClient.connect();
      logger.info('Connected to Redis');
    } catch (error: any) {
      logger.warn('Redis connection failed, continuing without cache:', error.message);
    }

    app.listen(PORT, () => {
      logger.info(`API Gateway running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Gateway is ready to accept requests');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await redisClient.disconnect();
  process.exit(0);
});

startServer();

export default app;

