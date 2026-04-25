import { Router, Request, Response } from 'express';
import { query } from '../../db';
import { isAddress } from 'ethers';

export const marketRouter = Router();

/** List active listings for an asset */
marketRouter.get('/:assetId/listings', async (req: Request, res: Response) => {
    try {
        const statusFilter = req.query.status || 'ACTIVE';
        const result = await query(`
            SELECT l.*, a.name AS asset_name, a.symbol, a.price_per_token_usd AS current_price_usd
            FROM rwa_listings l
            JOIN rwa_assets a USING (asset_id)
            WHERE l.asset_id = $1 AND l.status = $2
            ORDER BY l.created_at DESC
            LIMIT 50
        `, [req.params.assetId, statusFilter]);
        res.json({ listings: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Get trade history for an asset */
marketRouter.get('/:assetId/trades', async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT t.*, l.seller_address, l.price_per_token_wei, l.price_per_token_usd,
                   a.name AS asset_name, a.symbol
            FROM rwa_trades t
            JOIN rwa_listings l ON t.listing_id = l.id
            JOIN rwa_assets a ON l.asset_id = a.asset_id
            WHERE l.asset_id = $1
            ORDER BY t.traded_at DESC
            LIMIT 50
        `, [req.params.assetId]);
        res.json({ trades: result.rows });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** Create a listing (record — on-chain escrow done by frontend) */
marketRouter.post('/:assetId/list', async (req: Request, res: Response) => {
    const { seller_address, seller_user_id, token_amount, price_per_token_wei, price_per_token_usd, onchain_listing_id, listing_tx_hash } = req.body;

    const tokenAmount = Number(token_amount);
    const onchainListingId = Number(onchain_listing_id);

    if (!seller_address || !Number.isInteger(tokenAmount) || tokenAmount <= 0 || !price_per_token_wei) {
        return res.status(400).json({ error: 'seller_address, token_amount, and price_per_token_wei required' });
    }
    if (!isAddress(seller_address)) {
        return res.status(400).json({ error: 'Invalid seller address' });
    }
    let pricePerTokenWei: bigint;
    try {
        pricePerTokenWei = BigInt(price_per_token_wei);
    } catch {
        return res.status(400).json({ error: 'price_per_token_wei must be a valid integer string' });
    }
    if (pricePerTokenWei <= 0n) {
        return res.status(400).json({ error: 'price_per_token_wei must be greater than 0' });
    }
    if (!Number.isInteger(onchainListingId) || onchainListingId <= 0 || !listing_tx_hash) {
        return res.status(400).json({
            error: 'On-chain listing required before recording DB listing',
        });
    }

    try {
        const result = await query(`
            INSERT INTO rwa_listings
                (asset_id, seller_address, seller_user_id, token_amount,
                 price_per_token_wei, price_per_token_usd, onchain_listing_id, listing_tx_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            req.params.assetId, seller_address, seller_user_id || null,
            tokenAmount, price_per_token_wei,
            price_per_token_usd || null, onchainListingId,
            listing_tx_hash,
        ]);
        res.status(201).json({ listing: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Cancel a listing — seller ownership enforced.
 * Requires seller_user_id in body (injected by rwa-proxy from auth context).
 */
marketRouter.patch('/listings/:id/cancel', async (req: Request, res: Response) => {
    const { seller_user_id, cancel_tx_hash } = req.body;
    if (!seller_user_id) {
        return res.status(400).json({ error: 'seller_user_id required for cancellation' });
    }
    if (!cancel_tx_hash) {
        return res.status(400).json({ error: 'On-chain cancel transaction required before recording cancellation' });
    }

    try {
        const result = await query(
            `UPDATE rwa_listings SET status = 'CANCELLED', cancel_tx_hash = $3, updated_at = NOW()
             WHERE id = $1 AND status = 'ACTIVE' AND seller_user_id = $2
             RETURNING *`,
            [req.params.id, seller_user_id, cancel_tx_hash]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Listing not found, already cancelled, or not owned by you' });
        }
        res.json({ listing: result.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Record a trade (after on-chain buy completes).
 * Enforces: buyer ≠ seller, buyer_user_id from auth context.
 */
marketRouter.post('/listings/:id/buy', async (req: Request, res: Response) => {
    const { buyer_address, buyer_user_id, trade_tx_hash } = req.body;

    if (!buyer_address) return res.status(400).json({ error: 'buyer_address required' });
    if (!isAddress(buyer_address)) return res.status(400).json({ error: 'Invalid buyer address' });
    if (!trade_tx_hash) {
        return res.status(400).json({ error: 'On-chain buy transaction required before recording trade' });
    }

    try {
        // Get listing
        const listingResult = await query(
            `SELECT * FROM rwa_listings WHERE id = $1 AND status = 'ACTIVE'`, [req.params.id]
        );
        if (listingResult.rows.length === 0) return res.status(404).json({ error: 'Listing not active' });

        const listing = listingResult.rows[0];
        if (!listing.onchain_listing_id || !listing.listing_tx_hash) {
            return res.status(400).json({ error: 'Listing is missing on-chain proof and cannot be filled' });
        }

        // Prevent self-trade
        if (listing.seller_user_id && buyer_user_id && listing.seller_user_id === buyer_user_id) {
            return res.status(400).json({ error: 'Cannot buy your own listing' });
        }
        if (listing.seller_address && buyer_address.toLowerCase() === listing.seller_address.toLowerCase()) {
            return res.status(400).json({ error: 'Cannot buy your own listing' });
        }

        // price_per_token_wei is already in wei, token_amount is regular count
        // e.g. 0.01 ETH/token = 1e16 wei × 10 tokens = 1e17 wei total
        const totalPriceWei = (BigInt(listing.price_per_token_wei) * BigInt(listing.token_amount)).toString();

        // Mark listing filled
        await query(`UPDATE rwa_listings SET status = 'FILLED', updated_at = NOW() WHERE id = $1`, [req.params.id]);

        // Record trade
        const tradeResult = await query(`
            INSERT INTO rwa_trades
                (listing_id, buyer_address, buyer_user_id, token_amount, total_price_wei,
                 total_price_usd, trade_tx_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            req.params.id, buyer_address, buyer_user_id || null,
            listing.token_amount, totalPriceWei,
            listing.price_per_token_usd ? listing.price_per_token_usd * listing.token_amount : null,
            trade_tx_hash,
        ]);

        res.json({ trade: tradeResult.rows[0] });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});
