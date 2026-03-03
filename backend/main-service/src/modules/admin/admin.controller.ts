import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AdminService } from './admin.service';
import { logger } from '../../utils/logger';

const adminService = new AdminService();

// ─── Dashboard ───────────────────────────────────────────────────

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const stats = await adminService.getDashboardStats();
        res.json({ success: true, ...stats });
    } catch (error: any) {
        logger.error('Admin dashboard error:', error);
        next(error);
    }
}

// ─── Orders ──────────────────────────────────────────────────────

export async function getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, status, search, payment_method } = req.query;
        const result = await adminService.getAllOrders({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
            search: search as string,
            payment_method: payment_method as string,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get orders error:', error);
        next(error);
    }
}

export async function getOrderDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const orderId = parseInt(req.params.id);
        const order = await adminService.getOrderDetail(orderId);
        res.json({ success: true, order });
    } catch (error: any) {
        logger.error('Admin get order detail error:', error);
        next(error);
    }
}

export async function updateOrderStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const orderId = parseInt(req.params.id);
        const { status, notes } = req.body;
        const adminId = req.user!.user_id;
        const order = await adminService.updateOrderStatus(orderId, status, adminId, notes);
        res.json({ success: true, order });
    } catch (error: any) {
        logger.error('Admin update order status error:', error);
        next(error);
    }
}

// ─── Users ───────────────────────────────────────────────────────

export async function getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, role, status, search } = req.query;
        const result = await adminService.getAllUsers({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            role: role as string,
            status: status as string,
            search: search as string,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get users error:', error);
        next(error);
    }
}

export async function updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = parseInt(req.params.id);
        const { status } = req.body;
        const adminId = req.user!.user_id;
        await adminService.updateUserStatus(userId, status, adminId);
        res.json({ success: true, message: 'User status updated' });
    } catch (error: any) {
        logger.error('Admin update user status error:', error);
        next(error);
    }
}

export async function updateUserRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = parseInt(req.params.id);
        const { role } = req.body;
        const adminId = req.user!.user_id;
        await adminService.updateUserRole(userId, role, adminId);
        res.json({ success: true, message: 'User role updated' });
    } catch (error: any) {
        logger.error('Admin update user role error:', error);
        next(error);
    }
}

// ─── Disputes ────────────────────────────────────────────────────

export async function getDisputes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, status } = req.query;
        const result = await adminService.getAllDisputes({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get disputes error:', error);
        next(error);
    }
}

export async function resolveDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const disputeId = parseInt(req.params.id);
        const { resolution, status } = req.body;
        const adminId = req.user!.user_id;
        await adminService.resolveDispute(disputeId, resolution, status, adminId);
        res.json({ success: true, message: 'Dispute resolved' });
    } catch (error: any) {
        logger.error('Admin resolve dispute error:', error);
        next(error);
    }
}

// ─── Refunds ─────────────────────────────────────────────────────

export async function initiateRefund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { order_id, reason } = req.body;
        const adminId = req.user!.user_id;
        const refund = await adminService.initiateRefund(order_id, reason, adminId);
        res.json({ success: true, refund });
    } catch (error: any) {
        logger.error('Admin initiate refund error:', error);
        next(error);
    }
}

export async function getRefunds(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, status } = req.query;
        const result = await adminService.getAllRefunds({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get refunds error:', error);
        next(error);
    }
}

export async function updateRefundStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const refundId = parseInt(req.params.id);
        const { status, tx_hash } = req.body;
        await adminService.updateRefundStatus(refundId, status, tx_hash);
        res.json({ success: true, message: 'Refund status updated' });
    } catch (error: any) {
        logger.error('Admin update refund status error:', error);
        next(error);
    }
}

// ─── Products ────────────────────────────────────────────────────

export async function getProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, status, search } = req.query;
        const result = await adminService.getAllProducts({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
            search: search as string,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get products error:', error);
        next(error);
    }
}

export async function updateProductStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const productId = parseInt(req.params.id);
        const { status } = req.body;
        const adminId = req.user!.user_id;
        await adminService.updateProductStatus(productId, status, adminId);
        res.json({ success: true, message: 'Product status updated' });
    } catch (error: any) {
        logger.error('Admin update product status error:', error);
        next(error);
    }
}

// ─── Platform Settings ──────────────────────────────────────────

export async function getTokens(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const tokens = await adminService.getTokenWhitelist();
        res.json({ success: true, tokens });
    } catch (error: any) {
        logger.error('Admin get tokens error:', error);
        next(error);
    }
}

export async function updateToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const tokenId = parseInt(req.params.id);
        const { is_active } = req.body;
        await adminService.updateTokenStatus(tokenId, is_active);
        res.json({ success: true, message: 'Token updated' });
    } catch (error: any) {
        logger.error('Admin update token error:', error);
        next(error);
    }
}

export async function getAuditLogs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, entity_type } = req.query;
        const result = await adminService.getAuditLogs({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            entity_type: entity_type as string,
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get audit logs error:', error);
        next(error);
    }
}

// ─── Escrow / Smart Contract ────────────────────────────────────

export async function getEscrowOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const orders = await adminService.getEscrowOrders();
        res.json({ success: true, orders });
    } catch (error: any) {
        logger.error('Admin get escrow orders error:', error);
        next(error);
    }
}
