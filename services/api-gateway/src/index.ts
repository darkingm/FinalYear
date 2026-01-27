import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authMiddleware, requireRole, requireSellerOrAdmin } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { 
  rateLimitMiddleware, 
  authRateLimitMiddleware,
  loginRateLimitMiddleware,
  registerRateLimitMiddleware,
  otpRateLimitMiddleware 
} from './middleware/rateLimit.middleware';
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

// In-memory rate limiting BEFORE body parsing (trước Redis)
// General rate limit cho tất cả API endpoints
app.use('/api/', rateLimitMiddleware);

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
// Apply specific rate limits for auth endpoints
app.use('/api/v1/auth', authRateLimitMiddleware);
app.use('/api/v1/auth/login', loginRateLimitMiddleware);
app.use('/api/v1/auth/register', registerRateLimitMiddleware);
app.use('/api/v1/auth/verify-email', otpRateLimitMiddleware);
app.use('/api/v1/auth/resend-otp', otpRateLimitMiddleware);
app.use('/api/v1/auth/forgot-password', otpRateLimitMiddleware);

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

// User Service - Now merged into Auth Service - Authentication required
app.use('/api/v1/users', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.auth, // Route to auth-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/users': '/api/v1/users' }, // Keep same path
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
    logger.error('User Service Proxy Error (via Auth Service):', err);
    res.status(503).json({ error: 'User service unavailable' });
  },
}));

// Wallet Service - Authentication required
app.use('/api/v1/wallets', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.auth, // Route to auth-service
  changeOrigin: true,
  pathRewrite: { '^/api/v1/wallets': '/api/v1/wallets' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Email', req.user.email || '');
      proxyReq.setHeader('X-User-Username', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Wallet Service Proxy Error:', err);
    res.status(503).json({ error: 'Wallet service unavailable' });
  },
}));

// Admin Wallet Service - Admin only
app.use('/api/v1/admin/wallets', authMiddleware, requireRole('ADMIN'), createProxyMiddleware({
  target: serviceRegistry.auth, // Route to auth-service
  changeOrigin: true,
  pathRewrite: { '^/api/v1/admin/wallets': '/api/v1/admin/wallets' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Admin Wallet Service Proxy Error:', err);
    res.status(503).json({ error: 'Admin wallet service unavailable' });
  },
}));

// Product Service - Public for listing, auth for management
// Seller routes require seller role
app.use('/api/v1/products/seller', authMiddleware, requireSellerOrAdmin, createProxyMiddleware({
  target: serviceRegistry.product,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/products': '/api/products' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Name', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Product Service Proxy Error:', err);
    res.status(503).json({ error: 'Product service unavailable' });
  },
}));

app.use('/api/v1/products', createProxyMiddleware({
  target: serviceRegistry.product,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/products': '/api/products' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Name', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Product Service Proxy Error:', err);
    res.status(503).json({ error: 'Product service unavailable' });
  },
}));

// Coin Market Service - Now merged into Product Service - Public
app.use('/api/v1/coins', createProxyMiddleware({
  target: serviceRegistry.product, // Route to product-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/coins': '/api/coins' },
  onError: (err, req, res) => {
    logger.error('Coin Market Service Proxy Error (via Product Service):', err);
    res.status(503).json({ error: 'Coin market service unavailable' });
  },
}));

// Shop Service - Now merged into Product Service - Public for viewing, auth for management
app.use('/api/v1/shops', createProxyMiddleware({
  target: serviceRegistry.product, // Route to product-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/shops': '/api/shops' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Shop Service Proxy Error (via Product Service):', err);
    res.status(503).json({ error: 'Shop service unavailable' });
  },
}));

// Cart Service - Authentication required
app.use('/api/v1/cart', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.order,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/cart': '/api/cart' },
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req: any, res) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Email', req.user.email || '');
      proxyReq.setHeader('X-User-Username', req.user.username || '');
    }
    // Rewrite body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res: any) => {
    logger.error('Cart Service Proxy Error:', err);
    if (!res.headersSent) {
      res.status(503).json({ 
        success: false,
        error: 'Cart service unavailable',
        details: err.message 
      });
    }
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

// Payment Service - Now merged into Order Service - Authentication required
app.use('/api/v1/payments', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.order, // Route to order-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/payments': '/api/payments' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('Payment Service Proxy Error (via Order Service):', err);
    res.status(503).json({ error: 'Payment service unavailable' });
  },
}));

// P2P Trading - Now merged into Order Service - Authentication required
app.use('/api/v1/p2p', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.order, // Route to order-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/p2p': '/api/p2p' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error('P2P Service Proxy Error (via Order Service):', err);
    res.status(503).json({ error: 'P2P service unavailable' });
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
// Seller-specific routes require seller role
app.use('/api/v1/chats/seller', authMiddleware, requireSellerOrAdmin, createProxyMiddleware({
  target: serviceRegistry.chat,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/chats': '/api/chats' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Name', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Chat Service Proxy Error:', err);
    res.status(503).json({ error: 'Chat service unavailable' });
  },
}));

// General chat routes
app.use('/api/v1/chats', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.chat,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/chats': '/api/chats' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Name', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Chat Service Proxy Error:', err);
    res.status(503).json({ error: 'Chat service unavailable' });
  },
}));

// Legacy chat route (for backward compatibility)
app.use('/api/v1/chat', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.chat,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/chat': '/api/chats' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Name', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Chat Service Proxy Error:', err);
    res.status(503).json({ error: 'Chat service unavailable' });
  },
}));

// Social Service - Now merged into Chat Service - Authentication required
app.use('/api/v1/social/posts', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.chat, // Route to chat-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/social/posts': '/api/posts' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Username', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Social Service Proxy Error (via Chat Service):', err);
    res.status(503).json({ error: 'Social service unavailable' });
  },
}));

app.use('/api/v1/social/comments', authMiddleware, createProxyMiddleware({
  target: serviceRegistry.chat, // Route to chat-service (merged)
  changeOrigin: true,
  pathRewrite: { '^/api/v1/social/comments': '/api/comments' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Username', req.user.username || '');
    }
  },
  onError: (err, req, res) => {
    logger.error('Social Service Proxy Error (via Chat Service):', err);
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

