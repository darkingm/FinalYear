// Determine if running in Docker or local environment
const isDocker = process.env.DOCKER_ENV === 'true';

// Service URLs configuration
// Note: user-service merged into auth-service, coin-market-service merged into product-service,
// payment-service merged into order-service, social-service merged into chat-service
export const serviceRegistry = {
  auth: process.env.AUTH_SERVICE_URL || (isDocker ? 'http://auth-service:3001' : 'http://localhost:3001'),
  // user-service merged into auth-service
  product: process.env.PRODUCT_SERVICE_URL || (isDocker ? 'http://product-service:3003' : 'http://localhost:3003'),
  // coin-market-service merged into product-service
  order: process.env.ORDER_SERVICE_URL || (isDocker ? 'http://order-service:3005' : 'http://localhost:3005'),
  // payment-service merged into order-service
  blockchain: process.env.BLOCKCHAIN_SERVICE_URL || (isDocker ? 'http://blockchain-service:3007' : 'http://localhost:3007'),
  chat: process.env.CHAT_SERVICE_URL || (isDocker ? 'http://chat-service:3008' : 'http://localhost:3008'),
  // social-service merged into chat-service
  ai: process.env.AI_ANALYSIS_SERVICE_URL || (isDocker ? 'http://ai-analysis-service:3010' : 'http://localhost:3010'),
  notification: process.env.NOTIFICATION_SERVICE_URL || (isDocker ? 'http://notification-service:3011' : 'http://localhost:3011'),
};

