// Determine if running in Docker or local environment
const isDocker = process.env.DOCKER_ENV === 'true';

// Service URLs configuration
export const serviceRegistry = {
  auth: process.env.AUTH_SERVICE_URL || (isDocker ? 'http://auth-service:3001' : 'http://localhost:3001'),
  user: process.env.USER_SERVICE_URL || (isDocker ? 'http://user-service:3002' : 'http://localhost:3002'),
  product: process.env.PRODUCT_SERVICE_URL || (isDocker ? 'http://product-service:3003' : 'http://localhost:3003'),
  coinMarket: process.env.COIN_MARKET_SERVICE_URL || (isDocker ? 'http://coin-market-service:3004' : 'http://localhost:3004'),
  order: process.env.ORDER_SERVICE_URL || (isDocker ? 'http://order-service:3005' : 'http://localhost:3005'),
  payment: process.env.PAYMENT_SERVICE_URL || (isDocker ? 'http://payment-service:3006' : 'http://localhost:3006'),
  blockchain: process.env.BLOCKCHAIN_SERVICE_URL || (isDocker ? 'http://blockchain-service:3007' : 'http://localhost:3007'),
  chat: process.env.CHAT_SERVICE_URL || (isDocker ? 'http://chat-service:3008' : 'http://localhost:3008'),
  social: process.env.SOCIAL_SERVICE_URL || (isDocker ? 'http://social-service:3009' : 'http://localhost:3009'),
  ai: process.env.AI_ANALYSIS_SERVICE_URL || (isDocker ? 'http://ai-analysis-service:3010' : 'http://localhost:3010'),
  notification: process.env.NOTIFICATION_SERVICE_URL || (isDocker ? 'http://notification-service:3011' : 'http://localhost:3011'),
};

