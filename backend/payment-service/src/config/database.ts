import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';
import 'dotenv/config';

// Primary DB for payment service (payment_db)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
  logger.error('Unexpected database error on payment_db:', err);
});

// Secondary DB for reading/updating orders (marketplace_db)
export const mainPool = new Pool({
  connectionString: process.env.MAIN_DATABASE_URL || process.env.DATABASE_URL?.replace('payment_db', 'marketplace_db')?.replace('postgres-payment', 'postgres'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

mainPool.on('error', (err: Error) => {
  logger.error('Unexpected database error on marketplace_db:', err);
});

export async function connectDatabase() {
  try {
    const client = await pool.connect();
    logger.info('Payment service database connected (payment_db)');
    client.release();

    const mainClient = await mainPool.connect();
    logger.info('Main marketplace database connected (marketplace_db)');
    mainClient.release();

    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed payment_db query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Payment DB query error:', { text, error });
    throw error;
  }
}

export async function mainQuery(text: string, params?: any[]): Promise<QueryResult<any>> {
  const start = Date.now();
  try {
    const res = await mainPool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed marketplace_db query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Marketplace DB query error:', { text, error });
    throw error;
  }
}
