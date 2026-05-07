import { query, getClient } from '../../config/database';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import axios from 'axios';

export class P2PService {
    // ── Offers ────────────────────────────────────────────────────────
    async listOffers(filters: {
        type?: string; token_id?: number; fiat?: string;
        payment?: string; amount?: number; page: number; limit: number;
    }) {
        const { type, token_id, fiat, payment, amount, page, limit } = filters;
        const where: string[] = ["o.status = 'ACTIVE'", "o.filled_amount < o.total_amount"];
        const params: any[] = [];
        let pi = 1;

        if (type) { where.push(`o.offer_type = $${pi++}`); params.push(type.toUpperCase()); }
        if (token_id) { where.push(`o.token_id = $${pi++}`); params.push(token_id); }
        if (fiat) { where.push(`o.fiat_currency = $${pi++}`); params.push(fiat.toUpperCase()); }
        if (payment) { where.push(`o.payment_methods @> $${pi++}::jsonb`); params.push(JSON.stringify([payment])); }
        if (amount) {
            where.push(`o.min_amount <= $${pi} AND o.max_amount >= $${pi}`);
            params.push(amount); pi++;
        }

        const countRes = await query(
            `SELECT COUNT(*) FROM p2p_offers o WHERE ${where.join(' AND ')}`, params
        );
        const total = parseInt(countRes.rows[0].count);

        const limitIdx = pi++;
        const offsetIdx = pi;
        params.push(limit, (page - 1) * limit);

        const res = await query(
            `SELECT o.*,
              tw.symbol, tw.decimals, tw.metadata->>'chain' AS chain_name,
              u.username AS creator_username, u.avatar_url AS creator_avatar,
              sp.rating_avg AS creator_rating, sp.total_sales AS creator_sales,
              (o.total_amount - o.filled_amount) AS available_amount,
              (SELECT COUNT(*) FROM p2p_orders po WHERE po.offer_id = o.offer_id AND po.status = 'CONFIRMED') AS completed_orders
       FROM p2p_offers o
       JOIN token_whitelist tw ON o.token_id = tw.token_id
       JOIN users u            ON o.creator_id = u.user_id
       LEFT JOIN seller_profiles sp ON u.user_id = sp.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY o.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            params
        );

        return { data: res.rows, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
    }

    async getOffer(offerId: number) {
        const res = await query(
            `SELECT o.*,
              tw.symbol, tw.decimals, tw.token_address, tw.chain_id,
              tw.metadata->>'chain' AS chain_name,
              u.username AS creator_username, u.avatar_url AS creator_avatar,
              sp.rating_avg AS creator_rating, sp.total_sales AS creator_sales,
              sp.description AS creator_description,
              (o.total_amount - o.filled_amount) AS available_amount
       FROM p2p_offers o
       JOIN token_whitelist tw ON o.token_id = tw.token_id
       JOIN users u            ON o.creator_id = u.user_id
       LEFT JOIN seller_profiles sp ON u.user_id = sp.user_id
       WHERE o.offer_id = $1`,
            [offerId]
        );
        if (!res.rows.length) throw new AppError('Offer not found', 404);
        return res.rows[0];
    }

    async createOffer(userId: number, data: any) {
        const { offer_type, token_id, fiat_currency, price_per_unit,
            min_amount, max_amount, total_amount, payment_methods,
            payment_time_limit, terms, auto_release } = data;

        if (!['BUY', 'SELL'].includes(offer_type?.toUpperCase())) {
            throw new AppError('offer_type must be BUY or SELL', 400);
        }
        if (min_amount >= max_amount) throw new AppError('min_amount must be less than max_amount', 400);
        if (total_amount <= 0) throw new AppError('total_amount must be positive', 400);
        if (!Array.isArray(payment_methods) || payment_methods.length === 0) {
            throw new AppError('At least one payment method required', 400);
        }

        const res = await query(
            `INSERT INTO p2p_offers
         (creator_id, offer_type, token_id, fiat_currency, price_per_unit,
          min_amount, max_amount, total_amount, payment_methods,
          payment_time_limit, terms, auto_release, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ACTIVE')
       RETURNING *`,
            [userId, offer_type.toUpperCase(), token_id, fiat_currency?.toUpperCase() || 'USD',
                price_per_unit, min_amount, max_amount, total_amount,
                JSON.stringify(payment_methods), payment_time_limit || 15,
                terms || null, auto_release ?? false]
        );
        logger.info('P2P offer created', { offer_id: res.rows[0].offer_id, user_id: userId });
        return res.rows[0];
    }

    async updateOffer(userId: number, offerId: number, data: any) {
        const existing = await query('SELECT * FROM p2p_offers WHERE offer_id = $1', [offerId]);
        if (!existing.rows.length) throw new AppError('Offer not found', 404);
        if (existing.rows[0].creator_id !== userId) throw new AppError('Not authorized', 403);

        const res = await query(
            `UPDATE p2p_offers
       SET price_per_unit    = COALESCE($1, price_per_unit),
           min_amount        = COALESCE($2, min_amount),
           max_amount        = COALESCE($3, max_amount),
           payment_methods   = COALESCE($4::jsonb, payment_methods),
           payment_time_limit = COALESCE($5, payment_time_limit),
           terms             = COALESCE($6, terms),
           updated_at        = NOW()
       WHERE offer_id = $7 RETURNING *`,
            [data.price_per_unit ?? null, data.min_amount ?? null, data.max_amount ?? null,
            data.payment_methods ? JSON.stringify(data.payment_methods) : null,
            data.payment_time_limit ?? null, data.terms ?? null, offerId]
        );
        return res.rows[0];
    }

    async setOfferStatus(userId: number, offerId: number, status: string) {
        const existing = await query('SELECT creator_id FROM p2p_offers WHERE offer_id = $1', [offerId]);
        if (!existing.rows.length) throw new AppError('Offer not found', 404);
        if (existing.rows[0].creator_id !== userId) throw new AppError('Not authorized', 403);
        await query(`UPDATE p2p_offers SET status = $1, updated_at = NOW() WHERE offer_id = $2`, [status, offerId]);
    }

    // ── Orders ──────────────────────────────────────────────────────────
    async getMyOrders(userId: number, role: 'buyer' | 'seller', status?: string) {
        const where = role === 'buyer' ? `po.buyer_id = $1` : `po.seller_id = $1`;
        const params: any[] = [userId];
        let extraWhere = '';
        if (status) { extraWhere = ` AND po.status = $2`; params.push(status.toUpperCase()); }

        const res = await query(
            `SELECT po.*,
              tw.symbol, tw.decimals,
              buyer.username AS buyer_username, buyer.avatar_url AS buyer_avatar,
              seller.username AS seller_username, seller.avatar_url AS seller_avatar
       FROM p2p_orders po
       JOIN token_whitelist tw ON po.token_id = tw.token_id
       JOIN users buyer  ON po.buyer_id  = buyer.user_id
       JOIN users seller ON po.seller_id = seller.user_id
       WHERE ${where}${extraWhere}
       ORDER BY po.created_at DESC`, params
        );
        return res.rows;
    }

    async getOrder(p2pOrderId: number, userId: number) {
        const res = await query(
            `SELECT po.*,
              tw.symbol, tw.decimals, tw.chain_id, tw.token_address,
              buyer.username AS buyer_username, buyer.avatar_url AS buyer_avatar,
              seller.username AS seller_username, seller.avatar_url AS seller_avatar,
              of.payment_methods AS offer_payment_methods, of.terms AS offer_terms,
              of.auto_release
       FROM p2p_orders po
       JOIN token_whitelist tw ON po.token_id = tw.token_id
       JOIN users buyer  ON po.buyer_id  = buyer.user_id
       JOIN users seller ON po.seller_id = seller.user_id
       JOIN p2p_offers of ON po.offer_id = of.offer_id
       WHERE po.p2p_order_id = $1 AND (po.buyer_id = $2 OR po.seller_id = $2)`,
            [p2pOrderId, userId]
        );
        if (!res.rows.length) throw new AppError('Order not found or access denied', 404);
        return res.rows[0];
    }

    async createOrder(buyerId: number, data: {
        offer_id: number; fiat_amount: number; payment_method: string;
    }) {
        const { offer_id, fiat_amount, payment_method } = data;

        const client = await getClient();
        await client.query('BEGIN');
        try {
            // Lock the offer row before reading liquidity, otherwise two
            // concurrent buyers can both observe `available = 10`, both
            // place an 8-unit order, and end up with filled_amount=16
            // overshooting total_amount=10 (no CHECK constraint catches this).
            const offerRes = await client.query(
                `SELECT * FROM p2p_offers WHERE offer_id = $1 AND status = 'ACTIVE' FOR UPDATE`,
                [offer_id]
            );
            if (!offerRes.rows.length) throw new AppError('Offer not found or not active', 404);

            const offer = offerRes.rows[0];
            if (offer.creator_id === buyerId) throw new AppError('Cannot trade with yourself', 400);
            if (fiat_amount < offer.min_amount) throw new AppError(`Minimum order: ${offer.min_amount} ${offer.fiat_currency}`, 400);
            if (fiat_amount > offer.max_amount) throw new AppError(`Maximum order: ${offer.max_amount} ${offer.fiat_currency}`, 400);

            const token_amount = fiat_amount / offer.price_per_unit;
            const available = Number(offer.total_amount) - Number(offer.filled_amount);
            if (token_amount > available) throw new AppError('Insufficient offer liquidity', 400);

            if (!offer.payment_methods.includes(payment_method)) {
                throw new AppError(`Payment method "${payment_method}" not accepted by this offer`, 400);
            }

            const expires_at = new Date(Date.now() + offer.payment_time_limit * 60_000);

            // Lock offer liquidity (UPDATE inside the same tx, row already locked above)
            await client.query(
                `UPDATE p2p_offers SET filled_amount = filled_amount + $1 WHERE offer_id = $2`,
                [token_amount, offer_id]
            );

            // For SELL offer: offer creator is seller, buyer is taker
            // For BUY offer: offer creator is buyer (wants to buy), taker is seller
            const sellerId = offer.offer_type === 'SELL' ? offer.creator_id : buyerId;
            const actualBuyerId = offer.offer_type === 'SELL' ? buyerId : offer.creator_id;

            const orderRes = await client.query(
                `INSERT INTO p2p_orders
           (offer_id, buyer_id, seller_id, token_id, fiat_currency, fiat_amount,
            token_amount, price_per_unit, payment_method, expires_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING')
         RETURNING *`,
                [offer_id, actualBuyerId, sellerId, offer.token_id, offer.fiat_currency,
                    fiat_amount, token_amount, offer.price_per_unit, payment_method, expires_at]
            );

            // System message
            await client.query(
                `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, is_system)
         VALUES ($1,$2,$3,TRUE)`,
                [orderRes.rows[0].p2p_order_id, actualBuyerId,
                `Order created. Please pay ${fiat_amount} ${offer.fiat_currency} within ${offer.payment_time_limit} minutes.`]
            );

            await client.query('COMMIT');
            logger.info('P2P order created', { order_id: orderRes.rows[0].p2p_order_id });
            return orderRes.rows[0];
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
            throw err;
        } finally {
            client.release();
        }
    }

    async markAsPaid(orderId: number, userId: number, paymentMethod: string, proofUrls: string[]) {
        const orderRes = await query('SELECT * FROM p2p_orders WHERE p2p_order_id = $1', [orderId]);
        if (!orderRes.rows.length) throw new AppError('Order not found', 404);
        const order = orderRes.rows[0];

        if (order.buyer_id !== userId) throw new AppError('Only buyer can mark as paid', 403);
        if (order.status !== 'PENDING') throw new AppError(`Cannot mark paid: status is ${order.status}`, 400);
        if (new Date() > new Date(order.expires_at)) throw new AppError('Order has expired', 400);

        await query(
            `UPDATE p2p_orders
       SET status = 'PAID',
           payment_proof = $1::jsonb,
           payment_paid_at = NOW(),
           updated_at = NOW()
       WHERE p2p_order_id = $2`,
            [JSON.stringify(proofUrls), orderId]
        );

        // System message
        await query(
            `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, attachments, is_system)
       VALUES ($1,$2,$3,$4::jsonb,FALSE)`,
            [orderId, userId, `Payment sent via ${paymentMethod}. Please check and confirm.`, JSON.stringify(proofUrls)]
        );

        return (await query('SELECT * FROM p2p_orders WHERE p2p_order_id = $1', [orderId])).rows[0];
    }

    async confirmPayment(orderId: number, sellerId: number) {
        const orderRes = await query('SELECT * FROM p2p_orders WHERE p2p_order_id = $1', [orderId]);
        if (!orderRes.rows.length) throw new AppError('Order not found', 404);
        const order = orderRes.rows[0];

        if (order.seller_id !== sellerId) throw new AppError('Only seller can confirm payment', 403);
        if (order.status !== 'PAID') throw new AppError(`Cannot confirm: status is ${order.status}`, 400);

        await query(
            `UPDATE p2p_orders
       SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
       WHERE p2p_order_id = $1`,
            [orderId]
        );

        // System message
        await query(
            `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, is_system)
       VALUES ($1,$2,'Payment confirmed. Crypto will be released shortly.',TRUE)`,
            [orderId, sellerId]
        );

        logger.info('P2P payment confirmed', { order_id: orderId, seller_id: sellerId });
        return (await query('SELECT * FROM p2p_orders WHERE p2p_order_id = $1', [orderId])).rows[0];
    }

    async cancelOrder(orderId: number, userId: number, reason?: string) {
        const client = await getClient();
        await client.query('BEGIN');
        try {
            // Lock the order row before validating status — otherwise two
            // concurrent cancels both see status='PENDING', both pass the
            // check, and the offer's filled_amount gets decremented twice
            // (effectively duping liquidity).
            const orderRes = await client.query(
                'SELECT * FROM p2p_orders WHERE p2p_order_id = $1 FOR UPDATE',
                [orderId]
            );
            if (!orderRes.rows.length) throw new AppError('Order not found', 404);
            const order = orderRes.rows[0];

            if (order.buyer_id !== userId && order.seller_id !== userId) throw new AppError('Access denied', 403);
            if (!['PENDING'].includes(order.status)) throw new AppError(`Cannot cancel: status is ${order.status}`, 400);

            // Return liquidity to offer
            await client.query(
                `UPDATE p2p_offers SET filled_amount = GREATEST(0, filled_amount - $1) WHERE offer_id = $2`,
                [order.token_amount, order.offer_id]
            );
            await client.query(
                `UPDATE p2p_orders SET status = 'CANCELLED', updated_at = NOW() WHERE p2p_order_id = $1`, [orderId]
            );
            await client.query(
                `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, is_system) VALUES ($1,$2,$3,TRUE)`,
                [orderId, userId, `Order cancelled${reason ? ': ' + reason : '.'}`]
            );
            await client.query('COMMIT');
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
            throw err;
        } finally {
            client.release();
        }
        return (await query('SELECT * FROM p2p_orders WHERE p2p_order_id = $1', [orderId])).rows[0];
    }

    async openDispute(orderId: number, userId: number, reason: string, description: string, evidenceUrls: string[]) {
        const orderRes = await query('SELECT * FROM p2p_orders WHERE p2p_order_id = $1', [orderId]);
        if (!orderRes.rows.length) throw new AppError('Order not found', 404);
        const order = orderRes.rows[0];

        if (order.buyer_id !== userId && order.seller_id !== userId) throw new AppError('Access denied', 403);
        if (!['PAID', 'PENDING'].includes(order.status)) throw new AppError('Cannot dispute this order', 400);

        const existing = await query('SELECT dispute_id FROM p2p_disputes WHERE p2p_order_id = $1 AND status != $2', [orderId, 'CLOSED']);
        if (existing.rows.length) throw new AppError('A dispute already exists for this order', 400);

        await query(`UPDATE p2p_orders SET status = 'DISPUTED', updated_at = NOW() WHERE p2p_order_id = $1`, [orderId]);

        const disputeRes = await query(
            `INSERT INTO p2p_disputes (p2p_order_id, raised_by, reason, description, evidence, status)
       VALUES ($1,$2,$3,$4,$5::jsonb,'OPEN') RETURNING *`,
            [orderId, userId, reason.toUpperCase(), description, JSON.stringify(evidenceUrls)]
        );

        await query(
            `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, is_system) VALUES ($1,$2,$3,TRUE)`,
            [orderId, userId, `Dispute opened: ${reason}. Admin will review within 24 hours.`]
        );

        logger.info('P2P dispute opened', { order_id: orderId, dispute_id: disputeRes.rows[0].dispute_id });
        return disputeRes.rows[0];
    }

    // ── Messages ────────────────────────────────────────────────────────
    async getMessages(orderId: number, userId: number) {
        const orderRes = await query('SELECT buyer_id, seller_id FROM p2p_orders WHERE p2p_order_id = $1', [orderId]);
        if (!orderRes.rows.length) throw new AppError('Order not found', 404);
        const order = orderRes.rows[0];
        if (order.buyer_id !== userId && order.seller_id !== userId) throw new AppError('Access denied', 403);

        const res = await query(
            `SELECT m.*, u.username, u.avatar_url
       FROM p2p_messages m JOIN users u ON m.sender_id = u.user_id
       WHERE m.p2p_order_id = $1
       ORDER BY m.created_at ASC`,
            [orderId]
        );
        return res.rows;
    }

    async sendMessage(orderId: number, userId: number, message: string, attachments: string[]) {
        const orderRes = await query('SELECT buyer_id, seller_id, status FROM p2p_orders WHERE p2p_order_id = $1', [orderId]);
        if (!orderRes.rows.length) throw new AppError('Order not found', 404);
        const order = orderRes.rows[0];
        if (order.buyer_id !== userId && order.seller_id !== userId) throw new AppError('Access denied', 403);
        if (['COMPLETED', 'CANCELLED', 'RESOLVED_BUYER', 'RESOLVED_SELLER'].includes(order.status)) {
            throw new AppError('Order is closed', 400);
        }

        const res = await query(
            `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, attachments)
       VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
            [orderId, userId, message, JSON.stringify(attachments)]
        );
        return res.rows[0];
    }

    // ── Admin ────────────────────────────────────────────────────────────
    async adminListDisputes(status?: string) {
        const where = status ? `WHERE d.status = $1` : `WHERE d.status != 'CLOSED'`;
        const params = status ? [status.toUpperCase()] : [];

        const res = await query(
            `SELECT d.*,
              po.fiat_amount, po.token_amount, po.fiat_currency,
              tw.symbol,
              raiser.username AS raised_by_username,
              buyer.username AS buyer_username,
              seller.username AS seller_username
       FROM p2p_disputes d
       JOIN p2p_orders po  ON d.p2p_order_id = po.p2p_order_id
       JOIN token_whitelist tw ON po.token_id = tw.token_id
       JOIN users raiser  ON d.raised_by = raiser.user_id
       JOIN users buyer   ON po.buyer_id  = buyer.user_id
       JOIN users seller  ON po.seller_id = seller.user_id
       ${where}
       ORDER BY d.created_at DESC`,
            params
        );
        return res.rows;
    }

    async adminResolveDispute(disputeId: number, adminId: number, resolution: string, adminNotes: string) {
        const disputeRes = await query('SELECT * FROM p2p_disputes WHERE dispute_id = $1', [disputeId]);
        if (!disputeRes.rows.length) throw new AppError('Dispute not found', 404);

        const allowedResolutions = ['BUYER_WINS', 'SELLER_WINS', 'SPLIT', 'CANCELLED'];
        if (!allowedResolutions.includes(resolution.toUpperCase())) {
            throw new AppError(`Resolution must be one of: ${allowedResolutions.join(', ')}`, 400);
        }

        await query(
            `UPDATE p2p_disputes
       SET status = 'RESOLVED', resolution = $1, admin_notes = $2,
           resolver_id = $3, updated_at = NOW()
       WHERE dispute_id = $4`,
            [resolution.toUpperCase(), adminNotes, adminId, disputeId]
        );

        // Update order status based on resolution
        const dispute = disputeRes.rows[0];
        const orderStatus = resolution === 'BUYER_WINS' ? 'RESOLVED_BUYER'
            : resolution === 'SELLER_WINS' ? 'RESOLVED_SELLER' : 'RESOLVED_SELLER';

        await query(
            `UPDATE p2p_orders SET status = $1, updated_at = NOW() WHERE p2p_order_id = $2`,
            [orderStatus, dispute.p2p_order_id]
        );

        await query(
            `INSERT INTO p2p_messages (p2p_order_id, sender_id, message, is_system)
       VALUES ($1,$2,$3,TRUE)`,
            [dispute.p2p_order_id, adminId, `Dispute resolved by admin: ${resolution}. ${adminNotes || ''}`]
        );

        logger.info('P2P dispute resolved', { dispute_id: disputeId, resolution, admin_id: adminId });
    }

    /**
     * Resolve a product-order dispute (not P2P) and optionally trigger on-chain refund.
     * Called by admin when a buyer wins a dispute on a regular order (crypto-paid).
     */
    async adminResolveOrderDispute(orderId: number, adminId: number, winner: 'BUYER' | 'SELLER', adminNotes: string) {
        // Get order details
        const orderRes = await query(
            `SELECT o.order_id, o.internal_order_id, o.status, o.chain_id, o.escrow_contract,
                    o.payment_method, o.tx_hash, d.dispute_id
             FROM orders o
             LEFT JOIN disputes d ON o.order_id = d.order_id AND d.status = 'OPEN'
             WHERE o.order_id = $1`,
            [orderId]
        );

        if (!orderRes.rows.length) throw new AppError('Order not found', 404);
        const order = orderRes.rows[0];

        const newStatus = winner === 'BUYER' ? 'REFUNDED' : 'COMPLETED';

        // Update order & dispute
        await query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`,
            [newStatus, orderId]
        );
        if (order.dispute_id) {
            await query(
                `UPDATE disputes SET status = 'RESOLVED', resolution = $1, resolved_by = $2,
                        admin_notes = $3, resolved_at = NOW()
                 WHERE dispute_id = $4`,
                [winner === 'BUYER' ? 'BUYER_WINS' : 'SELLER_WINS', adminId, adminNotes, order.dispute_id]
            );
        }

        let onChainTxHash: string | null = null;
        let onChainError: string | null = null;

        // Trigger on-chain action if order was crypto-paid
        const isCryptoPaid = order.payment_method === 'CRYPTO' || order.tx_hash;
        if (isCryptoPaid && order.escrow_contract) {
            const paymentUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-api:3002';
            const endpoint = winner === 'BUYER'
                ? `${paymentUrl}/api/payments/crypto/refund`
                : `${paymentUrl}/api/payments/crypto/release`;

            try {
                const resp = await axios.post(
                    endpoint,
                    { order_id: orderId },
                    {
                        headers: { 'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY },
                        timeout: 30_000,
                    }
                );
                onChainTxHash = resp.data?.tx_hash || null;
                logger.info('On-chain dispute resolution completed', {
                    orderId, winner, tx_hash: onChainTxHash,
                });
            } catch (err: any) {
                // Log but don't fail — DB is already updated, on-chain can be retried manually
                onChainError = err.response?.data?.message || err.message;
                logger.error('On-chain dispute resolution failed (DB updated, retry manually)', {
                    orderId, winner, error: onChainError,
                });
            }
        }

        return {
            success: true,
            order_id: orderId,
            new_status: newStatus,
            winner,
            on_chain_tx_hash: onChainTxHash,
            on_chain_error: onChainError,
            notes: 'DB updated. On-chain refund/release triggered if crypto-paid.',
        };
    }
}
