'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingCart, Search, Filter, Eye, X, RefreshCcw, ChevronLeft,
    ChevronRight, Edit3, ExternalLink, Copy, Check
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
    UNPAID: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    TX_SUBMITTED: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    TX_FAILED: 'text-red-400 bg-red-400/10 border-red-400/20',
    ONCHAIN_CONFIRMED: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    PAID: 'text-green-400 bg-green-400/10 border-green-400/20',
    DELIVERING: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    COMPLETED: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    DISPUTED: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    cancelled: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
    refunded: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

const allStatuses = ['', 'UNPAID', 'TX_SUBMITTED', 'TX_FAILED', 'ONCHAIN_CONFIRMED', 'PAID', 'DELIVERING', 'COMPLETED', 'DISPUTED', 'cancelled', 'refunded'];

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [statusEdit, setStatusEdit] = useState<{ orderId: number; status: string; notes: string } | null>(null);
    const [refundModal, setRefundModal] = useState<{ orderId: number; reason: string } | null>(null);
    const [copied, setCopied] = useState('');

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.orders.list({
                page,
                limit: 20,
                status: statusFilter || undefined,
                search: search || undefined,
                payment_method: paymentFilter || undefined,
            });
            setOrders(res.data.orders);
            setTotalPages(res.data.totalPages);
        } catch {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, search, paymentFilter]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const viewDetail = async (orderId: number) => {
        setDetailLoading(true);
        try {
            const res = await adminApi.orders.getById(orderId);
            setSelectedOrder(res.data.order);
        } catch {
            toast.error('Failed to load order details');
        } finally {
            setDetailLoading(false);
        }
    };

    const handleStatusUpdate = async () => {
        if (!statusEdit) return;
        try {
            await adminApi.orders.updateStatus(statusEdit.orderId, statusEdit.status, statusEdit.notes);
            toast.success('Order status updated');
            setStatusEdit(null);
            fetchOrders();
            if (selectedOrder?.order_id === statusEdit.orderId) {
                viewDetail(statusEdit.orderId);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const handleRefund = async () => {
        if (!refundModal) return;
        try {
            await adminApi.refunds.initiate(refundModal.orderId, refundModal.reason);
            toast.success('Refund initiated successfully');
            setRefundModal(null);
            fetchOrders();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to initiate refund');
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(''), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                        <ShoppingCart className="w-8 h-8 text-blue-400" />
                        Orders Management
                    </h1>
                    <p className="text-gray-500 mt-1">Manage all marketplace orders</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search orders, buyer..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50"
                >
                    <option value="">All Status</option>
                    {allStatuses.filter(s => s).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                    value={paymentFilter}
                    onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50"
                >
                    <option value="">All Payments</option>
                    <option value="crypto">Crypto</option>
                    <option value="paypal">PayPal</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-medium">Order</th>
                                <th className="text-left px-5 py-3 font-medium">Buyer</th>
                                <th className="text-left px-5 py-3 font-medium">Product</th>
                                <th className="text-left px-5 py-3 font-medium">Amount</th>
                                <th className="text-left px-5 py-3 font-medium">Status</th>
                                <th className="text-left px-5 py-3 font-medium">Payment</th>
                                <th className="text-left px-5 py-3 font-medium">Date</th>
                                <th className="text-left px-5 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        {[...Array(8)].map((_, j) => (
                                            <td key={j} className="px-5 py-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-gray-500">No orders found</td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order.order_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <span className="text-sm font-medium text-blue-400">{order.order_number}</span>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-gray-300">{order.buyer_name || order.buyer_email || '-'}</td>
                                        <td className="px-5 py-4 text-sm text-gray-400 max-w-[150px] truncate">{order.product_name || '-'}</td>
                                        <td className="px-5 py-4 text-sm font-medium text-gray-900">${parseFloat(order.total_amount).toFixed(2)}</td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-md border ${statusColors[order.status] || 'text-gray-400 bg-gray-400/10 border-gray-400/20'}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs px-2 py-1 rounded-md ${order.payment_method === 'crypto' ? 'bg-violet-500/10 text-violet-400' : 'bg-sky-500/10 text-sky-400'}`}>
                                                {order.payment_method || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => viewDetail(order.order_id)} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-blue-400 transition-colors" title="View Details">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setStatusEdit({ orderId: order.order_id, status: order.status, notes: '' })} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-yellow-400 transition-colors" title="Update Status">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setRefundModal({ orderId: order.order_id, reason: '' })} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-purple-400 transition-colors" title="Refund">
                                                    <RefreshCcw className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-all">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-all">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Detail Modal */}
            <AnimatePresence>
                {selectedOrder && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedOrder(null)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white/95 backdrop-blur-md z-10">
                                <h2 className="text-xl font-bold text-gray-900">Order {selectedOrder.order_number}</h2>
                                <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-900"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Order Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Status', value: selectedOrder.status, tag: true },
                                        { label: 'Payment', value: selectedOrder.payment_method },
                                        { label: 'Amount', value: `$${parseFloat(selectedOrder.total_amount).toFixed(2)}` },
                                        { label: 'Token Amount', value: selectedOrder.amount_token ? `${parseFloat(selectedOrder.amount_token).toFixed(6)} tokens` : 'N/A' },
                                        { label: 'Buyer', value: selectedOrder.buyer_name || selectedOrder.buyer_email },
                                        { label: 'Seller', value: selectedOrder.seller_name || selectedOrder.seller_username },
                                        { label: 'Product', value: selectedOrder.product_name },
                                        { label: 'Chain ID', value: selectedOrder.chain_id || 'N/A' },
                                    ].map(item => (
                                        <div key={item.label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                                            {item.tag ? (
                                                <span className={`text-xs font-medium px-2 py-1 rounded-md ${statusColors[item.value] || 'text-gray-400 bg-gray-400/10'}`}>{item.value}</span>
                                            ) : (
                                                <div className="text-sm text-gray-900 font-medium">{item.value || '-'}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Wallet / TX Info */}
                                {(selectedOrder.tx_hash || selectedOrder.buyer_wallet || selectedOrder.seller_wallet) && (
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-gray-300">Blockchain Details</h4>
                                        {selectedOrder.tx_hash && (
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                <span className="text-xs text-gray-500 min-w-[80px]">TX Hash</span>
                                                <code className="text-xs text-blue-400 font-mono flex-1 truncate">{selectedOrder.tx_hash}</code>
                                                <button onClick={() => copyToClipboard(selectedOrder.tx_hash, 'tx')} className="p-1 hover:bg-gray-50 rounded">
                                                    {copied === 'tx' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                                                </button>
                                            </div>
                                        )}
                                        {selectedOrder.buyer_wallet && (
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                <span className="text-xs text-gray-500 min-w-[80px]">Buyer Wallet</span>
                                                <code className="text-xs text-emerald-400 font-mono flex-1 truncate">{selectedOrder.buyer_wallet}</code>
                                                <button onClick={() => copyToClipboard(selectedOrder.buyer_wallet, 'bw')} className="p-1 hover:bg-gray-50 rounded">
                                                    {copied === 'bw' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                                                </button>
                                            </div>
                                        )}
                                        {selectedOrder.seller_wallet && (
                                            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                <span className="text-xs text-gray-500 min-w-[80px]">Seller Wallet</span>
                                                <code className="text-xs text-amber-400 font-mono flex-1 truncate">{selectedOrder.seller_wallet}</code>
                                                <button onClick={() => copyToClipboard(selectedOrder.seller_wallet, 'sw')} className="p-1 hover:bg-gray-50 rounded">
                                                    {copied === 'sw' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Status History */}
                                {selectedOrder.statusHistory?.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Status History</h4>
                                        <div className="space-y-2">
                                            {selectedOrder.statusHistory.map((h: any, i: number) => (
                                                <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-white/[0.02]">
                                                    <span className="text-gray-500 min-w-[130px]">{new Date(h.changed_at).toLocaleString()}</span>
                                                    <span className="text-red-400">{h.old_status}</span>
                                                    <span className="text-gray-600">→</span>
                                                    <span className="text-green-400">{h.new_status}</span>
                                                    {h.changed_by_name && <span className="text-gray-500 ml-auto">by {h.changed_by_name}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => { setSelectedOrder(null); setStatusEdit({ orderId: selectedOrder.order_id, status: selectedOrder.status, notes: '' }); }}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 text-sm font-medium transition-all"
                                    >
                                        Update Status
                                    </button>
                                    <button
                                        onClick={() => { setSelectedOrder(null); setRefundModal({ orderId: selectedOrder.order_id, reason: '' }); }}
                                        className="flex-1 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-sm font-medium transition-all"
                                    >
                                        Initiate Refund
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status Update Modal */}
            <AnimatePresence>
                {statusEdit && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setStatusEdit(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Update Order Status</h3>
                            <select
                                value={statusEdit.status}
                                onChange={(e) => setStatusEdit({ ...statusEdit, status: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 mb-3"
                            >
                                {allStatuses.filter(s => s).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <textarea
                                placeholder="Notes (optional)"
                                value={statusEdit.notes}
                                onChange={(e) => setStatusEdit({ ...statusEdit, notes: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 mb-4 h-20 resize-none placeholder-gray-500"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setStatusEdit(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-900 text-sm transition-colors">Cancel</button>
                                <button onClick={handleStatusUpdate} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-gray-900 text-sm font-medium transition-colors">Update</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Refund Modal */}
            <AnimatePresence>
                {refundModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setRefundModal(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Initiate Refund</h3>
                            <p className="text-sm text-gray-400 mb-4">This will refund the buyer and update the order status.</p>
                            <textarea
                                placeholder="Reason for refund *"
                                value={refundModal.reason}
                                onChange={(e) => setRefundModal({ ...refundModal, reason: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 focus:outline-none focus:border-purple-500/50 mb-4 h-24 resize-none placeholder-gray-500"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setRefundModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-900 text-sm transition-colors">Cancel</button>
                                <button onClick={handleRefund} disabled={!refundModal.reason.trim()} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 text-sm font-medium transition-colors">
                                    Initiate Refund
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
