'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Coins, AlertTriangle, Zap, Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { publicRequestConfig } from '@/lib/api/request-auth';

interface Token { token_id: number; symbol: string; chain_id: number; }

const FIAT_CURRENCIES = ['USD', 'VND', 'EUR', 'GBP', 'SGD'];
const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Bank Transfer' },
    { id: 'paypal',        label: 'PayPal' },
    { id: 'momo',          label: 'MoMo' },
    { id: 'zalopay',       label: 'ZaloPay' },
    { id: 'wise',          label: 'Wise' },
];

export default function P2PCreateOfferPage() {
    const router = useRouter();
    const [tokens, setTokens] = useState<Token[]>([]);

    const [offerType, setOfferType] = useState<'BUY' | 'SELL'>('SELL');
    const [tokenId, setTokenId] = useState<number | null>(null);
    const [fiat, setFiat] = useState('USD');
    const [pricePerUnit, setPricePerUnit] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
    const [paymentTimeLimit, setPaymentTimeLimit] = useState(15);
    const [terms, setTerms] = useState('');
    const [autoRelease, setAutoRelease] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        apiClient.get('/api/products/tokens', publicRequestConfig)
            .then(res => {
                if (res.data?.success) {
                    setTokens(res.data.data);
                    if (res.data.data?.[0]) setTokenId(res.data.data[0].token_id);
                }
            })
            .catch(() => {});
    }, []);

    const togglePayment = (id: string) => {
        setPaymentMethods(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const validate = (): string | null => {
        if (!tokenId) return 'Chọn token';
        const price = parseFloat(pricePerUnit);
        const min = parseFloat(minAmount);
        const max = parseFloat(maxAmount);
        const total = parseFloat(totalAmount);
        if (!price || price <= 0) return 'Giá phải > 0';
        if (!min || min <= 0) return 'Min amount phải > 0';
        if (!max || max <= min) return 'Max amount phải > min';
        if (!total || total <= 0) return 'Total amount phải > 0';
        if (paymentMethods.length === 0) return 'Chọn ít nhất 1 phương thức thanh toán';
        if (paymentTimeLimit < 5 || paymentTimeLimit > 120) return 'Thời hạn thanh toán 5-120 phút';
        return null;
    };

    const handleSubmit = async () => {
        const err = validate();
        if (err) { setError(err); return; }

        setSubmitting(true);
        setError('');
        try {
            const res = await apiClient.post('/api/p2p/offers', {
                offer_type: offerType,
                token_id: tokenId,
                fiat_currency: fiat,
                price_per_unit: parseFloat(pricePerUnit),
                min_amount: parseFloat(minAmount),
                max_amount: parseFloat(maxAmount),
                total_amount: parseFloat(totalAmount),
                payment_methods: paymentMethods,
                payment_time_limit: paymentTimeLimit,
                terms: terms.trim() || null,
                auto_release: autoRelease,
            });
            if (res.data?.success) {
                router.push('/p2p');
            } else {
                setError(res.data?.message || 'Đăng offer thất bại');
            }
        } catch (e: any) {
            setError(e.response?.data?.message || 'Đăng offer thất bại');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedToken = tokens.find(t => t.token_id === tokenId);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            <div className="border-b border-white/5 bg-black/40 sticky top-0 z-30 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/p2p" className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60 hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-violet-400" />
                        <span className="font-bold text-lg">Tạo offer P2P</span>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Offer type */}
                <section className="space-y-2">
                    <label className="text-sm text-white/60">Tôi muốn</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setOfferType('SELL')}
                            className={`px-4 py-3 rounded-xl font-bold border transition-all
                                ${offerType === 'SELL' ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                        >
                            🔴 Bán crypto (nhận fiat)
                        </button>
                        <button
                            type="button"
                            onClick={() => setOfferType('BUY')}
                            className={`px-4 py-3 rounded-xl font-bold border transition-all
                                ${offerType === 'BUY' ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                        >
                            🟢 Mua crypto (trả fiat)
                        </button>
                    </div>
                </section>

                {/* Token + fiat */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Token</label>
                        <select
                            value={tokenId ?? ''}
                            onChange={e => setTokenId(parseInt(e.target.value) || null)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                        >
                            {tokens.length === 0 && <option value="" className="bg-[#1a1a2e]">Đang tải...</option>}
                            {tokens.map(t => (
                                <option key={t.token_id} value={t.token_id} className="bg-[#1a1a2e]">
                                    {t.symbol} (chain {t.chain_id})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Fiat</label>
                        <select
                            value={fiat}
                            onChange={e => setFiat(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                        >
                            {FIAT_CURRENCIES.map(f => <option key={f} value={f} className="bg-[#1a1a2e]">{f}</option>)}
                        </select>
                    </div>
                </section>

                {/* Price */}
                <section className="space-y-2">
                    <label className="text-sm text-white/60">
                        Giá / 1 {selectedToken?.symbol || 'token'} ({fiat})
                    </label>
                    <input
                        type="number"
                        step="0.0001"
                        value={pricePerUnit}
                        onChange={e => setPricePerUnit(e.target.value)}
                        placeholder="VD 27500"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                    />
                </section>

                {/* Limits */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Min order ({fiat})</label>
                        <input
                            type="number"
                            value={minAmount}
                            onChange={e => setMinAmount(e.target.value)}
                            placeholder="50"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Max order ({fiat})</label>
                        <input
                            type="number"
                            value={maxAmount}
                            onChange={e => setMaxAmount(e.target.value)}
                            placeholder="5000"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Tổng số {selectedToken?.symbol || 'token'}</label>
                        <input
                            type="number"
                            step="0.000001"
                            value={totalAmount}
                            onChange={e => setTotalAmount(e.target.value)}
                            placeholder="0.5"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>
                </section>

                {/* Payment methods */}
                <section className="space-y-2">
                    <label className="text-sm text-white/60">Phương thức thanh toán (chọn nhiều)</label>
                    <div className="flex flex-wrap gap-2">
                        {PAYMENT_METHODS.map(m => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => togglePayment(m.id)}
                                className={`px-4 py-2 rounded-xl text-sm border transition-all
                                    ${paymentMethods.includes(m.id)
                                        ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Time limit + auto release */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Thời hạn thanh toán (phút)</label>
                        <input
                            type="number"
                            min={5}
                            max={120}
                            value={paymentTimeLimit}
                            onChange={e => setPaymentTimeLimit(parseInt(e.target.value) || 15)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-white/60">Tuỳ chọn</label>
                        <label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/8 transition">
                            <input
                                type="checkbox"
                                checked={autoRelease}
                                onChange={e => setAutoRelease(e.target.checked)}
                                className="accent-violet-500"
                            />
                            <span className="text-sm">Tự động giải ngân khi buyer mark paid</span>
                        </label>
                    </div>
                </section>

                {/* Terms */}
                <section className="space-y-2">
                    <label className="text-sm text-white/60">Điều khoản (tuỳ chọn)</label>
                    <textarea
                        value={terms}
                        onChange={e => setTerms(e.target.value)}
                        rows={3}
                        placeholder="VD: Chỉ giao dịch tk chính chủ. Ghi chú đúng nội dung order_ref."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-violet-500 transition-colors resize-none"
                    />
                </section>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
                    </div>
                )}

                <motion.button
                    onClick={handleSubmit}
                    disabled={submitting}
                    whileHover={{ scale: submitting ? 1 : 1.01 }}
                    whileTap={{ scale: submitting ? 1 : 0.99 }}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2
                        ${offerType === 'BUY'
                            ? 'bg-green-500/25 border border-green-500/40 text-green-300 hover:bg-green-500/35'
                            : 'bg-red-500/25 border border-red-500/40 text-red-300 hover:bg-red-500/35'}`}
                >
                    {submitting
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Đang đăng...</>
                        : <><Zap className="w-4 h-4" />Đăng offer {offerType === 'BUY' ? 'mua' : 'bán'}</>}
                </motion.button>
            </div>
        </div>
    );
}
