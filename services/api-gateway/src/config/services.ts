export const serviceRegistry = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  user: process.env.USER_SERVICE_URL || 'http://user-service:3002',
  product: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003',
  coinMarket: process.env.COIN_MARKET_SERVICE_URL || 'http://coin-market-service:3004',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:3005',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006',
  blockchain: process.env.BLOCKCHAIN_SERVICE_URL || 'http://blockchain-service:3007',
  chat: process.env.CHAT_SERVICE_URL || 'http://chat-service:3008',
  social: process.env.SOCIAL_SERVICE_URL || 'http://social-service:3009',
  ai: process.env.AI_ANALYSIS_SERVICE_URL || 'http://ai-analysis-service:3010',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3011',
};

// For local development
if (process.env.NODE_ENV === 'development') {
  serviceRegistry.auth = 'http://localhost:3001';
  serviceRegistry.user = 'http://localhost:3002';
  serviceRegistry.product = 'http://localhost:3003';
  serviceRegistry.coinMarket = 'http://localhost:3004';
  serviceRegistry.order = 'http://localhost:3005';
  serviceRegistry.payment = 'http://localhost:3006';
  serviceRegistry.blockchain = 'http://localhost:3007';
  serviceRegistry.chat = 'http://localhost:3008';
  serviceRegistry.social = 'http://localhost:3009';
  serviceRegistry.ai = 'http://localhost:3010';
  serviceRegistry.notification = 'http://localhost:3011';
}

