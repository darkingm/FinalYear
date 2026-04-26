import cron from 'node-cron';
import { query } from '../config/database';
import { logger } from './logger';
import { publishEvent } from '../config/rabbitmq';
import { runEscrowChainSyncTick } from '../modules/orders/order-onchain-sync.worker';

export function initCronJobs() {
    logger.info('Initializing cron jobs...');

    // ─── Escrow auto-sync ──────────────────────────────────────────────────
    // Reconcile in-flight crypto orders against EscrowCore truth so DB drift
    // (missed events, unrecorded buyer self-refunds, manual contract calls)
    // self-heals without admin intervention. Runs every 2 minutes by default;
    // override with ESCROW_SYNC_CRON.
    const escrowSyncCron = process.env.ESCROW_SYNC_CRON || '*/2 * * * *';
    if (process.env.ESCROW_SYNC_DISABLED !== 'true') {
        cron.schedule(escrowSyncCron, async () => {
            try {
                await runEscrowChainSyncTick();
            } catch (err: any) {
                logger.error('[escrow-sync] tick failed', { err: err?.message });
            }
        });
        logger.info(`[escrow-sync] scheduled with cron "${escrowSyncCron}"`);
    } else {
        logger.warn('[escrow-sync] disabled via ESCROW_SYNC_DISABLED=true');
    }

    // Run every minute — cancel UNPAID orders (+ PayPal TX_SUBMITTED with no money captured) older than 10 minutes
    cron.schedule('* * * * *', async () => {
        try {
            const expiredOrdersResult = await query(`
                SELECT order_id, product_id, quantity
                FROM orders
                WHERE (
                    status = 'UNPAID'
                    OR (status = 'TX_SUBMITTED' AND payment_method = 'paypal')
                )
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
                        // 3. Restore inventory — cap available at total_stock to never violate
                        //    the inventory_consistency check constraint (available <= total_stock).
                        await query(
                            `UPDATE inventory
                             SET available = LEAST(total_stock, available + $1),
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

