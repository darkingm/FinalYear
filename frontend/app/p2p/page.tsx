'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, ChevronDown, Star, Clock, Shield,
    TrendingUp, TrendingDown, MessageCircle, Upload,
    AlertTriangle, CheckCircle, XCircle, ExternalLink,
    User, Coins, DollarSign, Zap, RefreshCw, Info,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { publicRequestConfig } from '@/lib/api/request-auth';

interface P2POffer {
    offer_id: number; offer_type: 'BUY' | 'SELL'; creator_id: number;
    price_per_unit: string; min_amount: string; max_amount: string;
    total_amount: string; available_amount: string; filled_amount: string;
    fiat_currency: string; payment_methods: string[];
    payment_time_limit: number; terms: string;
    symbol: string; chain_name: string; decimals: number;
    creator_username: string; creator_avatar: string;
    creator_rating: string; creator_sales: number; completed_orders: number;
}

interface Token { token_id: number; symbol: string; chain_id: number; }

const FIAT_CURRENCIES = ['USD', 'VND', 'EUR', 'GBP', 'SGD'];
const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Bank Transfer' },
    { id: 'paypal', label: 'PayPal' },
    { id: 'momo', label: 'MoMo' },
    { id: 'zalopay', label: 'ZaloPay' },
    { id: 'wise', label: 'Wise' },
];

