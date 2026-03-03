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
        `SELECT il.lock_id, il.inventory_id, il.order_id, il.quantity, inv.product_id
         FROM inventory_locks il
         JOIN inventory inv ON inv.inventory_id = il.inventory_id
         WHERE il.expires_at < NOW() AND il.status = 'active'
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
            'UPDATE inventory SET available = available + $1, reserved = reserved - $1 WHERE inventory_id = $2',
            [row.quantity, row.inventory_id]
          );
          await client.query(
            `UPDATE inventory_locks SET status = 'expired' WHERE lock_id = $1`,
            [row.lock_id]
          );
          await client.query('COMMIT');
          logger.info('Released expired lock', {
            lock_id: row.lock_id,
            order_id: row.order_id,
            product_id: row.product_id,
            quantity: row.quantity,
          });
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error('Inventory cleaner failed for lock', {
            lock_id: row.lock_id,
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
