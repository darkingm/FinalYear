import { pool, query } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Periodically release expired inventory locks and restore available stock.
 * Runs against the shared DB (inventory_locks, inventory tables).
 */
export class InventoryCleanerWorker {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  start() {
    logger.info('Starting inventory cleaner worker');
    this.run();
    this.intervalId = setInterval(() => this.run(), 60 * 1000); // every 1 min
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      logger.info('Inventory cleaner worker stopped');
    }
  }

  private async run() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const expired = await query(
        `SELECT il.product_id, il.order_id, il.quantity
         FROM inventory_locks il
         WHERE il.expires_at < NOW()
         LIMIT 100`
      );

      if (expired.rows.length === 0) {
        this.isRunning = false;
        return;
      }

      for (const row of expired.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            'UPDATE inventory SET available = available + $1 WHERE product_id = $2',
            [row.quantity, row.product_id]
          );
          await client.query('DELETE FROM inventory_locks WHERE order_id = $1', [row.order_id]);
          await client.query('COMMIT');
          logger.info('Released expired lock', {
            order_id: row.order_id,
            product_id: row.product_id,
            quantity: row.quantity,
          });
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error('Inventory cleaner failed for order', {
            order_id: row.order_id,
            error: err,
          });
        } finally {
          client.release();
        }
      }
    } catch (error) {
      logger.error('Inventory cleaner run error', error);
    } finally {
      this.isRunning = false;
    }
  }
}