export default function P2PPage() {
    const router = useRouter();
    const [tab, setTab] = useState<'BUY' | 'SELL'>('BUY');
    const [offers, setOffers] = useState<P2POffer[]>([]);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filters
    const [selectedToken, setSelectedToken] = useState<number | null>(null);
    const [fiat, setFiat] = useState('USD');
    const [payment, setPayment] = useState('');
    const [amount, setAmount] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Place order modal
    const [orderOffer, setOrderOffer] = useState<P2POffer | null>(null);
    const [orderAmount, setOrderAmount] = useState('');
    const [orderPayment, setOrderPayment] = useState('');
    const [ordering, setOrdering] = useState(false);
    const [orderError, setOrderError] = useState('');

    const fetchOffers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ type: tab, page: String(page), limit: '20' });
        if (selectedToken) params.set('token_id', String(selectedToken));
        if (fiat) params.set('fiat', fiat);
        if (payment) params.set('payment', payment);
        if (amount) params.set('amount', amount);

        try {
            const res = await apiClient.get(`/api/p2p/offers?${params}`, publicRequestConfig);
            const d = res.data;
            if (d.success) { setOffers(d.data); setTotal(d.pagination?.total || 0); }
        } catch { /* no offers */ }
        finally { setLoading(false); }
    }, [tab, page, selectedToken, fiat, payment, amount]);

    useEffect(() => { fetchOffers(); }, [fetchOffers]);

    useEffect(() => {
        apiClient.get('/api/products/tokens', publicRequestConfig)
            .then(res => { if (res.data?.success) setTokens(res.data.data); })
            .catch(() => {});
    }, []);

    const handlePlaceOrder = async () => {
        if (!orderOffer) return;
        if (!orderAmount || parseFloat(orderAmount) <= 0) { setOrderError('Nhập số tiền hợp lệ'); return; }
        if (!orderPayment) { setOrderError('Chọn phương thức thanh toán'); return; }

        setOrdering(true);
        setOrderError('');
        try {
            const res = await apiClient.post('/api/p2p/orders', {
                offer_id: orderOffer.offer_id,
                fiat_amount: parseFloat(orderAmount),
                payment_method: orderPayment,
            });
            const d = res.data;
            if (d.success) {
                setOrderOffer(null);
                router.push(`/p2p/orders/${d.data.p2p_order_id}`);
            } else {
                setOrderError(d.message || 'Đặt lệnh thất bại');
            }
        } catch (err: any) {
            setOrderError(err.response?.data?.message || 'Đặt lệnh thất bại');
        } finally { setOrdering(false); }
    };

    const tokenAmt = orderOffer && orderAmount
        ? (parseFloat(orderAmount) / parseFloat(orderOffer.price_per_unit)).toFixed(6) : '—';

    const CHAIN_COLORS: Record<string, string> = {
        Ethereum: 'text-blue-400', 'BNB Smart Chain': 'text-yellow-400',
        Polygon: 'text-purple-400', 'Arbitrum One': 'text-cyan-400',
        Solana: 'text-green-400', TRON: 'text-red-400', TON: 'text-sky-400',
    };

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <div className="border-b border-white/5 bg-black/40 sticky top-0 z-30 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center gap-6 py-3">
                        <div className="flex items-center gap-2">
                            <Coins className="w-5 h-5 text-violet-400" />
                            <span className="font-bold text-lg">P2P Trading</span>
                        </div>
                        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
                            {(['BUY', 'SELL'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTab(t); setPage(1); }}
                                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
                    ${tab === t
                                            ? t === 'BUY' ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                            : 'text-white/50 hover:text-white'}`}
                                >
                                    {t === 'BUY' ? '🟢 Buy Crypto' : '🔴 Sell Crypto'}
                                </button>
                            ))}
                        </div>
                        <Link
                            href="/p2p/orders"
                            className="ml-auto text-sm text-white/60 hover:text-white flex items-center gap-1"
                        >
                            <Clock className="w-4 h-4" />My Orders
                        </Link>
                        <Link
                            href="/p2p/create-offer"
                            className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 transition-all"
                        >
                            + Post Ad
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    {/* Token selector */}
                    <div className="flex gap-2 overflow-x-auto">
                        <button
                            onClick={() => setSelectedToken(null)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap
                ${!selectedToken ? 'bg-violet-500/20 border-violet-500 text-violet-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                        >
                            All Tokens
                        </button>
                        {tokens.slice(0, 8).map(tk => (
                            <button
                                key={tk.token_id}
                                onClick={() => setSelectedToken(tk.token_id === selectedToken ? null : tk.token_id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap
                  ${selectedToken === tk.token_id ? 'bg-violet-500/20 border-violet-500 text-violet-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                            >
                                {tk.symbol}
                            </button>
                        ))}
                    </div>

                    {/* Fiat */}
                    <select
                        value={fiat}
                        onChange={e => setFiat(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-violet-500"
                    >
                        {FIAT_CURRENCIES.map(f => <option key={f} value={f} className="bg-[#1a1a2e]">{f}</option>)}
                    </select>

                    {/* Payment method filter */}
                    <select
                        value={payment}
                        onChange={e => setPayment(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-violet-500"
                    >
                        <option value="" className="bg-[#1a1a2e]">All Payment</option>
                        {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id} className="bg-[#1a1a2e]">{m.label}</option>)}
                    </select>

                    {/* Amount filter */}
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="Amount"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none focus:border-violet-500 w-32"
                        />
                    </div>

                    <button
                        onClick={fetchOffers}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                        <RefreshCw className="w-4 h-4 text-white/60" />
                    </button>
                </div>

                {/* Table Header */}
                <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr_2fr_1fr] gap-4 px-4 py-2 text-xs text-white/40 font-medium uppercase tracking-wider border-b border-white/5 mb-1">
                    <span>Advertiser</span>
                    <span>Price / Unit</span>
                    <span>Limit</span>
                    <span>Available</span>
                    <span>Payment</span>
                    <span>Action</span>
                </div>

                {/* Offer List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                ) : offers.length === 0 ? (
                    <div className="text-center py-20 text-white/30">
                        <Coins className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>No offers found. Try adjusting filters.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {offers.map(offer => (
                            <motion.div
                                key={offer.offer_id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.5fr_1.5fr_2fr_1fr] gap-4 items-center
                           px-4 py-4 rounded-xl bg-white/3 border border-white/8
                           hover:bg-white/5 hover:border-white/15 transition-all group"
                            >
                                {/* Advertiser */}
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-sm font-bold text-violet-300">
                                        {offer.creator_username?.[0]?.toUpperCase() || 'A'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{offer.creator_username}</p>
                                        <div className="flex items-center gap-2 text-xs text-white/40">
                                            <span className="flex items-center gap-0.5">
                                                <CheckCircle className="w-3 h-3 text-green-400" />
                                                {offer.completed_orders} orders
                                            </span>
                                            {parseFloat(offer.creator_rating) > 0 && (
                                                <span className="flex items-center gap-0.5">
                                                    <Star className="w-3 h-3 text-amber-400" />
                                                    {parseFloat(offer.creator_rating).toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Price */}
                                <div>
                                    <p className={`text-lg font-bold ${tab === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                        {parseFloat(offer.price_per_unit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </p>
                                    <p className="text-xs text-white/40">{offer.fiat_currency} per {offer.symbol}</p>
                                </div>

                                {/* Limit */}
                                <div className="text-sm">
                                    <p className="text-white/80">
                                        {parseFloat(offer.min_amount).toLocaleString()} – {parseFloat(offer.max_amount).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-white/40">{offer.fiat_currency}</p>
                                </div>

                                {/* Available */}
                                <div className="text-sm">
                                    <p className="text-white/80 font-medium">
                                        {parseFloat(offer.available_amount).toFixed(4)} {offer.symbol}
                                    </p>
                                    <p className={`text-xs font-medium ${CHAIN_COLORS[offer.chain_name] || 'text-white/40'}`}>
                                        {offer.chain_name}
                                    </p>
                                </div>

                                {/* Payment methods */}
                                <div className="flex flex-wrap gap-1">
                                    {offer.payment_methods?.slice(0, 3).map(m => (
                                        <span key={m} className="px-2 py-0.5 rounded-md text-xs bg-white/8 text-white/60 border border-white/10">
                                            {PAYMENT_METHODS.find(pm => pm.id === m)?.label || m}
                                        </span>
                                    ))}
                                    {(offer.payment_methods?.length || 0) > 3 && (
                                        <span className="px-2 py-0.5 rounded-md text-xs bg-white/8 text-white/40">+{offer.payment_methods.length - 3}</span>
                                    )}
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => {
                                        setOrderOffer(offer);
                                        setOrderAmount('');
                                        setOrderPayment(offer.payment_methods[0] || '');
                                        setOrderError('');
                                    }}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all w-full
                    ${tab === 'BUY'
                                            ? 'bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30'
                                            : 'bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30'}`}
                                >
                                    {tab === 'BUY' ? 'Buy' : 'Sell'}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {total > 20 && (
                    <div className="flex justify-center gap-2 mt-6">
                        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).slice(0, 8).map(p => (
                            <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all
                  ${page === p ? 'bg-violet-500/30 border border-violet-500 text-violet-300' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Place Order Modal */}
            <AnimatePresence>
                {orderOffer && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={e => { if (e.target === e.currentTarget) setOrderOffer(null); }}
                    >
                        <motion.div
                            className="w-full max-w-md bg-[#12121e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                            initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                        >
                            {/* Modal Header */}
                            <div className={`px-6 py-4 border-b border-white/8 flex items-center justify-between
                ${tab === 'BUY' ? 'bg-green-500/8' : 'bg-red-500/8'}`}>
                                <div>
                                    <h3 className="font-bold text-lg">
                                        {tab === 'BUY' ? '🟢 Buy' : '🔴 Sell'} {orderOffer.symbol}
                                    </h3>
                                    <p className="text-sm text-white/50">from @{orderOffer.creator_username}</p>
                                </div>
                                <button onClick={() => setOrderOffer(null)} className="text-white/40 hover:text-white transition-colors">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Price info */}
                                <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-white/50">Price</span>
                                        <span className={`text-lg font-bold ${tab === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                            {parseFloat(orderOffer.price_per_unit).toLocaleString()} {orderOffer.fiat_currency}/{orderOffer.symbol}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-white/40">
                                        <span>Limit: {parseFloat(orderOffer.min_amount).toLocaleString()} – {parseFloat(orderOffer.max_amount).toLocaleString()} {orderOffer.fiat_currency}</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{orderOffer.payment_time_limit}min</span>
                                    </div>
                                </div>

                                {/* Fiat Amount Input */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-white/60">I will pay (fiat)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={orderAmount}
                                            onChange={e => setOrderAmount(e.target.value)}
                                            placeholder={`${orderOffer.min_amount} – ${orderOffer.max_amount}`}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white pr-16 outline-none focus:border-violet-500 transition-colors"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/50 font-medium">{orderOffer.fiat_currency}</span>
                                    </div>
                                    {orderAmount && parseFloat(orderAmount) > 0 && (
                                        <p className="text-xs text-white/50 pl-1">
                                            ≈ <span className="text-violet-300 font-medium">{tokenAmt} {orderOffer.symbol}</span> you receive
                                        </p>
                                    )}
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-1.5">
                                    <label className="text-sm text-white/60">Payment method</label>
                                    <div className="flex flex-wrap gap-2">
                                        {orderOffer.payment_methods.map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setOrderPayment(m)}
                                                className={`px-3 py-2 rounded-lg text-sm border transition-all
                          ${orderPayment === m
                                                        ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                                                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                                            >
                                                {PAYMENT_METHODS.find(pm => pm.id === m)?.label || m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Terms */}
                                {orderOffer.terms && (
                                    <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                                        <p className="text-xs text-amber-300/80 flex items-start gap-2">
                                            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                            {orderOffer.terms}
                                        </p>
                                    </div>
                                )}

                                {orderError && (
                                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />{orderError}
                                    </div>
                                )}

                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={ordering || !orderAmount || !orderPayment}
                                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2
                    ${tab === 'BUY'
                                            ? 'bg-green-500/25 border border-green-500/40 text-green-300 hover:bg-green-500/35 disabled:hover:bg-green-500/25'
                                            : 'bg-red-500/25 border border-red-500/40 text-red-300 hover:bg-red-500/35'}`}
                                >
                                    {ordering
                                        ? <><RefreshCw className="w-4 h-4 animate-spin" />Placing Order…</>
                                        : <><Zap className="w-4 h-4" />Confirm {tab === 'BUY' ? 'Buy' : 'Sell'}</>}
                                </button>
                                <p className="text-center text-xs text-white/30">
                                    By confirming you agree to P2P trading terms. Funds are held in escrow.
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
