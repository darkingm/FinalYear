/**
 * Escrow auto-sync worker (Phase 5).
 *
 * Periodically reconciles in-flight crypto orders against the on-chain
 * EscrowCore truth. Detects and patches DB drift caused by:
 *   - Missed `OrderReleased`/`OrderRefunded`/`OrderExpired`/`OrderDisputed`
 *     events (RabbitMQ blip, indexer downtime, etc.).
 *   - Buyer self-refunds via `refundExpired` that hit the chain but the
 *     UI sync POST failed.
 *   - Direct admin/seller contract calls bypassing the API.
 *
 * The worker is idempotent and safe to run from multiple replicas:
 * `syncOrderFromChain` only ever advances DB from in-flight to terminal
 * states, never the other way around (terminal-state guard in Phase 3).
 *
 * Throttling:
 *   - `last_chain_sync_at` (Migration 025) limits RPC churn — orders synced
 *     within `ESCROW_SYNC_THROTTLE_SECONDS` are skipped.
 *   - `ESCROW_SYNC_BATCH_LIMIT` (default 25) caps per-tick fanout.
 *   - Orders are processed serially to avoid spiking RPC providers.
 */

import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { publishEvent } from '../../config/rabbitmq';
import { syncOrderFromChain, type OrderRowForSync } from './order-onchain-sync.service';

const DEFAULT_THROTTLE_SECONDS = 120; // 2 minutes
const DEFAULT_BATCH_LIMIT = 25;

interface TickStats {
    scanned: number;
    updated: number;
    errors: number;
    skipped: number;
}

/**
 * Run a single reconciliation tick. Exposed so admin endpoints can
 * trigger an immediate sweep without waiting for the cron schedule.
 */
export async function runEscrowChainSyncTick(options?: {
    batchLimit?: number;
    throttleSeconds?: number;
    /** Force-sync a specific order regardless of throttle. */
    onlyOrderId?: number;
}): Promise<TickStats> {
    const batchLimit = Math.max(1, Math.min(200,
        options?.batchLimit ?? Number(process.env.ESCROW_SYNC_BATCH_LIMIT) ?? DEFAULT_BATCH_LIMIT
    ));
    const throttleSeconds = Math.max(0,
        options?.throttleSeconds ?? Number(process.env.ESCROW_SYNC_THROTTLE_SECONDS) ?? DEFAULT_THROTTLE_SECONDS
    );

    const stats: TickStats = { scanned: 0, updated: 0, errors: 0, skipped: 0 };

    let rows: OrderRowForSync[];
    if (options?.onlyOrderId) {
        const r = await query(
            `SELECT order_id, internal_order_id, status, payment_method,
                    chain_id, escrow_contract
               FROM orders
              WHERE order_id = $1`,
            [options.onlyOrderId]
        );
        rows = r.rows as OrderRowForSync[];
    } else {
        // Pick the rows oldest-first (NULL last_chain_sync_at first), capped.
        // The partial index from Migration 025 makes this near-O(batchLimit).
        const r = await query(
            `SELECT order_id, internal_order_id, status, payment_method,
                    chain_id, escrow_contract
               FROM orders
              WHERE payment_method = 'crypto'
                AND chain_id IS NOT NULL
                AND escrow_contract IS NOT NULL
                AND status IN (
                    'PAID', 'ONCHAIN_CONFIRMED', 'TX_SUBMITTED',
                    'PROCESSING', 'SHIPPED', 'DELIVERED'
                )
                AND (
                    last_chain_sync_at IS NULL
                    OR last_chain_sync_at < NOW() - ($1 || ' seconds')::interval
                )
              ORDER BY last_chain_sync_at NULLS FIRST
              LIMIT $2`,
            [String(throttleSeconds), batchLimit]
        );
        rows = r.rows as OrderRowForSync[];
    }

    if (rows.length === 0) return stats;

    logger.debug('[escrow-sync] tick start', { count: rows.length, throttleSeconds });

    for (const row of rows) {
        stats.scanned++;
        try {
            const result = await syncOrderFromChain(row);

            // Touch last_chain_sync_at no matter what so we don't immediately
            // re-check the same row next tick. Also stamp a small reason in
            // logs to make drift visible without spamming when nothing changed.
            await query(
                `UPDATE orders SET last_chain_sync_at = NOW() WHERE order_id = $1`,
                [row.order_id]
            );

            if (result.updated) {
                stats.updated++;
                logger.info('[escrow-sync] order patched', {
                    order_id: row.order_id,
                    fromStatus: result.fromStatus,
                    toStatus: result.toStatus,
                    onchainStatus: result.onchainStatus,
                });
                // Best-effort event so downstream listeners (notifications,
                // analytics, etc.) see the same shape they would on a normal
                // status change.
                publishEvent('order.status.updated', {
                    order_id: row.order_id,
                    new_status: result.toStatus,
                    old_status: result.fromStatus,
                    source: 'escrow-auto-sync',
                    onchain_status: result.onchainStatus,
                    timestamp: Date.now(),
                }).catch(() => { /* non-critical */ });
            } else {
                stats.skipped++;
            }
        } catch (err: any) {
            stats.errors++;
            // We swallow per-order errors so one bad row (e.g. unsupported
            // chain, RPC outage) doesn't poison the whole tick. The order's
            // last_chain_sync_at stays untouched, so it will be retried on
            // the next pass — but we log so persistent errors are visible.
            logger.warn('[escrow-sync] order sync failed', {
                order_id: row.order_id,
                err: err?.message,
            });
        }
    }

    if (stats.updated > 0 || stats.errors > 0) {
        logger.info('[escrow-sync] tick done', stats);
    } else {
        logger.debug('[escrow-sync] tick done', stats);
    }
    return stats;
}
