import { Router, Request, Response } from 'express';
import { pool } from '../../config/database';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

const router = Router();

/* ── helpers ── */
const STATS_TTL = 30; // Redis TTL seconds

function cacheKey(wallet: string, chain: string, token: string) {
    return `onchain:stats:${wallet.toLowerCase()}:${chain}:${token.toLowerCase()}`;
}

/* ─────────────────────────────────────────────────────────────────
 * POST /api/onchain/tx/record
 * Body: { walletAddress, chain, txHash, tokenAddress, tokenSymbol,
 *         txType, amountToken, amountUsd, priceUsd, pairSymbol,
 *         dexName, blockNumber, txTimestamp }
 * ──────────────────────────────────────────────────────────────── */
router.post('/tx/record', async (req: Request, res: Response) => {
    const {
        walletAddress, chain, txHash,
        tokenAddress = 'native', tokenSymbol = '',
        txType, amountToken = 0, amountUsd = 0, priceUsd = 0,
        pairSymbol = '', dexName = '', blockNumber = 0, txTimestamp,
    } = req.body;

    if (!walletAddress || !chain || !txHash || !txType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const type = String(txType).toUpperCase();
    if (!['BUY', 'SELL', 'TRANSFER'].includes(type)) {
        return res.status(400).json({ error: 'txType must be BUY/SELL/TRANSFER' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert TX log (ignore duplicate hash+wallet+token)
        const logSql = `
      INSERT INTO onchain_tx_log
        (wallet_address, tx_hash, chain, token_address, token_symbol,
         tx_type, amount_token, amount_usd, price_usd, pair_symbol,
         dex_name, block_number, tx_timestamp)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
              to_timestamp($13))
      ON CONFLICT (tx_hash, wallet_address, token_address) DO NOTHING
      RETURNING id
    `;
        const logResult = await client.query(logSql, [
            walletAddress.toLowerCase(), txHash, chain.toUpperCase(),
            tokenAddress.toLowerCase(), tokenSymbol.toUpperCase(),
            type, amountToken, amountUsd, priceUsd, pairSymbol, dexName,
            blockNumber, txTimestamp ? Math.floor(txTimestamp / 1000) : null,
        ]);

        // If already exists (duplicate), skip stats update too
        if (logResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.json({ ok: true, duplicate: true });
        }

        // 2. Upsert stats counters
        const buyInc = type === 'BUY' ? 1 : 0;
        const sellInc = type === 'SELL' ? 1 : 0;
        const xferInc = type === 'TRANSFER' ? 1 : 0;
        const buyVolInc = type === 'BUY' ? amountUsd : 0;
        const sellVolInc = type === 'SELL' ? amountUsd : 0;

        const statsSql = `
      INSERT INTO onchain_wallet_stats
        (wallet_address, chain, token_address, token_symbol,
         buy_count, sell_count, transfer_count,
         buy_volume_usd, sell_volume_usd, last_tx_hash, last_activity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              to_timestamp($11))
      ON CONFLICT (wallet_address, chain, token_address)
      DO UPDATE SET
        buy_count      = onchain_wallet_stats.buy_count       + $5,
        sell_count     = onchain_wallet_stats.sell_count      + $6,
        transfer_count = onchain_wallet_stats.transfer_count  + $7,
        buy_volume_usd = onchain_wallet_stats.buy_volume_usd  + $8,
        sell_volume_usd= onchain_wallet_stats.sell_volume_usd + $9,
        last_tx_hash   = $10,
        last_activity  = to_timestamp($11),
        updated_at     = NOW()
    `;
        await client.query(statsSql, [
            walletAddress.toLowerCase(), chain.toUpperCase(),
            tokenAddress.toLowerCase(), tokenSymbol.toUpperCase(),
            buyInc, sellInc, xferInc, buyVolInc, sellVolInc,
            txHash, txTimestamp ? Math.floor(txTimestamp / 1000) : null,
        ]);

        await client.query('COMMIT');

        // 3. Invalidate Redis cache so next GET returns fresh
        if (redisClient?.isOpen) {
            await redisClient.del(cacheKey(walletAddress, chain, tokenAddress));
        }

        res.json({ ok: true });
    } catch (err: any) {
        await client.query('ROLLBACK');
        logger.error('[onchain] record tx error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/* ─────────────────────────────────────────────────────────────────
 * GET /api/onchain/wallet/:address/stats?chain=BSC&token=native
 * ──────────────────────────────────────────────────────────────── */
router.get('/wallet/:address/stats', async (req: Request, res: Response) => {
    const { address } = req.params;
    const chain = String(req.query.chain || 'BSC').toUpperCase();
    const token = String(req.query.token || 'native').toLowerCase();

    const ck = cacheKey(address, chain, token);

    try {
        // Try Redis first
        if (redisClient?.isOpen) {
            const cached = await redisClient.get(ck);
            if (cached) return res.json(JSON.parse(cached));
        }

        const result = await pool.query(
            `SELECT wallet_address, chain, token_address, token_symbol,
              buy_count, sell_count, transfer_count,
              buy_volume_usd, sell_volume_usd, last_tx_hash,
              last_activity, updated_at
       FROM onchain_wallet_stats
       WHERE wallet_address = $1 AND chain = $2 AND token_address = $3`,
            [address.toLowerCase(), chain, token]
        );

        const row = result.rows[0] || {
            wallet_address: address,
            chain, token_address: token,
            buy_count: 0, sell_count: 0, transfer_count: 0,
            buy_volume_usd: 0, sell_volume_usd: 0,
        };

        if (redisClient?.isOpen) {
            await redisClient.setEx(ck, STATS_TTL, JSON.stringify(row));
        }

        res.json(row);
    } catch (err: any) {
        logger.error('[onchain] get stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─────────────────────────────────────────────────────────────────
 * GET /api/onchain/wallet/:address/history
 *   ?chain=BSC&token=native&limit=50&type=BUY
 * ──────────────────────────────────────────────────────────────── */
router.get('/wallet/:address/history', async (req: Request, res: Response) => {
    const { address } = req.params;
    const chain = String(req.query.chain || 'BSC').toUpperCase();
    const token = String(req.query.token || 'native').toLowerCase();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const type = req.query.type ? String(req.query.type).toUpperCase() : null;

    try {
        let sql = `
      SELECT tx_hash, chain, token_address, token_symbol,
             tx_type, amount_token, amount_usd, price_usd,
             pair_symbol, dex_name, block_number, tx_timestamp, recorded_at
      FROM onchain_tx_log
      WHERE wallet_address = $1 AND chain = $2 AND token_address = $3
    `;
        const params: any[] = [address.toLowerCase(), chain, token];

        if (type) {
            sql += ` AND tx_type = $${params.length + 1}`;
            params.push(type);
        }

        sql += ` ORDER BY tx_timestamp DESC NULLS LAST LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err: any) {
        logger.error('[onchain] get history error:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─────────────────────────────────────────────────────────────────
 * GET /api/onchain/wallet/:address/multi-stats
 *   Returns stats for ALL tokens tracked for this wallet
 * ──────────────────────────────────────────────────────────────── */
router.get('/wallet/:address/multi-stats', async (req: Request, res: Response) => {
    const { address } = req.params;
    try {
        const result = await pool.query(
            `SELECT chain, token_address, token_symbol,
              buy_count, sell_count, transfer_count,
              buy_volume_usd, sell_volume_usd, last_activity
       FROM onchain_wallet_stats
       WHERE wallet_address = $1
       ORDER BY last_activity DESC NULLS LAST`,
            [address.toLowerCase()]
        );
        res.json(result.rows);
    } catch (err: any) {
        logger.error('[onchain] multi-stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─────────────────────────────────────────────────────────────────
 * POST /api/onchain/pair/record-batch
 * Body: { txs: Array<{ chain, pairAddress, txHash, blockNumber,
 *   txType, makerAddress, tokenAmount, quoteAmount, amountUsd,
 *   priceUsd, tokenSymbol, quoteSymbol, dexId, txTimestamp }> }
 * Bulk-inserts decoded swap events (deduped by tx_hash+pair+maker)
 * ──────────────────────────────────────────────────────────────── */
router.post('/pair/record-batch', async (req: Request, res: Response) => {
    const { txs } = req.body;
    if (!Array.isArray(txs) || txs.length === 0) {
        return res.status(400).json({ error: 'txs array required' });
    }

    let inserted = 0;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const tx of txs.slice(0, 200)) {
            const result = await client.query(
                `INSERT INTO onchain_pair_txs
                    (chain, pair_address, tx_hash, block_number, tx_type,
                     maker_address, token_amount, quote_amount, amount_usd,
                     price_usd, token_symbol, quote_symbol, dex_id, tx_timestamp)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                         COALESCE(to_timestamp($14::double precision / 1000), NOW()))
                 ON CONFLICT (tx_hash, pair_address, maker_address) DO NOTHING
                 RETURNING id`,
                [
                    (tx.chain || 'BSC').toUpperCase(),
                    (tx.pairAddress || '').toLowerCase(),
                    tx.txHash || tx.hash || '',
                    tx.blockNumber || 0,
                    (tx.txType || tx.kind || 'BUY').toUpperCase(),
                    (tx.makerAddress || '').toLowerCase(),
                    tx.tokenAmount || 0,
                    tx.quoteAmount || 0,
                    tx.amountUsd || 0,
                    tx.priceUsd || 0,
                    tx.tokenSymbol || '',
                    tx.quoteSymbol || '',
                    tx.dexId || '',
                    tx.txTimestamp || tx.timestamp || Date.now(),
                ]
            );
            if (result.rowCount && result.rowCount > 0) inserted++;
        }
        await client.query('COMMIT');
        res.json({ ok: true, inserted, total: txs.length });
    } catch (err: any) {
        await client.query('ROLLBACK');
        logger.error('[onchain] pair record-batch error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/* ─────────────────────────────────────────────────────────────────
 * GET /api/onchain/pair/:pairAddress/txs
 *   ?chain=BSC&limit=100&type=BUY
 * Returns recent swap events for a pair (newest first)
 * ──────────────────────────────────────────────────────────────── */
router.get('/pair/:pairAddress/txs', async (req: Request, res: Response) => {
    const pair  = req.params.pairAddress.toLowerCase();
    const chain = String(req.query.chain || 'BSC').toUpperCase();
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const type  = req.query.type ? String(req.query.type).toUpperCase() : null;

    try {
        let sql = `
            SELECT tx_hash, chain, pair_address, block_number, tx_type,
                   maker_address, token_amount, quote_amount, amount_usd,
                   price_usd, token_symbol, quote_symbol, dex_id, tx_timestamp
            FROM onchain_pair_txs
            WHERE pair_address = $1 AND chain = $2`;
        const params: any[] = [pair, chain];

        if (type && ['BUY', 'SELL'].includes(type)) {
            sql += ` AND tx_type = $${params.length + 1}`;
            params.push(type);
        }
        sql += ` ORDER BY tx_timestamp DESC NULLS LAST LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (err: any) {
        logger.error('[onchain] pair txs error:', err);
        res.status(500).json({ error: err.message });
    }
});

/* ─────────────────────────────────────────────────────────────────
 * GET /api/onchain/pair/:pairAddress/top-traders
 *   ?chain=BSC&limit=50
 * Returns aggregated trader leaderboard for a pair
 * ──────────────────────────────────────────────────────────────── */
router.get('/pair/:pairAddress/top-traders', async (req: Request, res: Response) => {
    const pair  = req.params.pairAddress.toLowerCase();
    const chain = String(req.query.chain || 'BSC').toUpperCase();
    const limit = Math.min(Number(req.query.limit || 50), 200);

    try {
        const result = await pool.query(
            `SELECT
                maker_address,
                COUNT(*) FILTER (WHERE tx_type = 'BUY')  AS buy_count,
                COUNT(*) FILTER (WHERE tx_type = 'SELL') AS sell_count,
                COUNT(*)                                  AS tx_count,
                COALESCE(SUM(amount_usd), 0)              AS total_volume_usd,
                MAX(tx_timestamp)                         AS last_active
             FROM onchain_pair_txs
             WHERE pair_address = $1 AND chain = $2
             GROUP BY maker_address
             ORDER BY total_volume_usd DESC
             LIMIT $3`,
            [pair, chain, limit]
        );
        res.json(result.rows);
    } catch (err: any) {
        logger.error('[onchain] top-traders error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
