'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Search, Eye, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';
import { getOrderPricingDisplay } from '@/lib/orders/presentation';

const statusColors: Record<string, string> = {
    open: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    investigating: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
    closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
};

export default function AdminDisputesPage() {
    const [disputes, setDisputes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [resolveModal, setResolveModal] = useState<{ disputeId: number; orderId: number; orderNumber: string } | null>(null);
    const [resolution, setResolution] = useState('');
    const [resolveStatus, setResolveStatus] = useState<'resolved' | 'closed'>('resolved');
    const [refundAfterResolve, setRefundAfterResolve] = useState(false);

    const fetchDisputes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.disputes.list({ page, limit: 20, status: statusFilter || undefined });
            setDisputes(res.data.disputes);
            setTotalPages(res.data.totalPages);
        } catch {
            toast.error('Failed to load disputes');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

    const handleResolve = async () => {
        if (!resolveModal || !resolution.trim()) return;
        try {
            await adminApi.disputes.resolve(resolveModal.disputeId, resolution, resolveStatus);
            if (refundAfterResolve) {
                await adminApi.refunds.initiate(resolveModal.orderId, `Dispute #${resolveModal.disputeId} resolved: ${resolution}`);
                toast.success('Dispute resolved and refund initiated');
            } else {
                toast.success('Dispute resolved');
            }
            setResolveModal(null);
            setResolution('');
            setRefundAfterResolve(false);
            fetchDisputes();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to resolve dispute');
        }
    };

    const getPricingDisplay = (dispute: any) => getOrderPricingDisplay({
        token_symbol: dispute.token_symbol,
        subtotal_token: dispute.amount_token,
        amount_token: dispute.amount_token,
        total_amount: dispute.total_amount,
        price_usd: dispute.total_amount,
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-orange-400" />
                    Disputes Management
                </h1>
                <p className="text-gray-500 mt-1">Review and resolve order disputes</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['', 'open', 'investigating', 'resolved', 'closed'].map(s => (
                    <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${statusFilter === s
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                            }`}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {/* Disputes List */}
            <div className="space-y-4">
                {loading ? (
                    [...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-white animate-pulse" />)
                ) : disputes.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl bg-white border border-gray-100">
                        <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-400">No disputes found</h3>
                        <p className="text-sm text-gray-600">{statusFilter ? `No ${statusFilter} disputes` : 'All clear!'}</p>
                    </div>
                ) : (
                    disputes.map((dispute, idx) => (
                        <motion.div
                            key={dispute.dispute_id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="rounded-2xl bg-white border border-gray-100 p-6 hover:border-gray-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900">Dispute #{dispute.dispute_id}</h3>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[dispute.status]}`}>{dispute.status.toUpperCase()}</span>
                                        <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400">Order: {dispute.order_number}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Raised by</div>
                                            <div className="text-sm text-gray-900">{dispute.raised_by_name}</div>
                                            <div className="text-xs text-gray-500">{dispute.raised_by_email}</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Buyer</div>
                                            <div className="text-sm text-gray-900">{dispute.buyer_name}</div>
                                            {dispute.buyer_wallet && <code className="text-[10px] text-gray-500 font-mono">{dispute.buyer_wallet.slice(0, 8)}...</code>}
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Seller</div>
                                            <div className="text-sm text-gray-900">{dispute.seller_name}</div>
                                            {dispute.seller_wallet && <code className="text-[10px] text-gray-500 font-mono">{dispute.seller_wallet.slice(0, 8)}...</code>}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-gray-50 mb-3">
                                        <div className="text-xs text-gray-500 mb-1 font-medium">Reason</div>
                                        <p className="text-sm text-gray-300">{dispute.reason}</p>
                                    </div>
                                    {dispute.resolution && (
                                        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                                            <div className="text-xs text-green-400 mb-1 font-medium">Resolution by {dispute.resolver_name || 'Admin'}</div>
                                            <p className="text-sm text-gray-300">{dispute.resolution}</p>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                        <span><Clock className="w-3 h-3 inline mr-1" />{new Date(dispute.created_at).toLocaleString()}</span>
                                        <span className="flex items-center gap-2">
                                            <span>Order total:</span>
                                            {(() => {
                                                const pricing = getPricingDisplay(dispute);
                                                return pricing.mode === 'token' ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <TokenAmountInline amount={pricing.tokenAmount} symbol={pricing.tokenSymbol} size="sm" amountClassName="text-gray-900" />
                                                        <UsdtAmountInline amount={pricing.usdAmount} size="sm" amountClassName="text-gray-900" />
                                                    </span>
                                                ) : (
                                                    <UsdtAmountInline amount={pricing.usdAmount} size="sm" amountClassName="text-gray-900" />
                                                );
                                            })()}
                                        </span>
                                        <span>Payment: <span className="text-gray-300">{dispute.payment_method}</span></span>
                                        {dispute.tx_hash && <code className="text-blue-400 font-mono">TX: {dispute.tx_hash.slice(0, 10)}...</code>}
                                    </div>
                                </div>
                                {dispute.status !== 'resolved' && dispute.status !== 'closed' && (
                                    <button
                                        onClick={() => setResolveModal({ disputeId: dispute.dispute_id, orderId: dispute.order_id, orderNumber: dispute.order_number })}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 text-sm font-medium transition-all flex-shrink-0"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Resolve
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg bg-white text-gray-400 hover:text-gray-900 disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
                    <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg bg-white text-gray-400 hover:text-gray-900 disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
                </div>
            )}

            {/* Resolve Modal */}
            <AnimatePresence>
                {resolveModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setResolveModal(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Resolve Dispute #{resolveModal.disputeId}</h3>
                            <p className="text-sm text-gray-400 mb-4">Order: {resolveModal.orderNumber}</p>
                            <textarea
                                placeholder="Resolution details *"
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-green-500/50 mb-3 h-28 resize-none"
                            />
                            <select
                                value={resolveStatus}
                                onChange={(e) => setResolveStatus(e.target.value as any)}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 mb-3"
                            >
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                            <label className="flex items-center gap-3 mb-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={refundAfterResolve}
                                    onChange={(e) => setRefundAfterResolve(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-gray-50 text-purple-500 focus:ring-purple-500/20"
                                />
                                <span className="text-sm text-gray-300">Also initiate refund to buyer</span>
                            </label>
                            <div className="flex gap-3">
                                <button onClick={() => { setResolveModal(null); setResolution(''); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm">Cancel</button>
                                <button onClick={handleResolve} disabled={!resolution.trim()} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-gray-900 text-sm font-medium transition-colors">
                                    Resolve
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
