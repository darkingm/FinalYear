import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import 'dotenv/config';
import { ensureMainPaymentProjectionInfrastructure } from './ensure-main-schema';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
  logger.error('Unexpected database error:', err);
});

export async function connectDatabase() {
  try {
    const client = await pool.connect();
    await ensureMainPaymentProjectionInfrastructure(client);
    logger.info('Database connected successfully');
    client.release();
    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', { text, error });
    throw error;
  }
}

/** Get a dedicated client for transactions (caller must release() when done) */
export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  return client;
}
