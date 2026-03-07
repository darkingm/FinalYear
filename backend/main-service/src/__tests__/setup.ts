/**
 * Jest test setup — runs before each test file.
 * Mocks Redis and RabbitMQ so tests only need PostgreSQL.
 */

// ── Mock Redis ─────────────────────────────────────────────────
jest.mock('../config/redis', () => {
  const store: Record<string, string> = {};
  const mockClient = {
    isOpen: true,
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockImplementation((k: string) => Promise.resolve(store[k] ?? null)),
    set: jest.fn().mockImplementation((k: string, v: string) => { store[k] = v; return Promise.resolve('OK'); }),
    setEx: jest.fn().mockImplementation((k: string, _ttl: number, v: string) => { store[k] = v; return Promise.resolve('OK'); }),
    del: jest.fn().mockImplementation((k: string) => { delete store[k]; return Promise.resolve(1); }),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  };
  return {
    redisClient: mockClient,
    connectRedis: jest.fn().mockResolvedValue(mockClient),
    setCache: jest.fn().mockImplementation((k: string, v: any) => {
      store[k] = JSON.stringify(v); return Promise.resolve();
    }),
    getCache: jest.fn().mockImplementation((k: string) => {
      const d = store[k]; return Promise.resolve(d ? JSON.parse(d) : null);
    }),
    deleteCache: jest.fn().mockImplementation((k: string) => {
      delete store[k]; return Promise.resolve();
    }),
  };
});

// ── Mock RabbitMQ ──────────────────────────────────────────────
jest.mock('../config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn().mockResolvedValue({}),
  publishEvent:    jest.fn().mockResolvedValue(undefined),
  subscribeToEvents: jest.fn().mockResolvedValue(undefined),
  getChannel:      jest.fn().mockReturnValue({ publish: jest.fn(), ack: jest.fn() }),
}));

// ── Suppress noisy logger output during tests ──────────────────
jest.mock('../utils/logger', () => ({
  logger: {
    info:  jest.fn(),
    error: jest.fn(),
    warn:  jest.fn(),
    debug: jest.fn(),
  },
}));

// Set test environment vars if not already set
process.env.JWT_SECRET         = process.env.JWT_SECRET         || 'test_jwt_secret_minimum_32_chars_xxx';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_min_32chars_xxx';
process.env.NODE_ENV           = 'test';
process.env.HCAPTCHA_SECRET    = 'your_hcaptcha_secret'; // disable captcha API calls in tests

