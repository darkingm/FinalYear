import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
    getDashboard,
    getOrders,
    getOrderDetail,
    updateOrderStatus,
    getUsers,
    updateUserStatus,
    updateUserRole,
    getDisputes,
    resolveDispute,
    initiateRefund,
    getRefunds,
    updateRefundStatus,
    getProducts,
    updateProductStatus,
    getTokens,
    updateToken,
    getAuditLogs,
    getEscrowOrders,
} from './admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboard);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderDetail);
router.patch('/orders/:id/status', updateOrderStatus);

// Users
router.get('/users', getUsers);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);

// Disputes
router.get('/disputes', getDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);

// Refunds
router.post('/refunds', initiateRefund);
router.get('/refunds', getRefunds);
router.patch('/refunds/:id/status', updateRefundStatus);

// Products
router.get('/products', getProducts);
router.patch('/products/:id/status', updateProductStatus);

// Platform Settings
router.get('/tokens', getTokens);
router.patch('/tokens/:id', updateToken);

// Audit Logs
router.get('/audit-logs', getAuditLogs);

// Smart Contract / Escrow
router.get('/escrow/orders', getEscrowOrders);

export default router;
