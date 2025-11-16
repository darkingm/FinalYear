import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

// Load .env từ root directory của project
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Verify critical env vars
const requiredEnvVars = [
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_DB_AUTH',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
];

const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.warn('⚠️  Missing environment variables:', missing.join(', '));
  logger.warn('Using default values where available');
} else {
  logger.info('✅ All required environment variables loaded');
}

// Log database config (without password)
logger.info('Database config:', {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || '5433',
  database: process.env.POSTGRES_DB_AUTH || 'auth_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD ? '***' : 'not set',
});

export {};