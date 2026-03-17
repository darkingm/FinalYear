import cron from 'node-cron';
import { query } from '../config/database';
import { logger } from './logger';
import { publishEvent } from '../config/rabbitmq';

export function initCronJobs() {
    logger.info('Initializing cron jobs...');

    // Run every minute — cancel UNPAID orders older than 10 minutes and restore inventory
    cron.schedule('* * * * *', async () => {
        try {
            const expiredOrdersResult = await query(`
                SELECT order_id, product_id, quantity
                FROM orders
                WHERE status = 'UNPAID'
                AND created_at < NOW() - INTERVAL '10 minutes'
            `);

            const expiredOrders = expiredOrdersResult.rows;
            if (expiredOrders.length === 0) return;

            logger.info(`Found ${expiredOrders.length} expired UNPAID orders. Cancelling...`);

            for (const order of expiredOrders) {
                try {
                    await query('BEGIN');

                    // 1. Mark order cancelled
                    await query(
                        `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1`,
                        [order.order_id]
                    );

                    // 2. Delete the inventory lock and return how many rows were deleted.
                    //    If 0 rows deleted the lock was already gone → skip inventory restore
                    //    to avoid double-releasing stock (which would breach the check constraint).
                    const lockDel = await query(
                        `DELETE FROM inventory_locks WHERE order_id = $1 RETURNING 1`,
                        [order.order_id]
                    );

                    if (lockDel.rowCount && lockDel.rowCount > 0) {
                        // 3. Restore inventory — cap available at total to never violate
                        //    the inventory_consistency check constraint (available <= total).
                        await query(
                            `UPDATE inventory
                             SET available = LEAST(total, available + $1),
                                 reserved  = GREATEST(0, reserved - $1)
                             WHERE product_id = $2`,
                            [order.quantity, order.product_id]
                        );
                    }

                    await query('COMMIT');

                    // 4. Publish event (best-effort, outside transaction)
                    await publishEvent('order.cancelled', {
                        order_id: order.order_id,
                        reason: 'timeout',
                        timestamp: Date.now(),
                    }).catch(() => { /* non-critical */ });

                    logger.info(`Cancelled expired order ${order.order_id} (product ${order.product_id} qty ${order.quantity})`);
                } catch (err: any) {
                    await query('ROLLBACK').catch(() => { });
                    logger.error(`Error cancelling expired order ${order.order_id}:`, err);
                }
            }
        } catch (error: any) {
            logger.error('Error running expired orders cron job:', error);
        }
    });
}

