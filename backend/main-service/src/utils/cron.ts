import cron from 'node-cron';
import { query } from '../config/database';
import { logger } from './logger';
import { publishEvent } from '../config/rabbitmq';

export function initCronJobs() {
    logger.info('Initializing cron jobs...');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            // Find orders that are UNPAID and older than 10 minutes
            const expiredOrdersResult = await query(`
        SELECT order_id, product_id, quantity 
        FROM orders 
        WHERE status = 'UNPAID' 
        AND created_at < NOW() - INTERVAL '10 minutes'
      `);

            const expiredOrders = expiredOrdersResult.rows;

            if (expiredOrders.length > 0) {
                logger.info(`Found ${expiredOrders.length} expired UNPAID orders. Cancelling them...`);

                for (const order of expiredOrders) {
                    try {
                        // Update order status
                        await query(`UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE order_id = $1`, [order.order_id]);

                        // Delete inventory lock
                        await query(`DELETE FROM inventory_locks WHERE order_id = $1`, [order.order_id]);

                        // Restore inventory
                        await query(
                            `UPDATE inventory SET available = available + $1, reserved = GREATEST(0, reserved - $1) WHERE product_id = $2`,
                            [order.quantity, order.product_id]
                        );

                        // Publish event
                        await publishEvent('order.cancelled', { order_id: order.order_id, reason: 'timeout', timestamp: Date.now() });

                        logger.info(`Successfully cancelled expired order ${order.order_id}`);
                    } catch (err: any) {
                        logger.error(`Error cancelling expired order ${order.order_id}:`, err);
                    }
                }
            }
        } catch (error: any) {
            logger.error('Error running expired orders cron job:', error);
        }
    });
}
