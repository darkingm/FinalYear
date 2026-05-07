'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight,
    Coins, Filter, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface P2POrderRow {
    p2p_order_id: number;
    order_ref: string;
    status: string;
    fiat_amount: string;
    token_amount: string;
    price_per_unit: string;
    fiat_currency: string;
    symbol: string;
    payment_method: string;
    role: 'buyer' | 'seller';
    created_at: string;
    expires_at: string;
    counterparty_username: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    PENDING:         { label: 'Chờ thanh toán',  color: 'text-amber-300',  bg: 'bg-amber-500/10 border-amber-500/30' },
    PAID:            { label: 'Đã chuyển',        color: 'text-blue-300',   bg: 'bg-blue-500/10 border-blue-500/30' },
    CONFIRMED:       { label: 'Đang giải ngân',   color: 'text-emerald-300',bg: 'bg-emerald-500/10 border-emerald-500/30' },
    RELEASED:        { label: 'Hoàn tất',          color: 'text-emerald-300',bg: 'bg-emerald-500/10 border-emerald-500/30' },
    CANCELLED:       { label: 'Đã huỷ',            color: 'text-red-300',    bg: 'bg-red-500/10 border-red-500/30' },
    DISPUTED:        { label: 'Đang khiếu nại',    color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/30' },
    RESOLVED_BUYER:  { label: 'Xử lý nghiêng buyer', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    RESOLVED_SELLER: { label: 'Xử lý nghiêng seller', color: 'text-violet-300',  bg: 'bg-violet-500/10 border-violet-500/30' },
    TIMEOUT:         { label: 'Hết hạn',           color: 'text-red-300',    bg: 'bg-red-500/10 border-red-500/30' },
};

const STATUS_TABS = [
    { value: '',          label: 'Tất cả' },
    { value: 'PENDING',   label: 'Chờ TT' },
    { value: 'PAID',      label: 'Đã chuyển' },
    { value: 'RELEASED',  label: 'Hoàn tất' },
    { value: 'DISPUTED',  label: 'Khiếu nại' },
];

export default function P2POrdersIndexPage() {
    const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
    const [status, setStatus] = useState('');
    const [orders, setOrders] = useState<P2POrderRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ role });
            if (status) params.set('status', status);
            const res = await apiClient.get(`/api/p2p/orders?${params}`);
            if (res.data?.success) setOrders(res.data.data || []);
        } catch {
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [role, status]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const formatTime = (iso: string) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            <div className="border-b border-white/5 bg-black/40 sticky top-0 z-30 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/p2p" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-violet-400" />
                        <span className="font-bold text-lg">P2P Orders của tôi</span>
                    </div>
                    <button
                        onClick={fetchOrders}
                        className="ml-auto p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
                        {(['buyer', 'seller'] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setRole(r)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all
                                    ${role === r ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-white/50 hover:text-white'}`}
                            >
                                {r === 'buyer' ? 'Tôi mua' : 'Tôi bán'}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-1 ml-auto bg-white/5 rounded-xl p-1 border border-white/8 overflow-x-auto">
                        {STATUS_TABS.map(t => (
                            <button
                                key={t.value || 'all'}
                                onClick={() => setStatus(t.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                                    ${status === t.value ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-white/30">
                        <Coins className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Chưa có order nào ở trạng thái này.</p>
                        <Link href="/p2p" className="inline-block mt-4 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-500/30 transition">
                            Tìm offer mới
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {orders.map(order => {
                            const meta = STATUS_META[order.status] || { label: order.status, color: 'text-white/60', bg: 'bg-white/5 border-white/10' };
                            return (
                                <Link key={order.p2p_order_id} href={`/p2p/orders/${order.p2p_order_id}`}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.5fr_1.5fr_auto] gap-4 items-center px-4 py-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 hover:border-white/15 transition-all"
                                    >
                                        <div>
                                            <p className="font-mono text-xs text-white/40">#{order.order_ref || order.p2p_order_id}</p>
                                            <p className="font-medium text-sm">{order.counterparty_username || '—'}</p>
                                            <p className="text-xs text-white/40">{formatTime(order.created_at)}</p>
                                        </div>

                                        <div>
                                            <p className="text-sm font-bold">
                                                {parseFloat(order.token_amount).toFixed(4)} {order.symbol}
                                            </p>
                                            <p className="text-xs text-white/40">
                                                {parseFloat(order.fiat_amount).toLocaleString()} {order.fiat_currency}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-sm text-white/80">
                                                {parseFloat(order.price_per_unit).toLocaleString()} {order.fiat_currency}
                                            </p>
                                            <p className="text-xs text-white/40">/ {order.symbol}</p>
                                        </div>

                                        <div>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.bg} ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                            <p className="text-xs text-white/40 mt-1">{order.payment_method}</p>
                                        </div>

                                        <ChevronRight className="w-5 h-5 text-white/30" />
                                    </motion.div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
