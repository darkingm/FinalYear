import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { AdminService } from './admin.service';
import { P2PService } from '../p2p/p2p.service';
import { logger } from '../../utils/logger';
import { PaymentReconciliationAdminService } from './payment-reconciliation.service';
import { ContractOpsService } from './contract-ops.service';

const adminService = new AdminService();
const p2pService = new P2PService();
const paymentReconciliationAdminService = new PaymentReconciliationAdminService();
const contractOpsService = new ContractOpsService();

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

export async function getEscrowContractSnapshots(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const chains = await contractOpsService.listSnapshots();
        res.json({ success: true, chains });
    } catch (error: any) {
        logger.error('Admin get escrow contract snapshots error:', error);
        next(error);
    }
}

export async function getEscrowOpsHealth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const health = await paymentReconciliationAdminService.getOpsHealth();
        res.json({ success: true, health });
    } catch (error: any) {
        logger.error('Admin get escrow ops health error:', error);
        next(error);
    }
}

export async function getPaymentReconciliationCases(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { limit, problems_only, order_id } = req.query;
        const cases = await paymentReconciliationAdminService.listCases({
            limit: limit ? parseInt(limit as string, 10) : undefined,
            problemsOnly: problems_only === 'false' ? false : true,
            orderId: order_id ? parseInt(order_id as string, 10) : undefined,
        });

        res.json({ success: true, cases });
    } catch (error: any) {
        logger.error('Admin get payment reconciliation cases error:', error);
        next(error);
    }
}

export async function retryVerifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const orderId = parseInt(req.params.id, 10);
        const result = await paymentReconciliationAdminService.retryVerify(orderId);
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin retry verify payment error:', error);
        next(error);
    }
}

export async function repairOrderPaymentProjection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const orderId = parseInt(req.params.id, 10);
        const result = await paymentReconciliationAdminService.repairOrderState(orderId);
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin repair order payment projection error:', error);
        next(error);
    }
}

/**
 * POST /api/admin/orders/:id/resolve-dispute
 * Resolves a product-order dispute with optional on-chain refund/release.
 * Body: { winner: 'BUYER' | 'SELLER', notes: string }
 * - BUYER wins → calls payment-service /refund (on-chain ETH back to buyer wallet)
 * - SELLER wins → calls payment-service /release (on-chain ETH to seller wallet)
 */
export async function resolveOrderDisputeOnChain(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const orderId = parseInt(req.params.id);
        const adminId = req.user!.user_id;
        const { winner, notes } = req.body;

        if (!winner || !['BUYER', 'SELLER'].includes(winner.toUpperCase())) {
            return res.status(400).json({ success: false, message: "winner must be 'BUYER' or 'SELLER'" });
        }

        const result = await p2pService.adminResolveOrderDispute(
            orderId, adminId, winner.toUpperCase() as 'BUYER' | 'SELLER', notes || ''
        );

        const { success: _s, ...rest } = result;
        res.json({ success: true, ...rest });
    } catch (error: any) {
        logger.error('Admin resolve order dispute on-chain error:', error);
        next(error);
    }
}

// ─── Extended Product Management ────────────────────────────────

export async function createProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const adminId = req.user!.user_id;
        const product = await adminService.createProduct(req.body, adminId);
        res.json({ success: true, product });
    } catch (error: any) {
        logger.error('Admin create product error:', error);
        next(error);
    }
}

export async function updateProductDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const productId = parseInt(req.params.id);
        const adminId = req.user!.user_id;
        await adminService.updateProductDetail(productId, req.body, adminId);
        res.json({ success: true, message: 'Product details updated' });
    } catch (error: any) {
        logger.error('Admin update product details error:', error);
        next(error);
    }
}

// ─── Categories Management ──────────────────────────────────────

export async function getCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const categories = await adminService.getAllCategories();
        res.json({ success: true, categories });
    } catch (error: any) {
        logger.error('Admin get categories error:', error);
        next(error);
    }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const category = await adminService.createCategory(req.body);
        res.json({ success: true, category });
    } catch (error: any) {
        logger.error('Admin create category error:', error);
        next(error);
    }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const categoryId = parseInt(req.params.id);
        const category = await adminService.updateCategory(categoryId, req.body);
        res.json({ success: true, category });
    } catch (error: any) {
        logger.error('Admin update category error:', error);
        next(error);
    }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const categoryId = parseInt(req.params.id);
        await adminService.deleteCategory(categoryId);
        res.json({ success: true, message: 'Category deleted' });
    } catch (error: any) {
        logger.error('Admin delete category error:', error);
        next(error);
    }
}

// ─── Payouts Management ─────────────────────────────────────────

export async function getPayouts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { page, limit, status, seller_id } = req.query;
        const result = await adminService.getAllPayouts({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
            seller_id: seller_id ? parseInt(seller_id as string) : undefined
        });
        res.json({ success: true, ...result });
    } catch (error: any) {
        logger.error('Admin get payouts error:', error);
        next(error);
    }
}

export async function updatePayoutStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const payoutId = parseInt(req.params.id);
        const { status, tx_hash, notes } = req.body;
        const adminId = req.user!.user_id;
        const payout = await adminService.updatePayoutStatus(payoutId, status, adminId, tx_hash, notes);
        res.json({ success: true, payout });
    } catch (error: any) {
        logger.error('Admin update payout status error:', error);
        next(error);
    }
}

// ─── Platform Settings ──────────────────────────────────────────

export async function getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const settings = await adminService.getAllSettings();
        res.json({ success: true, settings });
    } catch (error: any) {
        logger.error('Admin get settings error:', error);
        next(error);
    }
}

export async function updateSetting(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { key } = req.params;
        const adminId = req.user!.user_id;
        await adminService.updatePlatformSetting(key, req.body.value, adminId);
        res.json({ success: true, message: 'Setting updated' });
    } catch (error: any) {
        logger.error('Admin update setting error:', error);
        next(error);
    }
}

// ─── Dispute Evidence & Chat ────────────────────────────────────

export async function getDisputeMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const disputeId = parseInt(req.params.id);
        const messages = await adminService.getDisputeMessages(disputeId);
        res.json({ success: true, messages });
    } catch (error: any) {
        logger.error('Admin get dispute messages error:', error);
        next(error);
    }
}

export async function addDisputeMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const disputeId = parseInt(req.params.id);
        const adminId = req.user!.user_id;
        const { message, attachments, is_admin_note } = req.body;
        const savedMessage = await adminService.addDisputeMessage(disputeId, adminId, message, attachments, is_admin_note);
        res.json({ success: true, message: savedMessage });
    } catch (error: any) {
        logger.error('Admin add dispute message error:', error);
        next(error);
    }
}
