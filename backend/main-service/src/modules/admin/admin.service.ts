import { query } from '../../config/database';
import { publishEvent } from '../../config/rabbitmq';
import { AppError } from '../../middleware/error-handler';
import { logger } from '../../utils/logger';
import { deleteCache } from '../../config/redis';

export class AdminService {
    // ─── Dashboard Stats ──────────────────────────────────────────────

    async getDashboardStats() {
        const [
            usersResult,
            ordersResult,
            revenueResult,
            disputesResult,
            recentOrdersResult,
            ordersByStatusResult,
            dailyRevenueResult,
        ] = await Promise.all([
            query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'active\') as active FROM users'),
            query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL \'24 hours\') as today FROM orders'),
            query('SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COALESCE(SUM(total_amount) FILTER (WHERE created_at > NOW() - INTERVAL \'30 days\'), 0) as monthly FROM orders WHERE status IN (\'PAID\', \'COMPLETED\', \'ONCHAIN_CONFIRMED\', \'DELIVERING\', \'completed\', \'delivered\')'),
            query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'open\') as open FROM disputes'),
            query(`SELECT o.order_id, o.order_number, o.status, o.total_amount, o.amount_token, tw.symbol as token_symbol, o.payment_method, o.created_at,
              buyer.username as buyer_name, seller_p.display_name as seller_name
             FROM orders o
             LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
             LEFT JOIN seller_profiles seller_p ON o.seller_id = seller_p.seller_id
             LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
             ORDER BY o.created_at DESC LIMIT 10`),
            query(`SELECT status, COUNT(*) as count FROM orders GROUP BY status ORDER BY count DESC`),
            query(`SELECT DATE(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as count
             FROM orders
             WHERE created_at > NOW() - INTERVAL '30 days'
             GROUP BY DATE(created_at)
             ORDER BY date ASC`),
        ]);

        return {
            users: usersResult.rows[0],
            orders: ordersResult.rows[0],
            revenue: revenueResult.rows[0],
            disputes: disputesResult.rows[0],
            recentOrders: recentOrdersResult.rows,
            ordersByStatus: ordersByStatusResult.rows,
            dailyRevenue: dailyRevenueResult.rows,
        };
    }

    // ─── Orders Management ────────────────────────────────────────────

    async getAllOrders(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
        payment_method?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.status) {
            whereClause += ` AND o.status = $${paramIdx++}`;
            queryParams.push(params.status);
        }

        if (params.payment_method) {
            whereClause += ` AND o.payment_method = $${paramIdx++}`;
            queryParams.push(params.payment_method);
        }

        if (params.search) {
            whereClause += ` AND (o.order_number ILIKE $${paramIdx} OR buyer.username ILIKE $${paramIdx} OR buyer.email ILIKE $${paramIdx})`;
            queryParams.push(`%${params.search}%`);
            paramIdx++;
        }

        const countResult = await query(
            `SELECT COUNT(*) as total FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       ${whereClause}`,
            queryParams
        );

        const result = await query(
            `SELECT o.*, 
              buyer.username as buyer_name, buyer.email as buyer_email, buyer.wallet_address as buyer_wallet,
              seller_p.display_name as seller_name,
              p.name as product_name,
              tw.symbol as token_symbol,
              pay.tx_hash as payment_tx_hash, pay.status as payment_status, pay.confirmations
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN seller_profiles seller_p ON o.seller_id = seller_p.seller_id
       LEFT JOIN products p ON o.product_id = p.product_id
       LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
       LEFT JOIN payments pay ON o.order_id = pay.order_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return {
            orders: result.rows,
            total: parseInt(countResult.rows[0].total),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        };
    }

    async getOrderDetail(orderId: number) {
        const result = await query(
            `SELECT o.*, 
              buyer.username as buyer_name, buyer.email as buyer_email, buyer.wallet_address as buyer_wallet,
              seller_u.username as seller_username, seller_u.email as seller_email, seller_u.wallet_address as seller_wallet,
              seller_p.display_name as seller_name,
              p.name as product_name, p.base_price_usd as product_price,
              tw.symbol as token_symbol,
              NULL as product_token_id, NULL as product_token_symbol, NULL as product_token_decimals,
              pay.tx_hash as payment_tx_hash, pay.status as payment_status, pay.confirmations,
              pay.block_number as payment_block, pay.gas_used as payment_gas
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN seller_profiles seller_p ON o.seller_id = seller_p.seller_id
       LEFT JOIN users seller_u ON seller_p.user_id = seller_u.user_id
       LEFT JOIN products p ON o.product_id = p.product_id
       LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
       LEFT JOIN payments pay ON o.order_id = pay.order_id
       WHERE o.order_id = $1`,
            [orderId]
        );

        if (result.rows.length === 0) {
            throw new AppError('Order not found', 404);
        }

        // Get order history
        const historyResult = await query(
            `SELECT osh.*, u.username as changed_by_name
       FROM order_status_history osh
       LEFT JOIN users u ON osh.changed_by = u.user_id
       WHERE osh.order_id = $1
       ORDER BY osh.changed_at DESC`,
            [orderId]
        );

        // Get disputes for this order
        const disputeResult = await query(
            `SELECT d.*, u.username as raised_by_name, r.username as resolver_name
       FROM disputes d
       LEFT JOIN users u ON d.raised_by = u.user_id
       LEFT JOIN users r ON d.resolver_id = r.user_id
       WHERE d.order_id = $1
       ORDER BY d.created_at DESC`,
            [orderId]
        );

        return {
            ...result.rows[0],
            statusHistory: historyResult.rows,
            disputes: disputeResult.rows,
        };
    }

    async updateOrderStatus(orderId: number, status: string, adminId: number, notes?: string) {
        const validStatuses = ['UNPAID', 'TX_SUBMITTED', 'TX_FAILED', 'ONCHAIN_CONFIRMED', 'PAID', 'DELIVERING', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'REFUNDED'];
        if (!validStatuses.includes(status)) {
            throw new AppError(`Invalid status: ${status}`, 400);
        }

        await query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2`,
            [status, orderId]
        );

        // Log status change with admin info
        await query(
            `INSERT INTO order_status_history (order_id, old_status, new_status, notes, changed_by)
       SELECT status, status, $2, $3, $4 FROM orders WHERE order_id = $1`,
            [orderId, status, notes || `Status updated by admin`, adminId]
        );

        await publishEvent('order.status.updated', {
            order_id: orderId,
            new_status: status,
            changed_by: adminId,
            timestamp: Date.now(),
        });

        logger.info('Admin updated order status', { orderId, status, adminId });
        return this.getOrderDetail(orderId);
    }

    // ─── Users Management ─────────────────────────────────────────────

    async getAllUsers(params: {
        page?: number;
        limit?: number;
        role?: string;
        status?: string;
        search?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.role) {
            whereClause += ` AND u.role = $${paramIdx++}`;
            queryParams.push(params.role);
        }

        if (params.status) {
            whereClause += ` AND u.status = $${paramIdx++}`;
            queryParams.push(params.status);
        }

        if (params.search) {
            whereClause += ` AND (u.username ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.wallet_address ILIKE $${paramIdx})`;
            queryParams.push(`%${params.search}%`);
            paramIdx++;
        }

        const countResult = await query(`SELECT COUNT(*) as total FROM users u ${whereClause}`, queryParams);

        const result = await query(
            `SELECT u.user_id, u.email, u.username, u.wallet_address, u.avatar_url, u.role, u.status, u.created_at,
              (SELECT COUNT(*) FROM orders WHERE buyer_id = u.user_id) as orders_as_buyer,
              (SELECT COUNT(*) FROM orders o2 JOIN seller_profiles sp ON o2.seller_id = sp.seller_id WHERE sp.user_id = u.user_id) as orders_as_seller,
              sp.display_name as seller_display_name, sp.kyc_status, sp.rating_avg as seller_rating
       FROM users u
       LEFT JOIN seller_profiles sp ON sp.user_id = u.user_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return {
            users: result.rows,
            total: parseInt(countResult.rows[0].total),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        };
    }

    async updateUserStatus(userId: number, status: string, adminId: number) {
        const validStatuses = ['active', 'suspended', 'banned'];
        if (!validStatuses.includes(status)) {
            throw new AppError('Invalid status', 400);
        }

        await query(
            'UPDATE users SET status = $1, updated_at = NOW() WHERE user_id = $2',
            [status, userId]
        );

        await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, changed_by)
       VALUES ('user', $1, 'status_update', $2, $3)`,
            [userId, JSON.stringify({ status }), adminId]
        );

        logger.info('Admin updated user status', { userId, status, adminId });
    }

    async updateUserRole(userId: number, role: string, adminId: number) {
        const validRoles = ['buyer', 'seller', 'admin'];
        if (!validRoles.includes(role)) {
            throw new AppError('Invalid role', 400);
        }

        await query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2',
            [role, userId]
        );

        // If setting as seller, create seller_profile if not exists
        if (role === 'seller') {
            const existingProfile = await query(
                'SELECT * FROM seller_profiles WHERE user_id = $1',
                [userId]
            );
            if (existingProfile.rows.length === 0) {
                const userResult = await query('SELECT username, wallet_address FROM users WHERE user_id = $1', [userId]);
                const user = userResult.rows[0];
                await query(
                    `INSERT INTO seller_profiles (user_id, display_name, payout_wallet, kyc_status)
           VALUES ($1, $2, $3, 'pending')`,
                    [userId, user.username || 'Seller', user.wallet_address || '0x0000000000000000000000000000000000000000']
                );
            }
        }

        logger.info('Admin updated user role', { userId, role, adminId });
    }

    // ─── Disputes Management ──────────────────────────────────────────

    async getAllDisputes(params: {
        page?: number;
        limit?: number;
        status?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.status) {
            whereClause += ` AND d.status = $${paramIdx++}`;
            queryParams.push(params.status);
        }

        const countResult = await query(
            `SELECT COUNT(*) as total FROM disputes d ${whereClause}`,
            queryParams
        );

        const result = await query(
            `SELECT d.*,
              o.order_number, o.total_amount, o.amount_token, tw.symbol as token_symbol, o.payment_method, o.status as order_status,
              o.internal_order_id, o.tx_hash, o.chain_id,
              raiser.username as raised_by_name, raiser.email as raised_by_email,
              resolver.username as resolver_name,
              buyer.username as buyer_name, buyer.wallet_address as buyer_wallet,
              seller_u.username as seller_name, seller_u.wallet_address as seller_wallet
       FROM disputes d
       JOIN orders o ON d.order_id = o.order_id
       LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
       LEFT JOIN users raiser ON d.raised_by = raiser.user_id
       LEFT JOIN users resolver ON d.resolver_id = resolver.user_id
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN seller_profiles sp ON o.seller_id = sp.seller_id
       LEFT JOIN users seller_u ON sp.user_id = seller_u.user_id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return {
            disputes: result.rows,
            total: parseInt(countResult.rows[0].total),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        };
    }

    async resolveDispute(
        disputeId: number,
        resolution: string,
        status: 'resolved' | 'closed',
        adminId: number
    ) {
        await query(
            `UPDATE disputes 
       SET status = $1, resolution = $2, resolver_id = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE dispute_id = $4`,
            [status, resolution, adminId, disputeId]
        );

        await publishEvent('dispute.resolved', {
            dispute_id: disputeId,
            resolution,
            resolved_by: adminId,
            timestamp: Date.now(),
        });

        logger.info('Admin resolved dispute', { disputeId, status, adminId });
    }

    // ─── Refunds ──────────────────────────────────────────────────────

    async initiateRefund(
        orderId: number,
        reason: string,
        adminId: number
    ) {
        // Get order details
        const orderResult = await query(
            `SELECT o.*, pay.payment_id as op_payment_id
       FROM orders o
       LEFT JOIN order_payments pay ON o.order_id = pay.order_id
       WHERE o.order_id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            throw new AppError('Order not found', 404);
        }

        const order = orderResult.rows[0];
        const allowedStatuses = ['PAID', 'ONCHAIN_CONFIRMED', 'DELIVERING', 'COMPLETED', 'DISPUTED'];
        if (!allowedStatuses.includes(order.status)) {
            throw new AppError(`Cannot refund order with status: ${order.status}`, 400);
        }

        // Create refund record
        const refundResult = await query(
            `INSERT INTO refunds (order_id, payment_id, amount, reason, status, approved_by)
       VALUES ($1, $2, $3, $4, 'approved', $5)
       RETURNING *`,
            [orderId, order.op_payment_id || 1, order.amount_token || order.total_amount, reason, adminId]
        );

        // Update order status
        await query(
            `UPDATE orders SET status = 'REFUNDED', updated_at = NOW() WHERE order_id = $1`,
            [orderId]
        );

        await publishEvent('refund.initiated', {
            order_id: orderId,
            refund_id: refundResult.rows[0].refund_id,
            amount: order.total_amount,
            reason,
            initiated_by: adminId,
            timestamp: Date.now(),
        });

        logger.info('Admin initiated refund', { orderId, adminId, reason });

        return refundResult.rows[0];
    }

    async getAllRefunds(params: { page?: number; limit?: number; status?: string }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.status) {
            whereClause += ` AND r.status = $${paramIdx++}`;
            queryParams.push(params.status);
        }

        const result = await query(
            `SELECT r.*,
              o.order_number, o.total_amount as order_total, o.amount_token, tw.symbol as token_symbol, o.payment_method,
              o.internal_order_id, o.tx_hash, o.chain_id,
              buyer.username as buyer_name, buyer.wallet_address as buyer_wallet,
              admin_u.username as approved_by_name
       FROM refunds r
       JOIN orders o ON r.order_id = o.order_id
       LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN users admin_u ON r.approved_by = admin_u.user_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return {
            refunds: result.rows,
            page,
            limit,
        };
    }

    async updateRefundStatus(refundId: number, status: string, txHash?: string) {
        const validStatuses = ['pending', 'approved', 'processing', 'completed', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new AppError('Invalid refund status', 400);
        }

        const updateFields: string[] = ['status = $1', 'processed_at = NOW()'];
        const params: any[] = [status];

        if (txHash) {
            updateFields.push(`escrow_release_tx = $${params.length + 1}`);
            params.push(txHash);
        }

        params.push(refundId);

        await query(
            `UPDATE refunds SET ${updateFields.join(', ')} WHERE refund_id = $${params.length}`,
            params
        );

        logger.info('Refund status updated', { refundId, status, txHash });
    }

    // ─── Products Management ──────────────────────────────────────────

    async getAllProducts(params: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.status) {
            whereClause += ` AND p.status = $${paramIdx++}`;
            queryParams.push(params.status);
        }

        if (params.search) {
            whereClause += ` AND (p.name ILIKE $${paramIdx} OR p.category ILIKE $${paramIdx})`;
            queryParams.push(`%${params.search}%`);
            paramIdx++;
        }

        const countResult = await query(`SELECT COUNT(*) as total FROM products p ${whereClause}`, queryParams);

        const result = await query(
            `SELECT p.*, sp.display_name as seller_name, u.email as seller_email,
              NULL as token_symbol, NULL as token_decimals,
              (SELECT COUNT(*) FROM orders WHERE product_id = p.product_id) as order_count,
              i.available as stock_available, i.reserved as stock_reserved
       FROM products p
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       LEFT JOIN users u ON sp.user_id = u.user_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return {
            products: result.rows,
            total: parseInt(countResult.rows[0].total),
            page,
            limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        };
    }

    async updateProductStatus(productId: number, status: string, adminId: number) {
        const validStatuses = ['active', 'inactive', 'deleted'];
        if (!validStatuses.includes(status)) {
            throw new AppError('Invalid product status', 400);
        }

        await query(
            'UPDATE products SET status = $1, updated_at = NOW() WHERE product_id = $2',
            [status, productId]
        );

        await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, changed_by)
       VALUES ('product', $1, 'status_update', $2, $3)`,
            [productId, JSON.stringify({ status }), adminId]
        );

        logger.info('Admin updated product status', { productId, status, adminId });
    }

    // ─── Platform Settings ────────────────────────────────────────────

    async getTokenWhitelist() {
        const result = await query(
            'SELECT * FROM token_whitelist ORDER BY chain_id, symbol'
        );
        return result.rows;
    }

    async updateTokenStatus(tokenId: number, isActive: boolean) {
        await query(
            'UPDATE token_whitelist SET is_active = $1 WHERE token_id = $2',
            [isActive, tokenId]
        );
        await deleteCache('token_whitelist');
    }

    async getAuditLogs(params: { page?: number; limit?: number; entity_type?: string }) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.entity_type) {
            whereClause += ` AND al.entity_type = $${paramIdx++}`;
            queryParams.push(params.entity_type);
        }

        const result = await query(
            `SELECT al.*, u.username as changed_by_name
       FROM audit_logs al
       LEFT JOIN users u ON al.changed_by = u.user_id
       ${whereClause}
       ORDER BY al.timestamp DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return { logs: result.rows, page, limit };
    }

    // ─── Smart Contract Info ──────────────────────────────────────────

    async getEscrowOrders() {
        // Get all orders that have on-chain data  
        const result = await query(
            `SELECT o.order_id, o.order_number, o.internal_order_id, o.status,
              o.tx_hash, o.chain_id, o.escrow_contract, o.amount_token, tw.symbol as token_symbol,
              o.total_amount, o.payment_method,
              buyer.username as buyer_name, buyer.wallet_address as buyer_wallet,
              seller_u.wallet_address as seller_wallet,
              seller_p.display_name as seller_name
       FROM orders o
       LEFT JOIN users buyer ON o.buyer_id = buyer.user_id
       LEFT JOIN seller_profiles seller_p ON o.seller_id = seller_p.seller_id
       LEFT JOIN users seller_u ON seller_p.user_id = seller_u.user_id
       LEFT JOIN token_whitelist tw ON o.token_id = tw.token_id
       WHERE o.payment_method = 'crypto' AND o.tx_hash IS NOT NULL
       ORDER BY o.created_at DESC`
        );

        return result.rows;
    }

    // ─── 1. Extended Product Management ───────────────────────────────

    async createProduct(data: any, adminId: number) {
        const { seller_id, name, description, category, base_price_usd, status, stock, warehouse_id, pricing_mode, token_id, price_token } = data;

        await query('BEGIN');
        try {
            const productResult = await query(
                `INSERT INTO products (seller_id, name, description, category, base_price_usd, status)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [seller_id, name, description, category, base_price_usd || 0, status || 'active']
            );
            const product = productResult.rows[0];

            // token_id insertion logic removed because product_accepted_tokens table no longer exists

            if (stock && warehouse_id) {
                await query(
                    `INSERT INTO inventory (product_id, warehouse_id, total_stock, available)
                     VALUES ($1, $2, $3, $4)`,
                    [product.product_id, warehouse_id, stock, stock]
                );
            }

            await query(
                `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, changed_by)
                 VALUES ('product', $1, 'created_by_admin', $2, $3)`,
                [product.product_id, JSON.stringify(product), adminId]
            );

            await query('COMMIT');
            return product;
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    async updateProductDetail(productId: number, data: any, adminId: number) {
        const { name, description, category, base_price_usd, status, stock, warehouse_id, pricing_mode, token_id, price_token } = data;

        await query('BEGIN');
        try {
            const upFields = [];
            const upValues = [];
            let idx = 1;

            if (name !== undefined) { upFields.push(`name = $${idx++}`); upValues.push(name); }
            if (description !== undefined) { upFields.push(`description = $${idx++}`); upValues.push(description); }
            if (category !== undefined) { upFields.push(`category = $${idx++}`); upValues.push(category); }
            if (base_price_usd !== undefined) { upFields.push(`base_price_usd = $${idx++}`); upValues.push(base_price_usd); }
            if (status !== undefined) { upFields.push(`status = $${idx++}`); upValues.push(status); }
            // token update logic removed because product_accepted_tokens table no longer exists

            if (upFields.length > 0) {
                upValues.push(productId);
                await query(
                    `UPDATE products SET ${upFields.join(', ')}, updated_at = NOW()
                     WHERE product_id = $${idx}`,
                    upValues
                );
            }

            if (stock !== undefined && warehouse_id !== undefined) {
                // Upsert inventory
                await query(
                    `INSERT INTO inventory (product_id, warehouse_id, total_stock, available)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (product_id, warehouse_id) 
                     DO UPDATE SET total_stock = $3, available = $3 - inventory.reserved, updated_at = NOW()`,
                    [productId, warehouse_id, stock, stock]
                );
            }

            await query(
                `INSERT INTO audit_logs (entity_type, entity_id, action, new_value, changed_by)
                 VALUES ('product', $1, 'detail_updated', $2, $3)`,
                [productId, JSON.stringify(data), adminId]
            );

            await query('COMMIT');
            logger.info('Admin updated product details', { productId, adminId });
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    }

    // ─── 2. Categories Management ─────────────────────────────────────

    async getAllCategories() {
        const result = await query(`SELECT * FROM categories ORDER BY display_order ASC, created_at DESC`);
        return result.rows;
    }

    async createCategory(data: { name: string, slug: string, description?: string, image_url?: string, is_active?: boolean, display_order?: number }) {
        const result = await query(
            `INSERT INTO categories (name, slug, description, image_url, is_active, display_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [data.name, data.slug, data.description, data.image_url, data.is_active ?? true, data.display_order ?? 0]
        );
        return result.rows[0];
    }

    async updateCategory(categoryId: number, data: any) {
        const dbCat = await query('SELECT * FROM categories WHERE category_id = $1', [categoryId]);
        if (!dbCat.rows.length) throw new AppError('Category not found', 404);

        const upFields = [];
        const upValues = [];
        let idx = 1;

        if (data.name !== undefined) { upFields.push(`name = $${idx++}`); upValues.push(data.name); }
        if (data.slug !== undefined) { upFields.push(`slug = $${idx++}`); upValues.push(data.slug); }
        if (data.description !== undefined) { upFields.push(`description = $${idx++}`); upValues.push(data.description); }
        if (data.image_url !== undefined) { upFields.push(`image_url = $${idx++}`); upValues.push(data.image_url); }
        if (data.is_active !== undefined) { upFields.push(`is_active = $${idx++}`); upValues.push(data.is_active); }
        if (data.display_order !== undefined) { upFields.push(`display_order = $${idx++}`); upValues.push(data.display_order); }

        if (upFields.length === 0) return dbCat.rows[0];

        upValues.push(categoryId);
        const result = await query(
            `UPDATE categories SET ${upFields.join(', ')}, updated_at = NOW() WHERE category_id = $${idx} RETURNING *`,
            upValues
        );
        return result.rows[0];
    }

    async deleteCategory(categoryId: number) {
        await query('DELETE FROM categories WHERE category_id = $1', [categoryId]);
        return { success: true };
    }

    // ─── 3. Withdrawals / Payouts ─────────────────────────────────────

    async getAllPayouts(params: { page?: number; limit?: number; status?: string; seller_id?: number }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const queryParams: any[] = [];
        let paramIdx = 1;

        if (params.status) {
            whereClause += ` AND p.status = $${paramIdx++}`;
            queryParams.push(params.status);
        }

        if (params.seller_id) {
            whereClause += ` AND p.seller_id = $${paramIdx++}`;
            queryParams.push(params.seller_id);
        }

        const countResult = await query(`SELECT COUNT(*) as total FROM seller_payouts p ${whereClause}`, queryParams);
        const result = await query(
            `SELECT p.*, sp.display_name, sp.payout_wallet as seller_wallet, u.username as processed_by_name
             FROM seller_payouts p
             JOIN seller_profiles sp ON p.seller_id = sp.seller_id
             LEFT JOIN users u ON p.processed_by = u.user_id
             ${whereClause}
             ORDER BY p.created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...queryParams, limit, offset]
        );

        return {
            payouts: result.rows,
            total: parseInt(countResult.rows[0].total),
            page, limit,
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
        };
    }

    async updatePayoutStatus(payoutId: number, status: string, adminId: number, txHash?: string, notes?: string) {
        const updateFields: string[] = ['status = $1', 'processed_by = $2', 'updated_at = NOW()'];
        const params: any[] = [status, adminId];
        let idx = 3;

        if (['completed', 'rejected'].includes(status)) {
            updateFields.push(`processed_at = NOW()`);
        }

        if (txHash) {
            updateFields.push(`tx_hash = $${idx++}`);
            params.push(txHash);
        }

        if (notes) {
            updateFields.push(`notes = $${idx++}`);
            params.push(notes);
        }

        params.push(payoutId);

        const result = await query(
            `UPDATE seller_payouts SET ${updateFields.join(', ')} WHERE payout_id = $${idx} RETURNING *`,
            params
        );

        if (!result.rows.length) {
            throw new AppError('Payout not found', 404);
        }

        return result.rows[0];
    }

    // ─── 4. Platform Settings (Fees, Banners, Announcements) ──────────

    async getPlatformSetting(key: string) {
        const result = await query('SELECT value FROM platform_settings WHERE key = $1', [key]);
        return result.rows.length ? result.rows[0].value : null;
    }

    async getAllSettings() {
        const result = await query('SELECT * FROM platform_settings');
        return result.rows;
    }

    async updatePlatformSetting(key: string, value: any, adminId: number) {
        await query(
            `INSERT INTO platform_settings (key, value, updated_by) 
             VALUES ($1, $2, $3)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
            [key, JSON.stringify(value), adminId]
        );
        return { success: true };
    }

    // ─── 5. Dispute Evidence & Chat ───────────────────────────────────

    async getDisputeMessages(disputeId: number) {
        const result = await query(
            `SELECT dm.*, u.username as sender_name, u.role as sender_role, u.avatar_url
             FROM dispute_messages dm
             JOIN users u ON dm.sender_id = u.user_id
             WHERE dm.dispute_id = $1
             ORDER BY dm.created_at ASC`,
            [disputeId]
        );
        return result.rows;
    }

    async addDisputeMessage(disputeId: number, senderId: number, message: string, attachments?: string[], isAdminNote: boolean = false) {
        // Verify dispute exists
        const dCheck = await query('SELECT 1 FROM disputes WHERE dispute_id = $1', [disputeId]);
        if (!dCheck.rows.length) throw new AppError('Dispute not found', 404);

        const att = attachments ? JSON.stringify(attachments) : null;
        const result = await query(
            `INSERT INTO dispute_messages (dispute_id, sender_id, message, attachments, is_admin_note)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [disputeId, senderId, message, att, isAdminNote]
        );
        return result.rows[0];
    }
}

