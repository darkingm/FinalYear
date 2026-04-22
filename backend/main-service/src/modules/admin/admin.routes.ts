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
    getEscrowContractSnapshots,
    getEscrowOpsHealth,
    getPaymentReconciliationCases,
    retryVerifyPayment,
    expireStalePaymentTx,
    repairOrderPaymentProjection,
    createProduct,
    updateProductDetail,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getPayouts,
    updatePayoutStatus,
    getSettings,
    updateSetting,
    getDisputeMessages,
    addDisputeMessage,
    resolveOrderDisputeOnChain
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
router.get('/disputes/:id/messages', getDisputeMessages);
router.post('/disputes/:id/messages', addDisputeMessage);

// On-chain dispute resolution for product orders (triggers smart contract refund/release)
router.post('/orders/:id/resolve-dispute', resolveOrderDisputeOnChain);

// Refunds
router.post('/refunds', initiateRefund);
router.get('/refunds', getRefunds);
router.patch('/refunds/:id/status', updateRefundStatus);

// Products
router.get('/products', getProducts);
router.post('/products', createProduct);
router.patch('/products/:id/status', updateProductStatus);
router.put('/products/:id', updateProductDetail);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Payouts
router.get('/payouts', getPayouts);
router.patch('/payouts/:id/status', updatePayoutStatus);

// Platform Settings
router.get('/settings', getSettings);
router.patch('/settings/:key', updateSetting);
router.get('/tokens', getTokens);
router.patch('/tokens/:id', updateToken);

// Audit Logs
router.get('/audit-logs', getAuditLogs);

// Smart Contract / Escrow
router.get('/escrow/orders', getEscrowOrders);
router.get('/escrow/contracts', getEscrowContractSnapshots);
router.get('/escrow/health', getEscrowOpsHealth);
router.get('/payments/reconciliation', getPaymentReconciliationCases);
router.post('/payments/reconciliation/:id/retry-verify', retryVerifyPayment);
router.post('/payments/reconciliation/expire-stale', expireStalePaymentTx);
router.post('/payments/reconciliation/:id/reconcile-order', repairOrderPaymentProjection);

export default router;
