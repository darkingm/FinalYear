'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, Copy, Check, ExternalLink, ChevronLeft, ChevronRight, Clock, DollarSign } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';
import { TokenAmountInline, UsdtAmountInline } from '@/components/checkout/CheckoutPriceValue';
import { getOrderPricingDisplay } from '@/lib/orders/presentation';

const statusColors: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    approved: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    processing: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    completed: 'text-green-400 bg-green-400/10 border-green-400/20',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function AdminRefundsPage() {
    const [refunds, setRefunds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [updateModal, setUpdateModal] = useState<{ refundId: number } | null>(null);
    const [newStatus, setNewStatus] = useState('');
    const [txHash, setTxHash] = useState('');
    const [copied, setCopied] = useState('');

    const fetchRefunds = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.refunds.list({ status: statusFilter || undefined });
            setRefunds(res.data.refunds);
        } catch {
            toast.error('Failed to load refunds');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

    const handleUpdate = async () => {
        if (!updateModal) return;
        try {
            await adminApi.refunds.updateStatus(updateModal.refundId, newStatus, txHash || undefined);
            toast.success('Refund status updated');
            setUpdateModal(null);
            setTxHash('');
            fetchRefunds();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update refund');
        }
    };

    const copyText = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(''), 2000);
    };

    const getPricingDisplay = (refund: any) => getOrderPricingDisplay({
        token_symbol: refund.token_symbol,
        subtotal_token: refund.amount_token,
        amount_token: refund.amount_token,
        total_amount: refund.order_total,
        price_usd: refund.order_total,
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r text-gray-900 flex items-center gap-3">
                    <RefreshCcw className="w-8 h-8 text-purple-400" />
                    Refunds Management
                </h1>
                <p className="text-gray-500 mt-1">Track and manage refund transactions</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['', 'pending', 'approved', 'processing', 'completed', 'rejected'].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${statusFilter === s
                                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'
                            }`}
                    >
                        {s || 'All'}
                    </button>
                ))}
            </div>

            {/* Refunds List */}
            <div className="space-y-4">
                {loading ? (
                    [...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-white animate-pulse" />)
                ) : refunds.length === 0 ? (
                    <div className="text-center py-16 rounded-2xl bg-white border border-gray-100">
                        <RefreshCcw className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-400">No refunds found</h3>
                    </div>
                ) : (
                    refunds.map((refund, idx) => (
                        <motion.div
                            key={refund.refund_id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="rounded-2xl bg-white border border-gray-100 p-6 hover:border-gray-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900">Refund #{refund.refund_id}</h3>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[refund.status]}`}>{refund.status.toUpperCase()}</span>
                                        <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-gray-400">Order: {refund.order_number}</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Amount</div>
                                            <div className="text-sm text-gray-900 font-bold flex items-center gap-1">
                                                {refund.payment_method === 'crypto' && refund.token_symbol ? (
                                                    <TokenAmountInline amount={refund.amount} symbol={refund.token_symbol} size="sm" amountClassName="text-gray-900" />
                                                ) : (
                                                    <>
                                                        <DollarSign className="w-3.5 h-3.5 text-green-400" />
                                                        {parseFloat(refund.amount).toFixed(2)}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Order Total</div>
                                            <div className="text-sm text-gray-900">
                                                {(() => {
                                                    const pricing = getPricingDisplay(refund);
                                                    return pricing.mode === 'token' ? (
                                                        <div className="space-y-1">
                                                            <TokenAmountInline amount={pricing.tokenAmount} symbol={pricing.tokenSymbol} size="sm" amountClassName="text-gray-900" />
                                                            <UsdtAmountInline amount={pricing.usdAmount} size="sm" amountClassName="text-gray-500" />
                                                        </div>
                                                    ) : (
                                                        <UsdtAmountInline amount={pricing.usdAmount} size="sm" amountClassName="text-gray-900" />
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Buyer</div>
                                            <div className="text-sm text-gray-900">{refund.buyer_name}</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-gray-50">
                                            <div className="text-xs text-gray-500 mb-1">Approved by</div>
                                            <div className="text-sm text-gray-900">{refund.approved_by_name || 'System'}</div>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl bg-gray-50 mb-3">
                                        <div className="text-xs text-gray-500 mb-1 font-medium">Reason</div>
                                        <p className="text-sm text-gray-300">{refund.reason}</p>
                                    </div>

                                    {(refund.tx_hash || refund.escrow_release_tx || refund.buyer_wallet) && (
                                        <div className="space-y-2">
                                            {refund.tx_hash && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500 min-w-[100px]">Original TX</span>
                                                    <code className="text-blue-400 font-mono flex-1 truncate">{refund.tx_hash}</code>
                                                    <button onClick={() => copyText(refund.tx_hash, `tx-${refund.refund_id}`)} className="p-1 hover:bg-gray-50 rounded">
                                                        {copied === `tx-${refund.refund_id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                                                    </button>
                                                </div>
                                            )}
                                            {refund.escrow_release_tx && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500 min-w-[100px]">Refund TX</span>
                                                    <code className="text-purple-400 font-mono flex-1 truncate">{refund.escrow_release_tx}</code>
                                                    <button onClick={() => copyText(refund.escrow_release_tx, `rtx-${refund.refund_id}`)} className="p-1 hover:bg-gray-50 rounded">
                                                        {copied === `rtx-${refund.refund_id}` ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                                                    </button>
                                                </div>
                                            )}
                                            {refund.buyer_wallet && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500 min-w-[100px]">Refund to</span>
                                                    <code className="text-emerald-400 font-mono flex-1 truncate">{refund.buyer_wallet}</code>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                        <span><Clock className="w-3 h-3 inline mr-1" />{new Date(refund.created_at).toLocaleString()}</span>
                                        {refund.processed_at && <span>Processed: {new Date(refund.processed_at).toLocaleString()}</span>}
                                    </div>
                                </div>

                                {refund.status !== 'completed' && refund.status !== 'rejected' && (
                                    <button
                                        onClick={() => { setUpdateModal({ refundId: refund.refund_id }); setNewStatus(refund.status === 'approved' ? 'processing' : 'completed'); setTxHash(''); }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-sm font-medium transition-all flex-shrink-0"
                                    >
                                        Update Status
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Update Modal */}
            <AnimatePresence>
                {updateModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setUpdateModal(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Update Refund Status</h3>
                            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 mb-3">
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="processing">Processing</option>
                                <option value="completed">Completed</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <input
                                type="text"
                                placeholder="Refund TX hash (optional, for on-chain refund)"
                                value={txHash}
                                onChange={(e) => setTxHash(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-200 placeholder-gray-500 mb-4 font-mono"
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setUpdateModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm">Cancel</button>
                                <button onClick={handleUpdate} className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-gray-900 text-sm font-medium transition-colors">Update</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
