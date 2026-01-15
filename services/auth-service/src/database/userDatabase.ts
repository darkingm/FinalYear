import { Sequelize } from 'sequelize';
import logger from '../utils/logger';

// Separate database connection for user_db (from user-service)
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || '5433');
const POSTGRES_DB_USER = process.env.POSTGRES_DB_USER || 'user_db';
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || '1';

const userSequelize = new Sequelize({
  dialect: 'postgres',
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  database: POSTGRES_DB_USER,
  username: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  logging: process.env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  retry: {
    max: 3,
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNREFUSED/,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /ESOCKETTIMEDOUT/,
      /EHOSTUNREACH/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
    ],
  },
});

// Test connection with retry
export const testUserConnection = async (retries = 3): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      await userSequelize.authenticate();
      logger.info(`✅ PostgreSQL (user_db) connected: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB_USER}`);
      return true;
    } catch (error: any) {
      logger.error(`❌ PostgreSQL (user_db) connection attempt ${i + 1}/${retries} failed:`, error.message);
      if (i < retries - 1) {
        const delay = 2000 * (i + 1);
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return false;
};

export { userSequelize };

