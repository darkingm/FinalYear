export const APP_CONFIG = {
  APP_NAME: 'TokenAsset',
  APP_VERSION: '1.0.0',
  API_VERSION: 'v1',
  DEFAULT_LANGUAGE: 'en',
  SUPPORTED_LANGUAGES: ['en', 'vi'],
  DEFAULT_CURRENCY: 'USD',
  DEFAULT_TIMEZONE: 'UTC',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
};

export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRES: '15m',
  REFRESH_TOKEN_EXPIRES: '7d',
  OTP_EXPIRES: 10 * 60 * 1000, // 10 minutes
  OTP_LENGTH: 6,
  PASSWORD_RESET_TOKEN_EXPIRES: 3600000, // 1 hour
};

export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_IMAGES_PER_PRODUCT: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/webm'],
};

export const PRODUCT_CATEGORIES = {
  ELECTRONICS: 'Electronics',
  FASHION: 'Fashion',
  HOME: 'Home & Garden',
  SPORTS: 'Sports & Outdoors',
  TOYS: 'Toys & Games',
  BOOKS: 'Books & Media',
  AUTOMOTIVE: 'Automotive',
  JEWELRY: 'Jewelry & Watches',
  COLLECTIBLES: 'Collectibles & Art',
  REAL_ESTATE: 'Real Estate',
  OTHER: 'Other',
};

export const TRANSACTION_FEES = {
  PLATFORM_FEE_PERCENTAGE: 2.5,
  PAYMENT_GATEWAY_FEE_PERCENTAGE: 2.9,
  PAYMENT_GATEWAY_FIXED_FEE: 0.30,
  BLOCKCHAIN_GAS_BUFFER: 1.2,
  P2P_ESCROW_FEE_PERCENTAGE: 1.0,
};

export const BLOCKCHAIN_CONFIG = {
  CONFIRMATIONS_REQUIRED: 3,
  BLOCK_TIME: 15000, // 15 seconds
  GAS_LIMIT: 3000000,
  MAX_PRIORITY_FEE: '2000000000', // 2 gwei
  MAX_FEE_PER_GAS: '100000000000', // 100 gwei
};

export const RATE_LIMITS = {
  API_CALLS_PER_MINUTE: 60,
  LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPTS_WINDOW: 15 * 60 * 1000, // 15 minutes
  OTP_REQUESTS_PER_HOUR: 5,
  PASSWORD_RESET_PER_DAY: 3,
};

export const EMAIL_CONFIG = {
  VERIFICATION_EXPIRES: 24 * 60 * 60 * 1000, // 24 hours
  SUPPORT_EMAIL: 'support@tokenasset.com',
  NO_REPLY_EMAIL: 'noreply@tokenasset.com',
};

export const WEBSOCKET_EVENTS = {
  // Chat events
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  CHAT_ROOM_UPDATED: 'chat:room_updated',
  
  // Notification events
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  
  // Order events
  ORDER_STATUS_UPDATED: 'order:status_updated',
  
  // P2P events
  P2P_TRADE_MATCHED: 'p2p:trade_matched',
  P2P_PAYMENT_VERIFIED: 'p2p:payment_verified',
  
  // Market events
  COIN_PRICE_UPDATED: 'coin:price_updated',
};

export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  PHONE: /^\+?[\d\s-()]+$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
};

export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  UNAUTHORIZED: 'AUTH_004',
  FORBIDDEN: 'AUTH_005',
  
  // User errors
  USER_NOT_FOUND: 'USER_001',
  USER_ALREADY_EXISTS: 'USER_002',
  USER_SUSPENDED: 'USER_003',
  USER_BANNED: 'USER_004',
  
  // Product errors
  PRODUCT_NOT_FOUND: 'PROD_001',
  PRODUCT_UNAVAILABLE: 'PROD_002',
  INSUFFICIENT_STOCK: 'PROD_003',
  
  // Order errors
  ORDER_NOT_FOUND: 'ORD_001',
  ORDER_CANNOT_BE_CANCELLED: 'ORD_002',
  
  // Payment errors
  PAYMENT_FAILED: 'PAY_001',
  INSUFFICIENT_BALANCE: 'PAY_002',
  INVALID_PAYMENT_METHOD: 'PAY_003',
  
  // Validation errors
  VALIDATION_ERROR: 'VAL_001',
  INVALID_INPUT: 'VAL_002',
  
  // Server errors
  INTERNAL_ERROR: 'SRV_001',
  SERVICE_UNAVAILABLE: 'SRV_002',
  DATABASE_ERROR: 'SRV_003',
};

export const SUCCESS_MESSAGES = {
  en: {
    LOGIN_SUCCESS: 'Login successful',
    REGISTER_SUCCESS: 'Registration successful',
    LOGOUT_SUCCESS: 'Logout successful',
    PROFILE_UPDATED: 'Profile updated successfully',
    PASSWORD_CHANGED: 'Password changed successfully',
    EMAIL_VERIFIED: 'Email verified successfully',
    PRODUCT_CREATED: 'Product created successfully',
    PRODUCT_UPDATED: 'Product updated successfully',
    ORDER_CREATED: 'Order created successfully',
    PAYMENT_SUCCESS: 'Payment completed successfully',
  },
  vi: {
    LOGIN_SUCCESS: 'Đăng nhập thành công',
    REGISTER_SUCCESS: 'Đăng ký thành công',
    LOGOUT_SUCCESS: 'Đăng xuất thành công',
    PROFILE_UPDATED: 'Cập nhật hồ sơ thành công',
    PASSWORD_CHANGED: 'Đổi mật khẩu thành công',
    EMAIL_VERIFIED: 'Xác minh email thành công',
    PRODUCT_CREATED: 'Tạo sản phẩm thành công',
    PRODUCT_UPDATED: 'Cập nhật sản phẩm thành công',
    ORDER_CREATED: 'Tạo đơn hàng thành công',
    PAYMENT_SUCCESS: 'Thanh toán thành công',
  },
};

